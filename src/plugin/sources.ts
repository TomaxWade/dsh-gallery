/**
 * Image sources: Wikimedia Commons + Openverse (both free, CC-licensed,
 * key-less). Candidates carry url/thumb/title/desc/source/sourceUrl so the
 * card can show attribution and the model can emit valid fence payloads.
 */

export interface ImageCandidate {
  /** 为卡片展示优化的图（Wikimedia 480px 缩略图）；围栏 url 用这个 */
  url: string
  thumb: string
  title: string
  desc: string
  source: string
  /** 来源页；原始大图留在来源页里 */
  sourceUrl: string
}

import { proxiedFetch } from './net.ts'
import { getRuntimeSettings } from './runtime-config.ts'

const USER_AGENT = 'dsh-gallery/0.0.1 (DeepSeek Harness plugin; local usage)'
const BING_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

/** 图源主机可经环境变量覆盖（镜像/内网/测试注入）；默认官方端点。 */
function wikimediaBase(env: Record<string, string | undefined> = process.env): string {
  return env.DSH_GALLERY_WIKIMEDIA_URL ?? 'https://commons.wikimedia.org/w/api.php'
}

function openverseBase(env: Record<string, string | undefined> = process.env): string {
  return env.DSH_GALLERY_OPENVERSE_URL ?? 'https://api.openverse.org/v1/images/'
}

function bingcnBase(env: Record<string, string | undefined> = process.env): string {
  return env.DSH_GALLERY_BINGCN_URL ?? 'https://cn.bing.com/images/async'
}

function stripHtml(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
}

interface WikimediaPage {
  title?: string
  imageinfo?: Array<{
    url?: string
    thumburl?: string
    descriptionurl?: string
    extmetadata?: Record<string, { value?: string }>
  }>
}

/** Pure mapper（可测试）：Wikimedia API 页面 → 候选；无可用图返回 null。 */
export function wikimediaPageToCandidate(page: WikimediaPage): ImageCandidate | null {
  const info = page.imageinfo?.[0]
  if (info?.url === undefined) return null
  // 卡片只展示 480px 缩略图；原始大图（可能数十 MB）不进入卡片
  const displayUrl = info.thumburl ?? info.url
  return {
    url: displayUrl,
    thumb: displayUrl,
    title: (page.title ?? '').replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').slice(0, 120),
    desc: stripHtml(info.extmetadata?.ImageDescription?.value),
    source: 'Wikimedia Commons',
    sourceUrl: info.descriptionurl ?? info.url,
  }
}

export async function searchWikimedia(query: string, n: number): Promise<ImageCandidate[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: '6',
    gsrlimit: String(n),
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '480',
    format: 'json',
    origin: '*',
  })
  const res = await proxiedFetch(`${wikimediaBase()}?${params.toString()}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`wikimedia ${res.status}`)
  const data = (await res.json()) as {
    query?: { pages?: Record<string, { title?: string; imageinfo?: Array<{ url?: string; thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }> }> }
  }
  const pages = data.query?.pages ?? {}
  const out: ImageCandidate[] = []
  for (const page of Object.values(pages)) {
    const candidate = wikimediaPageToCandidate(page)
    if (candidate !== null) out.push(candidate)
  }
  return out
}

export async function searchOpenverse(query: string, n: number): Promise<ImageCandidate[]> {
  const res = await proxiedFetch(`${openverseBase()}?q=${encodeURIComponent(query)}&page_size=${n}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`openverse ${res.status}`)
  const data = (await res.json()) as {
    results?: Array<{ url?: string; thumbnail?: string; title?: string; creator?: string; foreign_landing_url?: string }>
  }
  const out: ImageCandidate[] = []
  for (const r of data.results ?? []) {
    if (r.url === undefined) continue
    out.push({
      url: r.url,
      thumb: r.thumbnail ?? r.url,
      title: (r.title ?? '').slice(0, 120),
      desc: r.creator ? `by ${r.creator}`.slice(0, 160) : '',
      source: 'Openverse',
      sourceUrl: r.foreign_landing_url ?? r.url,
    })
  }
  return out
}

interface BingEntry {
  murl?: string
  turl?: string
  purl?: string
}

/** 解析 cn.bing.com/images/async 的 HTML：`m="..."` 属性（HTML 实体编码的 JSON）。 */
export function parseBingAsyncHtml(html: string): BingEntry[] {
  const out: BingEntry[] = []
  const re = /m="([^"]+)"/g
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const raw = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    try {
      const obj = JSON.parse(raw) as BingEntry
      if (typeof obj.murl === 'string' && obj.murl.length > 0) {
        out.push({ murl: obj.murl, turl: obj.turl, purl: obj.purl })
      }
    } catch {
      // 单条损坏跳过
    }
  }
  return out
}

/** 国内直连可达、免 key 的兜底图源：cn.bing.com 图片搜索（网页接口抓取）。
 * adlt=strict 启用必应严格安全搜索——无视觉模型时的零配置安全兜底。 */
export async function searchBingCn(query: string, n: number): Promise<ImageCandidate[]> {
  const res = await proxiedFetch(`${bingcnBase()}?q=${encodeURIComponent(query)}&first=0&count=${n}&mmasync=1&adlt=strict`, {
      headers: { 'User-Agent': BING_UA },
      signal: AbortSignal.timeout(15_000),
    }
  )
  if (!res.ok) throw new Error(`bingcn ${res.status}`)
  const html = await res.text()
  return parseBingAsyncHtml(html)
    .slice(0, n)
    .map((entry, i) => {
      const display = entry.turl ?? entry.murl ?? ''
      return {
        url: display,
        thumb: display,
        title: `必应图片 ${i + 1}`,
        desc: '',
        source: 'Bing 图片',
        sourceUrl: entry.purl ?? entry.murl ?? '',
      }
    })
    .filter((candidate) => candidate.url.startsWith('https://'))
}

/** 单次重试：本机实测 wikimedia 直连偶发瞬时失败（fetch failed）。 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (first) {
    try {
      return await fn()
    } catch (second) {
      throw second
    }
  }
}

export async function searchImages(query: string, n: number, source: string): Promise<ImageCandidate[]> {
  const settings = getRuntimeSettings()
  const wikimediaEnabled = settings.sourcesWikimedia
  const openverseEnabled = settings.sourcesOpenverse
  const bingEnabled = settings.sourcesBingCn
  if (!wikimediaEnabled && !openverseEnabled && !bingEnabled) return []
  if (source === 'wikimedia') return wikimediaEnabled ? withRetry(() => searchWikimedia(query, n)) : []
  if (source === 'openverse') return openverseEnabled ? withRetry(() => searchOpenverse(query, n)) : []
  if (source === 'bingcn') return bingEnabled ? withRetry(() => searchBingCn(query, n)) : []
  // auto: wikimedia → openverse → 国内必应 逐级回退（每个源内重试一次）
  if (wikimediaEnabled) {
    try {
      const fromWikimedia = await withRetry(() => searchWikimedia(query, n))
      if (fromWikimedia.length > 0) return fromWikimedia
    } catch {
      // fall through
    }
  }
  if (openverseEnabled) {
    try {
      const fromOpenverse = await withRetry(() => searchOpenverse(query, n))
      if (fromOpenverse.length > 0) return fromOpenverse
    } catch {
      // fall through
    }
  }
  return bingEnabled ? withRetry(() => searchBingCn(query, n)) : []
}
