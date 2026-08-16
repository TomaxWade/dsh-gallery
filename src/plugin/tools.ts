/**
 * Tool definitions for the node half. Plain objects matching the harness
 * ToolDefinition shape (output.schema + output.render + execute) — authored
 * with local types only so the bundle has zero harness runtime imports.
 */

import { searchImages } from './sources.ts'
import { curateImages, getVisionConfig } from './vision.ts'
import { getRuntimeSettings } from './runtime-config.ts'

const textRender = (_args: unknown, value: unknown): Array<{ type: 'text'; text: string }> => [
  { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) },
]

const IMAGE_SEARCH_SCHEMA = {
  type: 'object' as const,
  properties: {
    query: { type: 'string' as const, description: '搜索词（中文或英文）' },
    n: { type: 'number' as const, description: '返回候选数量 1-12，默认 6' },
    source: {
      type: 'string' as const,
      enum: ['auto', 'wikimedia', 'openverse', 'bingcn'],
      description: '图源：auto（默认，Wikimedia 优先、Openverse 次之、国内必应兜底）/wikimedia/openverse/bingcn，均免 key',
    },
  },
  required: ['query'],
  additionalProperties: false,
}

export function createImageSearchTool(): unknown {
  return {
    name: 'image_search',
    description:
      '搜索图库图片（Wikimedia Commons / Openverse，CC 授权免 key；海外图源不可达时自动回退国内必应图搜，同样免 key）。返回候选的 url、标题、描述、来源与来源页。' +
      '用于用户要参考图/素材/概念配图时先取候选。候选必须经 vision_curate 筛选（或明示未筛选）后才能放入 dsh-gallery 围栏展示。',
    parameters: IMAGE_SEARCH_SCHEMA,
    output: {
      schema: { type: 'string' },
      render: textRender,
    },
    isConcurrencySafe: () => true,
    timeoutMs: 60_000,
    async execute(args: unknown): Promise<string> {
      const record = (args ?? {}) as Record<string, unknown>
      const query = String(record.query ?? '').trim()
      if (query.length === 0) return JSON.stringify({ error: 'empty_query' })
      const n = Math.min(12, Math.max(1, Number(record.n) || getRuntimeSettings().maxCandidates))
      const source = String(record.source ?? 'auto')
      try {
        const candidates = await searchImages(query, n, source)
        const visionConfigured = (await getVisionConfig()) !== null
        return JSON.stringify({
          query,
          source,
          filteredByVision: visionConfigured,
          candidates,
        })
      } catch (error) {
        return JSON.stringify({
          query,
          error: `image_search_failed: ${error instanceof Error ? error.message.slice(0, 200) : 'unknown'}`,
        })
      }
    },
  }
}

const VISION_CURATE_SCHEMA = {
  type: 'object' as const,
  properties: {
    images: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          url: { type: 'string' as const },
          index: { type: 'number' as const },
        },
        required: ['url'],
        additionalProperties: false,
      },
      description: '候选图片 url 列表，一次最多 8 张',
    },
    topic: { type: 'string' as const, description: '用户要找的主题，用于判断相关性' },
  },
  required: ['images', 'topic'],
  additionalProperties: false,
}

export function createVisionCurateTool(): unknown {
  return {
    name: 'vision_curate',
    description:
      '用配置的视觉模型筛选候选图片：返回每张的 relevant（是否与主题相关）、safety（是否含不适内容）与 caption（一句话中文说明）。' +
      '只把 relevant=true 且 safety=true 的图放进 dsh-gallery 围栏展示；视觉模型未配置时返回 vision_unconfigured，此时可展示但必须明示"未筛选"。',
    parameters: VISION_CURATE_SCHEMA,
    output: {
      schema: { type: 'string' },
      render: textRender,
    },
    isConcurrencySafe: () => true,
    timeoutMs: 120_000,
    async execute(args: unknown): Promise<string> {
      const record = (args ?? {}) as Record<string, unknown>
      const images = Array.isArray(record.images)
        ? (record.images as Array<{ url?: unknown; index?: unknown }>)
            .filter((item) => typeof item?.url === 'string' && (item.url as string).startsWith('https://'))
            .map((item, i) => ({ url: item.url as string, index: typeof item.index === 'number' ? item.index : i }))
        : []
      const topic = String(record.topic ?? '').trim().slice(0, 200)
      if (topic.length === 0) return JSON.stringify({ error: 'empty_topic' })
      if (images.length === 0) return JSON.stringify({ error: 'no_valid_images' })
      const result = await curateImages(images, topic)
      return JSON.stringify(result)
    },
  }
}
