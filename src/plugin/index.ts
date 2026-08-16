/**
 * dsh-gallery node half: teaches the model the ```dsh-gallery fence, and
 * registers image_search / vision_curate when the tools service binds.
 * Zero runtime harness imports (local contracts only, see context.ts).
 */

import Schema from '@deepseek-ai/schemastery'
import type { CredentialsService, PluginContext, ToolsRegistry } from './context.ts'
import { setRuntimeSettings, type RuntimeSettings } from './runtime-config.ts'
import { setVisionKeyResolver } from './vision.ts'
import { createImageSearchTool, createVisionCurateTool } from './tools.ts'

/** Convention: tool guidance uses 100-199; genui's fence section is 105. */
export const GALLERY_SECTION_ORDER = 106

/** 视觉模型 Key 在 credentials 服务中的引用名（与 env 同名）。 */
export const CREDENTIAL_REF = 'DSH_GALLERY_VISION_KEY'

/** 设置页命名空间（settings.yaml 的 dsh-gallery 段）。 */
export const SETTINGS_NAMESPACE = 'dsh-gallery'

/** 插件配置 schema：也是 settings 命名空间的 schema（bind 用 Config 注册）。 */
export const Config = Schema.object({
  visionBaseURL: Schema.string().default('').description('OpenAI 兼容视觉端点；留空用默认 open.bigmodel.cn'),
  visionModel: Schema.string().default('glm-4.6v-flash').description('视觉模型名'),
  maxCandidates: Schema.natural().min(1).max(12).default(6).description('image_search 默认候选数'),
  sourcesWikimedia: Schema.boolean().default(true).description('启用 Wikimedia Commons 图源'),
  sourcesOpenverse: Schema.boolean().default(true).description('启用 Openverse 图源'),
  sourcesBingCn: Schema.boolean().default(true).description('启用国内必应图搜兜底（免 key，海外图源不可达时回退）'),
})

export const GALLERY_SECTION_TEXT = `You can display a set of images INSIDE your reply by emitting a fenced block with the language tag \`dsh-gallery\` containing a JSON object:

\`\`\`dsh-gallery
{"title":"可选标题","filtered":true,"images":[{"url":"https://...","alt":"简短替代文字","caption":"一句话说明","source":"Wikimedia Commons","sourceUrl":"https://原图页面"}]}
\`\`\`

The block renders as a horizontally scrollable card of thumbnails; tapping one opens a larger view with its caption and source.

Contract rules:
- \`url\` must be https (no data: URLs, no local paths); max 8 images per card; unknown fields are ignored; invalid JSON degrades to a plain code block.
- Use the candidate's \`url\` field from image_search AS-IS (it is already the display-optimized image, e.g. a 480px thumbnail); put the candidate's \`sourceUrl\` into the fence's \`sourceUrl\`.
- \`filtered\`: true only when every image passed vision_curate (relevant=true and safety=true). When the vision service is unconfigured or curation failed, set false and tell the user in surrounding text that the images are unfiltered search results.

Workflow when the user wants images (参考图/素材/概念配图):
1. Call image_search(query, n) to fetch candidates (Wikimedia/Openverse，CC 授权；海外图源不可达时自动回退国内必应图搜)。
2. When image_search reports filteredByVision=true, call vision_curate({images, topic}) on the candidates; keep only relevant=true && safety=true items and use their captions.
3. Emit ONE dsh-gallery fence with the kept images (≤8). Do not dump long URL lists as plain text; a short text lead-in around the fence is fine.
4. If vision is unconfigured or curation fails: still show results but emit filtered:false and clearly say 未经视觉模型复核; prefer the 国内必应 results in this case (strict safe search + relevance ranking, zero-config safety fallback).
5. Never invent image URLs; only use urls returned by image_search. If search returns nothing, say so and offer to reword the query.`

// `settings` is the host-plane provider. `settingsScope` belongs to the web
// client and must not be injected by this node-half plugin.
export const inject = ['systemPrompt', 'settings']

export function apply(ctx: PluginContext): void {
  ctx.systemPrompt.section({
    name: 'gallery:fence',
    order: GALLERY_SECTION_ORDER,
    text: GALLERY_SECTION_TEXT,
  })

  // Register the namespace in the host provider so the web settings API can
  // describe and mutate it. The returned scope also feeds live changes into
  // the tool runtime.
  const scope = ctx.settings.register<Partial<RuntimeSettings>>(SETTINGS_NAMESPACE, Config)
  const adoptSettings = (): void => {
    setRuntimeSettings(scope.get() as Partial<RuntimeSettings>)
  }
  adoptSettings()
  scope.watch(adoptSettings)

  // The tools service is optional and may bind AFTER this plugin starts
  // (same ordering reality as dsh-genui): probe immediately AND on
  // internal/service so registration lands whenever `tools` appears.
  let registered = false
  const tryRegister = (value?: ToolsRegistry): void => {
    if (registered) return
    const tools = (value ?? ctx.reflect.get('tools', false)) as ToolsRegistry | undefined
    if (tools === undefined) return
    tools.register(createImageSearchTool())
    tools.register(createVisionCurateTool())
    registered = true
  }
  tryRegister(undefined)
  ctx.on('internal/service', (name: string, value: unknown) => {
    if (name === 'tools') tryRegister(value as ToolsRegistry)
  })

  // credentials 服务可选且可能晚绑定：env 无 key 时，视觉配置回退到
  // credentials.resolve(CREDENTIAL_REF)（Web 设置页写入的值）。
  let credentialsWired = false
  const tryWireCredentials = (value?: CredentialsService): void => {
    if (credentialsWired) return
    const credentials = (value ?? ctx.reflect.get('credentials', false)) as CredentialsService | undefined
    if (credentials === undefined) return
    setVisionKeyResolver(async () => (await credentials.resolve(CREDENTIAL_REF))?.value)
    credentialsWired = true
  }
  tryWireCredentials(undefined)
  ctx.on('internal/service', (name: string, value: unknown) => {
    if (name === 'credentials') tryWireCredentials(value as CredentialsService)
  })
}
