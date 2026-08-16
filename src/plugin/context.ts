/**
 * Minimal local service contracts for the node half.
 * Deliberately NOT importing @deepseek-ai/* at runtime: an external plugin's
 * node half must not depend on the harness module graph (the profile resolves
 * only the plugin package itself). Shapes mirror the real cordis services the
 * profile provides (verified against dsh-genui's host plugin usage).
 */

export interface SystemPromptSection {
  name: string
  order: number
  text: string
}

export interface SystemPromptService {
  section(entry: SystemPromptSection): void
}

/** A registry whose `register` accepts a plain ToolDefinition-shaped object. */
export interface ToolsRegistry {
  register(tool: unknown): unknown
}

export interface ReflectService {
  get(name: string, required: false): unknown
}

export interface CredentialEntry {
  value?: string
}

export interface CredentialsService {
  resolve(ref: string): Promise<CredentialEntry | undefined>
}

export interface SettingsScope<T = Record<string, unknown>> {
  get(): T
  watch(callback: () => void): unknown
}

export interface SettingsService {
  register<T = Record<string, unknown>>(
    namespace: string,
    schema: unknown,
    options?: { base?: Record<string, unknown> }
  ): SettingsScope<T>
}

export interface PluginContext {
  systemPrompt: SystemPromptService
  settings: SettingsService
  reflect: ReflectService
  on(event: string, callback: (name: string, value: unknown) => void): () => void
}
