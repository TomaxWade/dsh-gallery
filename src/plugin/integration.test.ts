/**
 * 集成测试：本地 HTTP 服务模拟 Wikimedia/Openverse/GLM 三端，走工具的真实
 * execute 路径（含真实 fetch），验证成功与降级合同。node:test 每个文件
 * 独立进程，env 覆盖互不污染。
 */

import { createServer, type Server } from 'node:http'
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createImageSearchTool } from './tools.ts'
import { curateImages } from './vision.ts'

type ExecutableTool = { execute(args: unknown): Promise<string> }

const GLM_REPLY = [
  { index: 0, relevant: true, safety: true, caption: '霓虹城市夜景' },
  { index: 1, relevant: false, safety: true, caption: '一只猫' },
  { index: 2, relevant: true, safety: false, caption: '血腥场景' },
]

/** 1x1 透明 PNG */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

let server: Server
let base = ''

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (url.pathname.startsWith('/img/')) {
      const name = url.pathname.slice('/img/'.length)
      if (['a.png', 'b.png', 'c.png', 'thumb.png', 'original.png', 'a-thumb.png'].includes(name)) {
        res.setHeader('content-type', 'image/png')
        res.end(TINY_PNG)
      } else {
        res.statusCode = 404
        res.end('missing')
      }
      return
    }
    res.setHeader('content-type', 'application/json')
    if (url.pathname === '/wiki') {
      res.end(
        JSON.stringify({
          query: {
            pages: {
              '1': {
                title: 'File:Neon city.jpg',
                imageinfo: [
                  {
                    url: `${base}/img/original.png`,
                    thumburl: `${base}/img/thumb.png`,
                    descriptionurl: 'https://commons.example/wiki/File:Neon_city.jpg',
                    extmetadata: { ImageDescription: { value: '霓虹 <b>城市</b> 夜景' } },
                  },
                ],
              },
            },
          },
        })
      )
    } else if (url.pathname === '/openverse') {
      res.end(
        JSON.stringify({
          results: [
            {
              url: `${base}/img/a.png`,
              thumbnail: `${base}/img/a-thumb.png`,
              title: 'city night',
              creator: 'alice',
              foreign_landing_url: 'https://openverse.example/landing/a',
            },
          ],
        })
      )
    } else if (url.pathname === '/openverse-empty') {
      res.end(JSON.stringify({ results: [] }))
    } else if (url.pathname === '/wiki-empty') {
      res.end(JSON.stringify({ query: { pages: {} } }))
    } else if (url.pathname === '/bingcn') {
      res.setHeader('content-type', 'text/html')
      res.end(
        `<a class="iusc" m="{&quot;murl&quot;:&quot;https://img.example/a.png&quot;,&quot;turl&quot;:&quot;https://img.example/a-th.png&quot;,&quot;purl&quot;:&quot;https://cn.bing.example/p/a&quot;}">`
      )
    } else if (url.pathname === '/v1/chat/completions') {
      // 假 GLM：按实际收到的图片张数返回对应条数（base64 data URL 计数）
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8')
        const imageCount = (body.match(/data:image\//g) ?? []).length
        res.end(JSON.stringify({ choices: [{ message: { content: `\`\`\`json\n${JSON.stringify(GLM_REPLY.slice(0, imageCount))}\n\`\`\`` } }] }))
      })
      return
    } else {
      res.statusCode = 404
      res.end(JSON.stringify({ error: 'not found' }))
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address !== null && typeof address === 'object')
  base = `http://127.0.0.1:${address.port}`
  process.env.DSH_GALLERY_WIKIMEDIA_URL = `${base}/wiki`
  process.env.DSH_GALLERY_OPENVERSE_URL = `${base}/openverse`
  process.env.DSH_GALLERY_BINGCN_URL = `${base}/bingcn`
  process.env.DSH_GALLERY_VISION_BASE_URL = `${base}/v1`
  process.env.DSH_GALLERY_VISION_KEY = 'integration-test-key'
})

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
})

describe('image_search 集成（真实 fetch，假端点）', () => {
  it('wikimedia 源返回展示优化 url 与来源页', async () => {
    const tool = createImageSearchTool() as ExecutableTool
    const result = JSON.parse(await tool.execute({ query: 'neon city', source: 'wikimedia' }))
    assert.ok(Array.isArray(result.candidates))
    assert.equal(result.candidates.length, 1)
    assert.equal(result.candidates[0].url, `${base}/img/thumb.png`)
    assert.equal(result.candidates[0].source, 'Wikimedia Commons')
    assert.equal(result.candidates[0].desc, '霓虹 城市 夜景')
  })

  it('openverse 源返回候选', async () => {
    const tool = createImageSearchTool() as ExecutableTool
    const result = JSON.parse(await tool.execute({ query: 'city', source: 'openverse' }))
    assert.equal(result.candidates[0].source, 'Openverse')
    assert.equal(result.candidates[0].desc, 'by alice')
  })

  it('auto 源：wikimedia 非空时不再走 openverse', async () => {
    const tool = createImageSearchTool() as ExecutableTool
    const result = JSON.parse(await tool.execute({ query: 'neon', source: 'auto' }))
    assert.equal(result.candidates[0].source, 'Wikimedia Commons')
  })

  it('auto 源：海外双源为空时回退国内必应（免 key 兜底）', async () => {
    const savedWiki = process.env.DSH_GALLERY_WIKIMEDIA_URL
    const savedOpenverse = process.env.DSH_GALLERY_OPENVERSE_URL
    process.env.DSH_GALLERY_WIKIMEDIA_URL = `${base}/wiki-empty`
    process.env.DSH_GALLERY_OPENVERSE_URL = `${base}/openverse-empty`
    try {
      const tool = createImageSearchTool() as ExecutableTool
      const result = JSON.parse(await tool.execute({ query: 'blueberry', source: 'auto' }))
      assert.ok(Array.isArray(result.candidates))
      assert.equal(result.candidates.length, 1)
      assert.equal(result.candidates[0].source, 'Bing 图片')
      assert.equal(result.candidates[0].url, 'https://img.example/a-th.png')
      assert.equal(result.candidates[0].sourceUrl, 'https://cn.bing.example/p/a')
    } finally {
      process.env.DSH_GALLERY_WIKIMEDIA_URL = savedWiki
      process.env.DSH_GALLERY_OPENVERSE_URL = savedOpenverse
    }
  })
})

describe('vision_curate 集成（本地取图 → base64 → 假 GLM，真实 fetch）', () => {
  it('成功路径：结构化 relevant/safety/caption，剥掉围栏，映射回原始 index', async () => {
    const result = await curateImages(
      [
        { url: `${base}/img/a.png`, index: 0 },
        { url: `${base}/img/b.png`, index: 1 },
        { url: `${base}/img/c.png`, index: 2 },
      ],
      '赛博朋克夜景'
    )
    assert.ok(Array.isArray(result.results))
    assert.equal(result.results?.length, 3)
    assert.equal(result.results?.[0]?.index, 0)
    assert.equal(result.results?.[0]?.relevant, true)
    assert.equal(result.results?.[0]?.safety, true)
    assert.equal(result.results?.[0]?.caption, '霓虹城市夜景')
    assert.equal(result.results?.[1]?.relevant, false)
    assert.equal(result.results?.[2]?.safety, false)
  })

  it('部分图片取图失败：跳过失败项，剩余按原始 index 映射', async () => {
    const result = await curateImages(
      [
        { url: `${base}/img/missing.png`, index: 0 },
        { url: `${base}/img/a.png`, index: 1 },
        { url: `${base}/img/b.png`, index: 2 },
      ],
      '赛博朋克夜景'
    )
    assert.ok(Array.isArray(result.results))
    // 假 GLM 按出现顺序返回 3 条（缺失项已被跳过，实际只发送 2 张）→ 取前两条
    assert.equal(result.results?.length, 2)
    assert.equal(result.results?.[0]?.index, 1)
    assert.equal(result.results?.[1]?.index, 2)
  })
})
