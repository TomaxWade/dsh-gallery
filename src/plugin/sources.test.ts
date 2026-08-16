import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseBingAsyncHtml, wikimediaPageToCandidate } from './sources.ts'

describe('wikimediaPageToCandidate（纯映射，图源合同）', () => {
  it('有缩略图时卡片 url 用 480px 缩略图，来源页用描述页', () => {
    const candidate = wikimediaPageToCandidate({
      title: 'File:Cyberpunk city.jpg',
      imageinfo: [
        {
          url: 'https://upload.wikimedia.org/wikipedia/commons/a/original-huge.jpg',
          thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/480px-thumb.jpg',
          descriptionurl: 'https://commons.wikimedia.org/wiki/File:Cyberpunk_city.jpg',
          extmetadata: { ImageDescription: { value: 'A <b>neon</b> city at night' } },
        },
      ],
    })
    assert.ok(candidate !== null)
    assert.equal(candidate?.url, 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/480px-thumb.jpg')
    assert.equal(candidate?.sourceUrl, 'https://commons.wikimedia.org/wiki/File:Cyberpunk_city.jpg')
    assert.equal(candidate?.title, 'Cyberpunk city')
    assert.equal(candidate?.desc, 'A neon city at night')
    assert.equal(candidate?.source, 'Wikimedia Commons')
  })

  it('无缩略图时回退原图 url', () => {
    const candidate = wikimediaPageToCandidate({
      title: 'File:A.svg',
      imageinfo: [{ url: 'https://upload.wikimedia.org/x/A.svg' }],
    })
    assert.equal(candidate?.url, 'https://upload.wikimedia.org/x/A.svg')
  })

  it('无 imageinfo 返回 null（跳过）', () => {
    assert.equal(wikimediaPageToCandidate({ title: 'File:Broken.jpg' }), null)
    assert.equal(wikimediaPageToCandidate({}), null)
  })
})

describe('parseBingAsyncHtml（国内必应图搜兜底解析）', () => {
  it('解析 m 属性（HTML 实体 JSON），取 murl/turl/purl', () => {
    const html =
      '<a class="iusc" m="{&quot;murl&quot;:&quot;https://img.example/a.jpg&quot;,&quot;turl&quot;:&quot;https://img.example/a-th.jpg&quot;,&quot;purl&quot;:&quot;https://cn.bing.com/p/a&quot;}">' +
      '<a class="iusc" m="{&quot;murl&quot;:&quot;https://img.example/b.jpg&quot;}">' +
      '<a class="iusc" m="broken json">'
    const entries = parseBingAsyncHtml(html)
    assert.equal(entries.length, 2)
    assert.equal(entries[0]?.murl, 'https://img.example/a.jpg')
    assert.equal(entries[0]?.turl, 'https://img.example/a-th.jpg')
    assert.equal(entries[0]?.purl, 'https://cn.bing.com/p/a')
    assert.equal(entries[1]?.murl, 'https://img.example/b.jpg')
  })

  it('无 m 属性或全损坏返回空数组', () => {
    assert.deepEqual(parseBingAsyncHtml('<div>no images</div>'), [])
  })
})
