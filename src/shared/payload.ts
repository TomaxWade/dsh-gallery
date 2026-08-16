/**
 * Shared fence-payload contract: pure parsing + types, importable by the
 * client renderer AND the node test runner (no JSX, no harness imports).
 */

export interface GalleryImage {
  url: string
  alt?: string
  caption?: string
  source?: string
  sourceUrl?: string
}

export interface GalleryPayload {
  title?: string
  filtered?: boolean
  images: GalleryImage[]
}

/** Whitelist payload: https urls only, unknown fields dropped, cap 8 images. */
export function parsePayload(raw: unknown): GalleryPayload | null {
  if (raw === null || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (!Array.isArray(record.images)) return null
  const images: GalleryImage[] = []
  for (const entry of record.images.slice(0, 8)) {
    if (entry === null || typeof entry !== 'object') continue
    const img = entry as Record<string, unknown>
    if (typeof img.url !== 'string' || !img.url.startsWith('https://')) continue
    const item: GalleryImage = { url: img.url }
    if (typeof img.alt === 'string') item.alt = img.alt.slice(0, 200)
    if (typeof img.caption === 'string') item.caption = img.caption.slice(0, 200)
    if (typeof img.source === 'string') item.source = img.source.slice(0, 100)
    if (typeof img.sourceUrl === 'string' && img.sourceUrl.startsWith('https://')) item.sourceUrl = img.sourceUrl
    images.push(item)
  }
  if (images.length === 0) return null
  return {
    ...(typeof record.title === 'string' ? { title: record.title.slice(0, 120) } : {}),
    ...(record.filtered === false ? { filtered: false } : {}),
    images,
  }
}

/** Parse a raw fence body (JSON text) and whitelist it; null keeps the stock code block. */
export function parseFenceText(raw: string): GalleryPayload | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  return parsePayload(parsed)
}
