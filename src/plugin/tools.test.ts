import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createImageSearchTool, createVisionCurateTool } from './tools.ts'

type ExecutableTool = { execute(args: unknown): Promise<string> }

describe('工具定义（不触网的失败路径）', () => {
  it('image_search：空 query 直接返回 empty_query，不触网', async () => {
    const tool = createImageSearchTool() as ExecutableTool
    const result = JSON.parse(await tool.execute({ query: '   ' }))
    assert.equal(result.error, 'empty_query')
  })

  it('vision_curate：空 topic 直接返回 empty_topic', async () => {
    const tool = createVisionCurateTool() as ExecutableTool
    const result = JSON.parse(await tool.execute({ images: [{ url: 'https://e.com/a.jpg' }], topic: '' }))
    assert.equal(result.error, 'empty_topic')
  })

  it('vision_curate：无有效 https 图时返回 no_valid_images，不触网', async () => {
    const tool = createVisionCurateTool() as ExecutableTool
    const result = JSON.parse(
      await tool.execute({
        images: [{ url: 'http://insecure/a.jpg' }, { url: 'not-a-url' }],
        topic: 'test',
      })
    )
    assert.equal(result.error, 'no_valid_images')
  })
})
