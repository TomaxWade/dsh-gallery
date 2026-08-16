/**
 * Proxy-aware fetch for the node half.
 *
 * Node's global fetch ignores HTTP(S)_PROXY. Honors DSH_GALLERY_HTTPS_PROXY,
 * then HTTPS_PROXY / https_proxy / HTTP_PROXY / http_proxy; additionally
 * AUTO-DISCOVERS a listening local proxy (common candidate ports, extendable
 * via DSH_GALLERY_PROXY_PORTS) so the plugin works install-and-use without
 * env configuration. Loopback targets always bypass the proxy.
 *
 * Proxy requests use undici's ProxyAgent (standard, battle-tested CONNECT
 * tunnel). undici is a runtime dependency resolved from the plugin's own
 * node_modules (kept external in the tsdown lib build).
 */

import { ProxyAgent, fetch as undiciFetch } from 'undici'
import { connect } from 'node:net'

export interface FetchInit {
  method?: string
  headers?: Record<string, string>
  body?: string
  signal?: AbortSignal
}

export function proxyUrlOf(env: Record<string, string | undefined> = process.env): string | undefined {
  return (
    env.DSH_GALLERY_HTTPS_PROXY ?? env.HTTPS_PROXY ?? env.https_proxy ?? env.HTTP_PROXY ?? env.http_proxy ?? undefined
  )
}

let cachedAgent: ProxyAgent | undefined
let cachedAgentUrl: string | undefined

function agentFor(proxyUrl: string): ProxyAgent {
  if (cachedAgent !== undefined && cachedAgentUrl === proxyUrl) return cachedAgent
  cachedAgent = new ProxyAgent(proxyUrl)
  cachedAgentUrl = proxyUrl
  return cachedAgent
}

/** 自动发现候选：常见本地代理端口（可经 DSH_GALLERY_PROXY_PORTS 逗号分隔追加）。 */
const DEFAULT_AUTO_PROXY_PORTS = [7890, 7897, 10809]

function autoProxyCandidates(env: Record<string, string | undefined> = process.env): number[] {
  const extra = (env.DSH_GALLERY_PROXY_PORTS ?? '')
    .split(',')
    .map((entry) => Number(entry.trim()))
    .filter((n) => Number.isInteger(n) && n > 0 && n < 65536)
  return [...new Set([...DEFAULT_AUTO_PROXY_PORTS, ...extra])]
}

function tcpProbe(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port })
    let settled = false
    const done = (ok: boolean): void => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(800)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

let discovered: string | null | undefined

/**
 * 安装即用：未显式配置代理时，探测常见本地代理端口并自动使用。
 * 每进程只探测一次；端口在听才启用。用户显式配置的代理始终优先。
 */
async function discoverLocalProxy(): Promise<string | undefined> {
  if (discovered !== undefined) return discovered ?? undefined
  for (const port of autoProxyCandidates()) {
    if (await tcpProbe(port)) {
      discovered = `http://127.0.0.1:${port}`
      return discovered
    }
  }
  discovered = null
  return undefined
}

export async function proxiedFetch(input: string, init: FetchInit = {}): Promise<Response> {
  const url = new URL(input)
  const isLoopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1'
  const explicit = proxyUrlOf()
  const proxy = isLoopback ? undefined : explicit ?? (await discoverLocalProxy())
  if (proxy !== undefined) {
    const res = await undiciFetch(input, {
      dispatcher: agentFor(proxy),
      method: init.method,
      headers: init.headers,
      body: init.body,
      signal: init.signal,
    })
    // undici's Response is compatible enough for our callers (json()/status/ok);
    // return it as-is.
    return res as unknown as Response
  }
  return fetch(input, { method: init.method, headers: init.headers, body: init.body, signal: init.signal })
}
