/**
 * "视觉模型" 设置页：视觉模型 Key（credentials 服务，write-only）与
 * 图库筛选配置（settings 命名空间 dsh-gallery）。注册在 settings.section。
 */

import * as React from 'react'

const KEY_REF = 'DSH_GALLERY_VISION_KEY'
const NS = 'dsh-gallery'

export interface CredentialsWire {
  describe(args: { refs: string[] }): Promise<{
    result: { ok: boolean; value?: { credentials: Record<string, unknown> } }
  }>
  set(args: { ref: string; value: string }): Promise<{ result: { ok: boolean; error?: { message?: string } } }>
  unset(args: { ref: string }): Promise<{ result: { ok: boolean; error?: { message?: string } } }>
}

export interface SettingsWire {
  describe(args: Record<string, never>): Promise<{
    result: { ok: boolean; value?: { namespaces: Array<{ ns: string; revision: number; value?: Record<string, unknown> }> } }
  }>
  mutate(args: {
    ns: string
    ops: Array<{ op: 'set'; path: string[]; value: unknown }>
    expectedRevision: number
  }): Promise<{ result: { ok: boolean; error?: { message?: string }; value?: { revision: number } } }>
}

interface FormState {
  visionBaseURL: string
  visionModel: string
  maxCandidates: number
  sourcesWikimedia: boolean
  sourcesOpenverse: boolean
  sourcesBingCn: boolean
}

const FORM_DEFAULTS: FormState = {
  visionBaseURL: '',
  visionModel: 'glm-4.6v-flash',
  maxCandidates: 6,
  sourcesWikimedia: true,
  sourcesOpenverse: true,
  sourcesBingCn: true,
}

const STYLE: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 0', maxWidth: 560 },
  title: { fontSize: 15, fontWeight: 600 },
  card: {
    background: 'var(--dsw-alias-bg-module-platform, rgba(255,255,255,0.04))',
    borderRadius: 12,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontSize: 13,
    lineHeight: '20px',
    color: 'var(--dsw-alias-label-primary, #e5e7eb)',
  },
  muted: { color: 'var(--dsw-alias-label-secondary, #9ca3af)', fontSize: 12 },
  code: { fontFamily: 'var(--ds-font-family-code, monospace)', fontSize: 12 },
  warn: { color: '#d9b25f', fontSize: 12 },
  row: { display: 'flex', gap: 8, alignItems: 'center' },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, color: 'var(--dsw-alias-label-secondary, #9ca3af)' },
  input: {
    background: 'var(--dsw-specific-input-major, rgba(0,0,0,0.25))',
    border: '1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.12))',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 13,
    color: 'var(--dsw-alias-label-primary, #e5e7eb)',
  },
  button: {
    background: 'var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.1))',
    border: '1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.12))',
    borderRadius: 8,
    padding: '6px 14px',
    fontSize: 13,
    color: 'var(--dsw-alias-label-primary, #e5e7eb)',
    cursor: 'pointer',
  },
  status: { fontSize: 12, fontWeight: 600 },
}

function statusLabel(configured: boolean | null): { text: string; color: string } {
  if (configured === true) return { text: '已配置', color: '#6fbf8f' }
  if (configured === false) return { text: '未配置（筛选关闭，卡片将标注未筛选）', color: '#d9b25f' }
  return { text: '凭据状态不可读', color: '#9ca3af' }
}

interface SectionProps {
  credentials?: CredentialsWire
  settings?: SettingsWire
}

export function VisionSettingsSection({ credentials, settings }: SectionProps): React.ReactElement {
  const [configured, setConfigured] = React.useState<boolean | null>(null)
  const [keyValue, setKeyValue] = React.useState('')
  const [form, setForm] = React.useState<FormState>(FORM_DEFAULTS)
  const [revision, setRevision] = React.useState<number | null>(null)
  const [formLoaded, setFormLoaded] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (credentials !== undefined) {
      let cancelled = false
      credentials
        .describe({ refs: [KEY_REF] })
        .then((response) => {
          if (cancelled) return
          setConfigured(response.result.ok ? response.result.value?.credentials[KEY_REF] !== undefined : null)
        })
        .catch(() => {
          if (!cancelled) setConfigured(null)
        })
      return () => {
        cancelled = true
      }
    }
    return undefined
  }, [credentials])

  React.useEffect(() => {
    if (settings === undefined) return
    let cancelled = false
    settings
      .describe({})
      .then((response) => {
        if (cancelled || !response.result.ok) return
        const view = response.result.value?.namespaces.find((entry) => entry.ns === NS)
        if (view === undefined) return
        const value = view.value ?? {}
        setForm({
          visionBaseURL: typeof value.visionBaseURL === 'string' ? value.visionBaseURL : FORM_DEFAULTS.visionBaseURL,
          visionModel: typeof value.visionModel === 'string' ? value.visionModel : FORM_DEFAULTS.visionModel,
          maxCandidates: typeof value.maxCandidates === 'number' ? value.maxCandidates : FORM_DEFAULTS.maxCandidates,
          sourcesWikimedia: typeof value.sourcesWikimedia === 'boolean' ? value.sourcesWikimedia : FORM_DEFAULTS.sourcesWikimedia,
          sourcesOpenverse: typeof value.sourcesOpenverse === 'boolean' ? value.sourcesOpenverse : FORM_DEFAULTS.sourcesOpenverse,
          sourcesBingCn: typeof value.sourcesBingCn === 'boolean' ? value.sourcesBingCn : FORM_DEFAULTS.sourcesBingCn,
        })
        setRevision(view.revision)
        setFormLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setFormLoaded(false)
      })
    return () => {
      cancelled = true
    }
  }, [settings])

  const saveKey = async (): Promise<void> => {
    if (credentials === undefined || keyValue.trim().length === 0) return
    setBusy(true)
    setMessage(null)
    try {
      const response = await credentials.set({ ref: KEY_REF, value: keyValue.trim() })
      if (response.result.ok) {
        setConfigured(true)
        setKeyValue('')
        setMessage('已保存到本机凭据（write-only，不回显）')
      } else {
        setMessage(response.result.error?.message ?? '保存失败')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }

  const clearKey = async (): Promise<void> => {
    if (credentials === undefined) return
    setBusy(true)
    setMessage(null)
    try {
      const response = await credentials.unset({ ref: KEY_REF })
      if (response.result.ok) {
        setConfigured(false)
        setMessage('已清除')
      } else {
        setMessage(response.result.error?.message ?? '清除失败')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '清除失败')
    } finally {
      setBusy(false)
    }
  }

  const saveForm = async (): Promise<void> => {
    if (settings === undefined || revision === null) return
    setBusy(true)
    setMessage(null)
    try {
      const ops = [
        { op: 'set' as const, path: ['visionBaseURL'], value: form.visionBaseURL.trim() },
        { op: 'set' as const, path: ['visionModel'], value: form.visionModel.trim() },
        { op: 'set' as const, path: ['maxCandidates'], value: Math.min(12, Math.max(1, Math.round(form.maxCandidates))) },
        { op: 'set' as const, path: ['sourcesWikimedia'], value: form.sourcesWikimedia },
        { op: 'set' as const, path: ['sourcesOpenverse'], value: form.sourcesOpenverse },
        { op: 'set' as const, path: ['sourcesBingCn'], value: form.sourcesBingCn },
      ]
      const response = await settings.mutate({ ns: NS, ops, expectedRevision: revision })
      if (response.result.ok) {
        setRevision(response.result.value?.revision ?? revision)
        setMessage('设置已保存（即时生效）')
      } else {
        setMessage(response.result.error?.message ?? '保存失败（可能被其他改动抢先，请重试）')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }

  const status = statusLabel(configured)

  return (
    <div style={STYLE.root}>
      <div style={STYLE.title}>视觉模型（dsh-gallery）</div>

      <div style={STYLE.card}>
        <div style={STYLE.row}>
          <span>筛选模型 Key：</span>
          <span style={{ ...STYLE.status, color: status.color }}>{status.text}</span>
        </div>
        {credentials !== undefined ? (
          <>
            <div style={STYLE.row}>
              <input
                type="password"
                style={{ ...STYLE.input, flex: 1 }}
                placeholder="粘贴 API Key（仅存本机凭据，不回显）"
                value={keyValue}
                disabled={busy}
                onChange={(event) => setKeyValue(event.target.value)}
              />
              <button type="button" style={STYLE.button} disabled={busy || keyValue.trim().length === 0} onClick={() => void saveKey()}>
                保存
              </button>
              <button type="button" style={STYLE.button} disabled={busy} onClick={() => void clearKey()}>
                清除
              </button>
            </div>
          </>
        ) : (
          <div style={STYLE.warn}>凭据服务不可用：请改用环境变量 DSH_GALLERY_VISION_KEY 配置。</div>
        )}
        <div style={STYLE.warn}>启用筛选后，搜索到的图片会发送给你选择的模型厂商进行识别。</div>
      </div>

      <div style={STYLE.card}>
        <div style={{ fontWeight: 600 }}>筛选配置</div>
        {settings !== undefined && formLoaded ? (
          <>
            <div style={STYLE.field}>
              <span style={STYLE.label}>端点 Base URL（OpenAI 兼容，留空用默认）</span>
              <input
                type="text"
                style={STYLE.input}
                placeholder="https://open.bigmodel.cn/api/paas/v4"
                value={form.visionBaseURL}
                disabled={busy}
                onChange={(event) => setForm({ ...form, visionBaseURL: event.target.value })}
              />
            </div>
            <div style={STYLE.field}>
              <span style={STYLE.label}>模型名</span>
              <input
                type="text"
                style={STYLE.input}
                value={form.visionModel}
                disabled={busy}
                onChange={(event) => setForm({ ...form, visionModel: event.target.value })}
              />
            </div>
            <div style={STYLE.field}>
              <span style={STYLE.label}>每次搜索候选数（1-12）</span>
              <input
                type="number"
                min={1}
                max={12}
                style={STYLE.input}
                value={form.maxCandidates}
                disabled={busy}
                onChange={(event) => setForm({ ...form, maxCandidates: Number(event.target.value) || 1 })}
              />
            </div>
            <label style={STYLE.row}>
              <input
                type="checkbox"
                checked={form.sourcesWikimedia}
                disabled={busy}
                onChange={(event) => setForm({ ...form, sourcesWikimedia: event.target.checked })}
              />
              <span>Wikimedia Commons（CC 授权，免 key）</span>
            </label>
            <label style={STYLE.row}>
              <input
                type="checkbox"
                checked={form.sourcesOpenverse}
                disabled={busy}
                onChange={(event) => setForm({ ...form, sourcesOpenverse: event.target.checked })}
              />
              <span>Openverse（CC 授权，免 key）</span>
            </label>
            <label style={STYLE.row}>
              <input
                type="checkbox"
                checked={form.sourcesBingCn}
                disabled={busy}
                onChange={(event) => setForm({ ...form, sourcesBingCn: event.target.checked })}
              />
              <span>国内必应图搜（免 key，严格安全搜索；海外图源不可达时兜底）</span>
            </label>
            <div style={STYLE.row}>
              <button type="button" style={STYLE.button} disabled={busy} onClick={() => void saveForm()}>
                保存设置
              </button>
              {message !== null && <span style={STYLE.muted}>{message}</span>}
            </div>
          </>
        ) : (
          <div style={STYLE.muted}>
            设置服务不可用或未加载：以上字段可通过环境变量配置（DSH_GALLERY_VISION_BASE_URL / DSH_GALLERY_VISION_MODEL），图源默认全部启用。
          </div>
        )}
      </div>

      <div style={STYLE.card}>
        <div style={{ fontWeight: 600 }}>网络与代理</div>
        <div>
          <div style={STYLE.code}>DSH_GALLERY_HTTPS_PROXY</div>
          <div style={STYLE.muted}>图源直连不可达时使用的本地代理（环境变量，启动 dsh web 前设置；默认回退读 HTTPS_PROXY/HTTP_PROXY）</div>
        </div>
      </div>
    </div>
  )
}
