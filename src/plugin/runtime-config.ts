/**
 * Runtime settings store：宿主把 settingsScope 解析值与 env 合并后的
 * 权威配置（env 优先，其次 settings，最后默认）。vision/sources/tools
 * 在调用时读取，保证设置页改动热生效。
 */

export interface RuntimeSettings {
  visionBaseURL: string
  visionModel: string
  maxCandidates: number
  sourcesWikimedia: boolean
  sourcesOpenverse: boolean
  sourcesBingCn: boolean
}

export const DEFAULT_RUNTIME_SETTINGS: RuntimeSettings = {
  visionBaseURL: '',
  visionModel: 'glm-4.6v-flash',
  maxCandidates: 6,
  sourcesWikimedia: true,
  sourcesOpenverse: true,
  sourcesBingCn: true,
}

let current: RuntimeSettings = { ...DEFAULT_RUNTIME_SETTINGS }

export function setRuntimeSettings(partial: Partial<RuntimeSettings>): void {
  current = { ...current, ...partial }
}

export function getRuntimeSettings(): RuntimeSettings {
  return current
}

/** env 优先，settings 次之，默认兜底。 */
export function pickEnvThenSettings(env: Record<string, string | undefined>, envName: string, setting: string, fallback: string): string {
  const fromEnv = env[envName]
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv
  if (setting.length > 0) return setting
  return fallback
}
