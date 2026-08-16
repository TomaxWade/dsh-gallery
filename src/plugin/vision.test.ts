import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getVisionConfig, resolveVisionConfig, setVisionKeyResolver, stripJsonFences } from './vision.ts'
import { setRuntimeSettings } from './runtime-config.ts'

describe('stripJsonFences', () => {
  it('剥掉 ```json 围栏', () => {
    assert.equal(stripJsonFences('```json\n[{"index":0}]\n```'), '[{"index":0}]')
    assert.equal(stripJsonFences('```\n[1]\n```'), '[1]')
  })

  it('无围栏时提取首个 JSON 数组', () => {
    assert.equal(stripJsonFences('好的，结果是：[{"a":1}] 结束'), '[{"a":1}]')
  })

  it('原样返回不含数组的文本（由 JSON.parse 报错处理）', () => {
    assert.equal(stripJsonFences('no json here'), 'no json here')
  })
})

describe('resolveVisionConfig', () => {
  it('无 key 时返回 null（筛选关闭）', () => {
    assert.equal(resolveVisionConfig({}), null)
    assert.equal(resolveVisionConfig({ DSH_GALLERY_VISION_KEY: '' }), null)
  })

  it('有 key 时采用默认端点和模型，并去除 baseURL 尾部斜杠', () => {
    const config = resolveVisionConfig({
      DSH_GALLERY_VISION_KEY: 'test-key',
      DSH_GALLERY_VISION_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4/',
    })
    assert.equal(config?.baseURL, 'https://open.bigmodel.cn/api/paas/v4')
    assert.equal(config?.model, 'glm-4.6v-flash')
  })

  it('尊重自定义模型', () => {
    const config = resolveVisionConfig({
      DSH_GALLERY_VISION_KEY: 'k',
      DSH_GALLERY_VISION_MODEL: 'doubao-seed-1.6',
    })
    assert.equal(config?.model, 'doubao-seed-1.6')
  })
})

describe('getVisionConfig（env → credentials 回退）', () => {
  it('无 env key 时回退到凭据解析器', async () => {
    const savedKey = process.env.DSH_GALLERY_VISION_KEY
    delete process.env.DSH_GALLERY_VISION_KEY
    setVisionKeyResolver(async () => 'credential-key')
    try {
      const config = await getVisionConfig()
      assert.equal(config?.key, 'credential-key')
      assert.equal(config?.model, 'glm-4.6v-flash')
    } finally {
      setVisionKeyResolver(undefined)
      if (savedKey !== undefined) process.env.DSH_GALLERY_VISION_KEY = savedKey
    }
  })

  it('env key 存在时优先 env，不调用解析器', async () => {
    const savedKey = process.env.DSH_GALLERY_VISION_KEY
    process.env.DSH_GALLERY_VISION_KEY = 'env-key'
    let resolverCalled = false
    setVisionKeyResolver(async () => {
      resolverCalled = true
      return 'credential-key'
    })
    try {
      const config = await getVisionConfig()
      assert.equal(config?.key, 'env-key')
      assert.equal(resolverCalled, false)
    } finally {
      setVisionKeyResolver(undefined)
      if (savedKey !== undefined) process.env.DSH_GALLERY_VISION_KEY = savedKey
      else delete process.env.DSH_GALLERY_VISION_KEY
    }
  })

  it('两者都无 → null（未配置）', async () => {
    const savedKey = process.env.DSH_GALLERY_VISION_KEY
    delete process.env.DSH_GALLERY_VISION_KEY
    setVisionKeyResolver(async () => undefined)
    try {
      assert.equal(await getVisionConfig(), null)
    } finally {
      setVisionKeyResolver(undefined)
      if (savedKey !== undefined) process.env.DSH_GALLERY_VISION_KEY = savedKey
    }
  })

  it('settings（设置页）提供端点与模型，key 来自 credentials', async () => {
    const savedKey = process.env.DSH_GALLERY_VISION_KEY
    delete process.env.DSH_GALLERY_VISION_KEY
    setRuntimeSettings({ visionBaseURL: 'https://settings.example/v1', visionModel: 'settings-model' })
    setVisionKeyResolver(async () => 'k')
    try {
      const config = await getVisionConfig()
      assert.equal(config?.baseURL, 'https://settings.example/v1')
      assert.equal(config?.model, 'settings-model')
      assert.equal(config?.key, 'k')
    } finally {
      setVisionKeyResolver(undefined)
      setRuntimeSettings({ visionBaseURL: '', visionModel: 'glm-4.6v-flash' })
      if (savedKey !== undefined) process.env.DSH_GALLERY_VISION_KEY = savedKey
    }
  })
})
