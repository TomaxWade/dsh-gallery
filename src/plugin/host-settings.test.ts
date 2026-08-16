import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { apply, Config, inject, SETTINGS_NAMESPACE } from './index.ts'
import type { PluginContext, SettingsScope } from './context.ts'
import { DEFAULT_RUNTIME_SETTINGS, getRuntimeSettings, setRuntimeSettings, type RuntimeSettings } from './runtime-config.ts'

describe('宿主设置接入', () => {
  it('向 host settings 注册 Gallery 命名空间，而不等待浏览器专用 settingsScope', () => {
    const expectedSettings: RuntimeSettings = {
      visionBaseURL: 'https://settings.example/v1',
      visionModel: 'settings-model',
      maxCandidates: 9,
      sourcesWikimedia: false,
      sourcesOpenverse: true,
      sourcesBingCn: true,
    }
    const sections: Array<{ name: string; order: number; text: string }> = []
    let registration: { namespace: string; schema: unknown } | undefined
    let watchCalls = 0
    const scope: SettingsScope<Partial<RuntimeSettings>> = {
      get: () => expectedSettings,
      watch: () => {
        watchCalls += 1
      },
    }
    const context: PluginContext = {
      systemPrompt: { section: (entry) => sections.push(entry) },
      settings: {
        register: <T = Record<string, unknown>>(namespace: string, schema: unknown): SettingsScope<T> => {
          registration = { namespace, schema }
          return scope as SettingsScope<T>
        },
      },
      reflect: { get: () => undefined },
      on: () => () => {},
    }

    try {
      apply(context)
      assert.deepEqual(inject, ['systemPrompt', 'settings'])
      assert.deepEqual(registration, { namespace: SETTINGS_NAMESPACE, schema: Config })
      assert.deepEqual(sections.map(({ name, order }) => ({ name, order })), [{ name: 'gallery:fence', order: 106 }])
      assert.equal(watchCalls, 1)
      assert.deepEqual(getRuntimeSettings(), expectedSettings)
    } finally {
      setRuntimeSettings(DEFAULT_RUNTIME_SETTINGS)
    }
  })
})
