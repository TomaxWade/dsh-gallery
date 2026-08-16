/**
 * The horizontally scrollable image card: one row of thumbnails, tap to open
 * a lightbox with caption + source link. Inline styles only (no CSS build
 * step); all images are external https URLs with no-referrer to dodge
 * hotlink blocks.
 */

import * as React from 'react'
import { parsePayload, type GalleryImage, type GalleryPayload } from '../shared/payload.ts'

export type { GalleryImage, GalleryPayload }
export { parsePayload }

const CARD: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  maxWidth: 640,
  margin: '4px 0',
}

const HEADER: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--dsw-alias-label-primary, #e5e7eb)',
}

const BADGE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  padding: '1px 8px',
  borderRadius: 999,
  background: 'rgba(180,150,60,0.18)',
  color: '#d9b25f',
}

const ROW: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  overflowX: 'auto',
  overflowY: 'hidden',
  paddingBottom: 6,
  scrollbarWidth: 'thin',
}

const THUMB: React.CSSProperties = {
  height: 150,
  minWidth: 210,
  maxWidth: 260,
  objectFit: 'cover',
  borderRadius: 10,
  background: 'rgba(128,128,128,0.18)',
  cursor: 'zoom-in',
  flex: '0 0 auto',
  border: '1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.08))',
}

const OVERLAY: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  background: 'rgba(8,10,14,0.86)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  padding: '24px 16px',
  cursor: 'zoom-out',
}

const OVERLAY_IMG: React.CSSProperties = {
  maxWidth: '92%',
  maxHeight: '78vh',
  objectFit: 'contain',
  borderRadius: 8,
}

const CAPTION: React.CSSProperties = {
  color: '#e5e7eb',
  fontSize: 14,
  maxWidth: '92%',
  textAlign: 'center',
}

const SOURCE_LINK: React.CSSProperties = {
  color: '#8fb7e8',
  fontSize: 12,
  textDecoration: 'underline',
}

export function GalleryCard({ payload }: { payload: GalleryPayload }): React.ReactElement {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (openIndex === null) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpenIndex(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openIndex])

  const open = openIndex !== null ? payload.images[openIndex] : undefined

  return (
    <div style={CARD}>
      {payload.title !== undefined && (
        <div style={HEADER}>
          <span>{payload.title}</span>
          {payload.filtered === false && <span style={BADGE}>未筛选</span>}
        </div>
      )}
      <div style={ROW}>
        {payload.images.map((image, index) => (
          <img
            key={`${image.url.slice(0, 80)}:${index}`}
            src={image.url}
            alt={image.alt ?? image.caption ?? `图片 ${index + 1}`}
            title={image.caption ?? image.alt}
            loading="lazy"
            referrerPolicy="no-referrer"
            style={THUMB}
            onClick={() => setOpenIndex(index)}
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        ))}
      </div>
      {open !== undefined && (
        <div style={OVERLAY} onClick={() => setOpenIndex(null)}>
          <img
            src={open.url}
            alt={open.alt ?? open.caption ?? '原图'}
            referrerPolicy="no-referrer"
            style={OVERLAY_IMG}
            onClick={(event) => event.stopPropagation()}
          />
          {(open.caption !== undefined || open.source !== undefined) && (
            <div style={CAPTION} onClick={(event) => event.stopPropagation()}>
              {open.caption}
              {open.caption !== undefined && open.source !== undefined ? ' · ' : ''}
              {open.source}
            </div>
          )}
          {open.sourceUrl !== undefined && (
            <a
              style={SOURCE_LINK}
              href={open.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(event) => event.stopPropagation()}
            >
              查看来源
            </a>
          )}
        </div>
      )}
    </div>
  )
}
