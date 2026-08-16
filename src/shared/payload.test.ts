import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseFenceText, parsePayload } from './payload.ts'

describe('parsePayload（围栏白名单解析）', () => {
  it('接受合法载荷并保留已知字段', () => {
    const payload = parsePayload({
      title: '参考图',
      filtered: true,
      images: [
        {
          url: 'https://example.com/a.jpg',
          alt: '图 A',
          caption: '一句话',
          source: 'Wikimedia Commons',
          sourceUrl: 'https://commons.example/a',
        },
      ],
    })
    assert.ok(payload !== null)
    assert.equal(payload.title, '参考图')
    assert.equal(payload.images.length, 1)
    assert.equal(payload.images[0]?.source, 'Wikimedia Commons')
  })

  it('丢弃非 https 的 url', () => {
    const payload = parsePayload({
      images: [
        { url: 'http://insecure.example/a.jpg' },
        { url: 'data:image/png;base64,xxx' },
        { url: 'file:///C:/a.jpg' },
        { url: 'https://ok.example/b.jpg' },
      ],
    })
    assert.equal(payload?.images.length, 1)
    assert.equal(payload?.images[0]?.url, 'https://ok.example/b.jpg')
  })

  it('最多保留 8 张', () => {
    const images = Array.from({ length: 12 }, (_, i) => ({ url: `https://example.com/${i}.jpg` }))
    const payload = parsePayload({ images })
    assert.equal(payload?.images.length, 8)
  })

  it('全无效图返回 null（按代码块降级）', () => {
    assert.equal(parsePayload({ images: [{ url: 'not-a-url' }] }), null)
    assert.equal(parsePayload('not json'), null)
    assert.equal(parsePayload({ images: [] }), null)
    assert.equal(parsePayload(null), null)
  })

  it('filtered 仅在显式 false 时输出', () => {
    const base = { images: [{ url: 'https://e.com/a.jpg' }] }
    assert.equal(parsePayload(base)?.filtered, undefined)
    assert.equal(parsePayload({ ...base, filtered: false })?.filtered, false)
    assert.equal(parsePayload({ ...base, filtered: true })?.filtered, undefined)
  })
})

describe('parseFenceText（围栏文本入口，回归：曾把文本误当对象导致静默不挂载）', () => {
  it('合法 JSON 文本返回载荷', () => {
    const payload = parseFenceText('{"title":"T","images":[{"url":"https://e.com/a.jpg"}]}')
    assert.equal(payload?.title, 'T')
    assert.equal(payload?.images.length, 1)
  })

  it('非法 JSON 文本返回 null（降级为普通代码块）', () => {
    assert.equal(parseFenceText('{broken'), null)
    assert.equal(parseFenceText(''), null)
  })

  it('全无效图返回 null', () => {
    assert.equal(parseFenceText('{"images":[{"url":"http://x/a.jpg"}]}'), null)
  })
})
