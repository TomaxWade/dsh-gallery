/**
 * Vision client: OpenAI-compatible chat-completions against a configurable
 * vision model (default Zhipu GLM-4V-Flash). Node 24 global fetch; no deps.
 * Images travel to the configured provider — the settings page discloses this.
 */

export interface VisionConfig {
  baseURL: string
  key: string
  model: string
}

export interface CurateItem {
  url: string
  index?: number
}

export interface CurateResult {
  index: number
  relevant: boolean
  safety: boolean
  caption: string
}

const DEFAULT_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4'
const DEFAULT_MODEL = 'glm-4.6v-flash'

export function resolveVisionConfig(
  env: Record<string, string | undefined> = process.env
): VisionConfig | null {
  const key = env.DSH_GALLERY_VISION_KEY ?? ''
  if (key.length === 0) return null
  return {
    baseURL: (env.DSH_GALLERY_VISION_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, ''),
    key,
    model: env.DSH_GALLERY_VISION_MODEL ?? DEFAULT_MODEL,
  }
}

let cached: VisionConfig | null | undefined

/** Whether a vision model is configured via env (sync; credentials 需异步). */
export function visionAvailable(): boolean {
  if (cached === undefined) cached = resolveVisionConfig()
  return cached !== null
}

let keyResolver: (() => Promise<string | undefined>) | undefined

/** 宿主注入凭据解析器（credentials 服务）；env 无 key 时回退到这里。 */
export function setVisionKeyResolver(resolver: (() => Promise<string | undefined>) | undefined): void {
  keyResolver = resolver
}

/** 解析优先级：env → settings（设置页）→ credentials 服务 → 未配置。 */
export async function getVisionConfig(): Promise<VisionConfig | null> {
  const settings = getRuntimeSettings()
  const fromEnv = resolveVisionConfig()
  if (fromEnv !== null) return fromEnv
  const baseURL = pickEnvThenSettings(process.env, 'DSH_GALLERY_VISION_BASE_URL', settings.visionBaseURL, DEFAULT_BASE_URL)
  const model = pickEnvThenSettings(process.env, 'DSH_GALLERY_VISION_MODEL', settings.visionModel, DEFAULT_MODEL)
  if (keyResolver === undefined) return null
  const key = await keyResolver()
  if (key === undefined || key.length === 0) return null
  return {
    baseURL: baseURL.replace(/\/+$/, ''),
    key,
    model,
  }
}

import { proxiedFetch } from './net.ts'
import { getRuntimeSettings, pickEnvThenSettings } from './runtime-config.ts'

interface ChatMessage {
  role: 'user'
  content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>
}

async function chat(config: VisionConfig, messages: ChatMessage[], maxTokens: number, signal?: AbortSignal): Promise<string> {
  const res = await proxiedFetch(`${config.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: config.model, messages, max_tokens: maxTokens, temperature: 0.2 }),
    signal,
  })
  const body = (await res.json()) as {
    error?: { message?: string }
    choices?: Array<{ message?: { content?: string } }>
  }
  if (!res.ok) {
    throw new Error(`vision api ${res.status}: ${body.error?.message ?? 'unknown error'}`)
  }
  const text = body.choices?.[0]?.message?.content ?? ''
  if (text.length === 0) throw new Error('vision api returned empty content')
  return text
}

/** Strip ```json fences the model may wrap around the JSON answer. */
export function stripJsonFences(text: string): string {
  const trimmed = text.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed)
  if (fence?.[1] !== undefined) return fence[1]
  const first = trimmed.indexOf('[')
  const last = trimmed.lastIndexOf(']')
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1)
  return trimmed
}

const CURATE_PROMPT = (topic: string, count: number) =>
  `你是图片筛选助手。用户主题：「${topic}」。下面按顺序给出 ${count} 张图片。对每张图片判断：` +
  `1) relevant：是否与主题相关；2) safety：是否包含令人不适/恐怖/血腥内容（是则 safety=false）；` +
  `3) caption：一句中文说明（10 字左右）。` +
  `只输出 JSON 数组，不要任何其他文字，格式：[{"index":0,"relevant":true,"safety":true,"caption":"..."},...]，index 按图片出现顺序 0..${count - 1}。`

const MAX_IMAGE_BYTES = 4 * 1024 * 1024

/**
 * 把候选图下载为 base64 data URL（走代理感知 fetch）。
 * 实测坑（2026-08-16）：智谱服务器侧拉取 Wikimedia 等海外图源会超时（1210），
 * 因此由插件本地取图后直传 base64，绕开供应商侧取图；也顺带约束图片体积。
 */
async function imageToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await proxiedFetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return null
    const buffer = new Uint8Array(await res.arrayBuffer())
    if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null
    const mediaType = res.headers.get('content-type') ?? 'image/jpeg'
    const base64 = Buffer.from(buffer).toString('base64')
    return `data:${mediaType};base64,${base64}`
  } catch {
    return null
  }
}

/**
 * Curate up to 8 candidate images in one call. Images are downloaded locally
 * and sent as base64 data URLs. Failures map to a structured error object
 * instead of throwing out of the tool.
 */
export async function curateImages(
  items: CurateItem[],
  topic: string
): Promise<{ results?: CurateResult[]; error?: string }> {
  const config = await getVisionConfig()
  if (config === null) {
    return { error: 'vision_unconfigured' }
  }
  const list = items.slice(0, 8)
  if (list.length === 0) return { results: [] }
  // 并行取图；失败的候选跳过（保留原始 index 映射）
  const analyzed: Array<{ originalIndex: number; dataUrl: string }> = []
  await Promise.all(
    list.map(async (item) => {
      const dataUrl = await imageToDataUrl(item.url)
      if (dataUrl !== null) {
        analyzed.push({ originalIndex: item.index ?? analyzed.length, dataUrl })
      }
    })
  )
  if (analyzed.length === 0) return { results: [] }
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: CURATE_PROMPT(topic, analyzed.length) },
        ...analyzed.map((entry) => ({ type: 'image_url' as const, image_url: { url: entry.dataUrl } })),
      ],
    },
  ]
  const attempt = async (): Promise<CurateResult[]> => {
    const signal = AbortSignal.timeout(45_000)
    const text = await chat(config, messages, 1200, signal)
    const parsed = JSON.parse(stripJsonFences(text)) as Array<Partial<CurateResult>>
    if (!Array.isArray(parsed)) throw new Error('curate response is not an array')
    return parsed.map((entry, i) => ({
      index: analyzed[i]?.originalIndex ?? (typeof entry.index === 'number' ? entry.index : i),
      relevant: entry.relevant !== false,
      safety: entry.safety !== false,
      caption: typeof entry.caption === 'string' ? entry.caption.slice(0, 80) : '',
    }))
  }
  try {
    return { results: await attempt() }
  } catch (first) {
    try {
      return { results: await attempt() }
    } catch (second) {
      return {
        error: `vision_curate_failed: ${second instanceof Error ? second.message.slice(0, 200) : 'unknown'}`,
      }
    }
  }
}
