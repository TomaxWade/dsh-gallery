/**
 * DOM render channel for pristine hosts (stock rc.6 has no fence-registry):
 * observes the conversation DOM, finds settled stock code blocks labelled
 * `dsh-gallery` (`.md-code-block` surface, label leaf outside the `<pre>`),
 * parses the fence JSON and mounts the plugin's own React root next to the
 * hidden stock block. Pattern proven by dsh-genui's dom-fence; simplified:
 * no streaming partial takeover (a fence renders once its JSON parses), a 1s
 * sweep re-applies hides/updates that host re-renders may wipe.
 */

import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { GalleryCard, type GalleryPayload } from './GalleryCard.tsx'
import { parseFenceText } from '../shared/payload.ts'

const LANG = 'dsh-gallery'
const PROCESSED = 'data-dsh-gallery-rendered'
const SELECTORS = '.md-code-block, .code-block, .code-block-small'
const SWEEP_MS = 1000

interface Mount {
  root: Root
  container: HTMLElement
  block: HTMLElement
  lastRaw: string
}

const mounts: Mount[] = []

/** Language label: a leaf element with exactly the lang text, outside the `<pre>` body. */
function labelOf(block: Element): string {
  const pre = block.querySelector('pre')
  for (const el of block.querySelectorAll('*')) {
    if (el.childElementCount !== 0) continue
    if (pre !== null && pre.contains(el)) continue
    const text = el.textContent ?? ''
    if (text.trim() === LANG) return LANG
  }
  return ''
}

function rawOf(block: Element): string {
  return block.querySelector('pre')?.textContent ?? ''
}

/** Parse the fence body and whitelist it; null keeps the stock code block. */
function payloadOf(block: Element): GalleryPayload | null {
  return parseFenceText(rawOf(block))
}

/** Mount the card beside a stock block (hidden) once its JSON parses. */
function takeOver(block: HTMLElement): void {
  if (block.hasAttribute(PROCESSED)) return
  const payload = payloadOf(block)
  if (payload === null) return
  const container = document.createElement('div')
  block.after(container)
  block.style.display = 'none'
  block.setAttribute(PROCESSED, '')
  const root = createRoot(container)
  root.render(React.createElement(GalleryCard, { payload }))
  mounts.push({ root, container, block, lastRaw: rawOf(block) })
}

function scan(scope: ParentNode = document): void {
  for (const el of scope.querySelectorAll<HTMLElement>(SELECTORS)) {
    if (el.parentElement !== null && el.parentElement.closest(SELECTORS) !== null) continue
    if (el.hasAttribute(PROCESSED)) continue
    if (labelOf(el) !== LANG) continue
    takeOver(el)
  }
}

/** Drop mounts whose stock block left the DOM (branch switch, message removed). */
function sweepRemoved(): void {
  for (let i = mounts.length - 1; i >= 0; i -= 1) {
    const mount = mounts[i]
    if (!document.contains(mount.block)) {
      mount.root.unmount()
      mount.container.remove()
      mounts.splice(i, 1)
    }
  }
}

/** Re-apply hides wiped by host re-renders, and update parsed payloads. */
function sweepUpdates(): void {
  for (const mount of mounts) {
    if (mount.block.style.display !== 'none') mount.block.style.display = 'none'
    if (!mount.block.hasAttribute(PROCESSED)) mount.block.setAttribute(PROCESSED, '')
    const raw = rawOf(mount.block)
    if (raw === mount.lastRaw) continue
    mount.lastRaw = raw
    const payload = payloadOf(mount.block)
    if (payload !== null) mount.root.render(React.createElement(GalleryCard, { payload }))
  }
}

export function installDomFenceRenderer(): () => void {
  if (typeof document === 'undefined') return () => {}
  const observer = new MutationObserver(() => scan(document))
  observer.observe(document.body, { childList: true, subtree: true })
  const sweep = setInterval(() => {
    sweepRemoved()
    sweepUpdates()
    scan(document)
  }, SWEEP_MS)
  scan(document)
  return () => {
    observer.disconnect()
    clearInterval(sweep)
    for (const mount of mounts.splice(0)) {
      mount.root.unmount()
      mount.container.remove()
      mount.block.style.display = ''
      mount.block.removeAttribute(PROCESSED)
    }
  }
}
