/**
 * dsh-gallery browser half: installs the DOM fence renderer for
 * ```dsh-gallery and the "视觉模型" settings section (with credential
 * wiring via the connection service).
 */

import * as React from 'react'
import { installDomFenceRenderer } from './dom-fence.tsx'
import { VisionSettingsSection, type CredentialsWire, type SettingsWire } from './settings.tsx'

interface SlotsRegistry {
  inject(name: string, factory: () => unknown): unknown
  register(options: Record<string, unknown>, component: unknown): unknown
}

interface SlotsService {
  inject(name: string, factory: () => unknown): unknown
}

interface ConnectionService {
  api: {
    credentials: CredentialsWire
    settings: SettingsWire
  }
}

interface ClientContext {
  slots: SlotsService
  connection: ConnectionService
}

export const inject = ['slots', 'connection']

export function apply(ctx: ClientContext): () => void {
  const disposers: Array<() => void> = []
  if (typeof document !== 'undefined') {
    console.info('[dsh-gallery] DOM fence renderer installed')
    disposers.push(installDomFenceRenderer())
  }
  const credentials = ctx.connection?.api?.credentials
  const settings = ctx.connection?.api?.settings
  ctx.slots.inject('settings.section', () =>
    (ctx.slots as unknown as SlotsRegistry).register(
      { name: 'settings.section', id: 'dsh-gallery-vision', order: 90, label: '视觉模型' },
      () => React.createElement(VisionSettingsSection, { credentials, settings })
    )
  )
  return () => {
    for (const dispose of disposers) dispose()
  }
}
