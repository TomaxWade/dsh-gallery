/**
 * 浏览器验收：在隔离的真实 Chromium 页面中验证 DOM 围栏渲染器。
 * Playwright 解析顺序：本仓库 node_modules 的 playwright → 环境变量
 * PLAYWRIGHT_PATH 指向的已安装 playwright；两者都无则报错退出。
 * 断言：
 *   1. 静态合法围栏 → 卡片挂载、原块隐藏、标题与未筛选徽标渲染
 *   2. 非法 JSON → 保持普通代码块（不接管、不隐藏）
 *   3. 动态注入块（MutationObserver 路径）→ 卡片出现，且只保留 https 图
 *   4. 点击缩略图 → lightbox 出现（caption/来源），Escape 关闭
 */

import { copyFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  const external = process.env.PLAYWRIGHT_PATH
  if (external === undefined || external.length === 0) {
    console.error('未找到 playwright：请 `pnpm add -D playwright`，或设置 PLAYWRIGHT_PATH 指向已安装的 playwright 包目录')
    process.exit(2)
  }
  ;({ chromium } = await import(pathToFileURL(`${external.replace(/\\+$/, '')}/index.mjs`).href))
}

const outDir = new URL('../output/browser-test/', import.meta.url)
mkdirSync(outDir, { recursive: true })
copyFileSync(new URL('../tests/browser/fixture.html', import.meta.url), new URL('fixture.html', outDir))
const fixtureUrl = new URL('fixture.html', outDir).href
let passed = 0
let failed = 0

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  ✔ ${name}`)
  } else {
    failed += 1
    console.log(`  ✘ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto(fixtureUrl)
  await page.waitForFunction(() => window.__ModuleLoader__ !== undefined)
  await page.waitForFunction(() => window.__DSH_TEST_PLUGIN_APPLIED__ === true, null, { timeout: 5000 })

  // 1. 静态合法块
  await page.waitForFunction(
    () => {
      const next = document.querySelector('#static-valid')?.nextElementSibling
      return next !== null && next !== undefined && next.querySelector('img') !== null
    },
    null,
    { timeout: 5000 }
  )
  const staticBlock = page.locator('#static-valid')
  const cardAfter = page.locator('#static-valid + *')
  check('静态块：卡片容器挂载在原块之后', await cardAfter.count() === 1)
  check('静态块：原代码块被隐藏', (await staticBlock.evaluate((el) => el.style.display)) === 'none')
  check(
    '静态块：卡片标题与未筛选徽标渲染',
    (await cardAfter.textContent()).includes('静态卡片') && (await cardAfter.textContent()).includes('未筛选')
  )
  const staticThumbs = cardAfter.locator('img')
  check('静态块：2 张 https 缩略图渲染', (await staticThumbs.count()) === 2, `count=${await staticThumbs.count()}`)

  // 2. 非法 JSON 块
  const invalidBlock = page.locator('#static-invalid')
  check('非法块：未被接管（无 PROCESSED 属性）', (await invalidBlock.getAttribute('data-dsh-gallery-rendered')) === null)
  check('非法块：未被隐藏', (await invalidBlock.evaluate((el) => el.style.display)) !== 'none')

  // 3. 动态注入块
  await page.waitForFunction(() => document.querySelectorAll('#dynamic-slot > *').length >= 2, null, { timeout: 5000 })
  const dynamicCard = page.locator('#dynamic-slot .md-code-block + *')
  check('动态块：MutationObserver 路径挂载卡片', (await dynamicCard.count()) === 1)
  check('动态块：标题渲染', (await dynamicCard.textContent()).includes('动态卡片'))
  const dynamicThumbs = dynamicCard.locator('img')
  check('动态块：只保留 https 图（1 张）', (await dynamicThumbs.count()) === 1, `count=${await dynamicThumbs.count()}`)

  // 4. lightbox 交互
  await dynamicThumbs.first().click()
  const overlayVisible = await page.evaluate(() => {
    const overlays = Array.from(document.querySelectorAll('div')).filter((el) => el.style.position === 'fixed')
    return overlays.some((el) => el.textContent?.includes('手绘 UI'))
  })
  check('点击缩略图：lightbox 出现（caption 渲染）', overlayVisible)
  await page.keyboard.press('Escape')
  const overlayGone = await page.evaluate(() => {
    const overlays = Array.from(document.querySelectorAll('div')).filter((el) => el.style.position === 'fixed')
    return !overlays.some((el) => el.textContent?.includes('手绘 UI'))
  })
  check('Escape：lightbox 关闭', overlayGone)

  // 5. 移动端视口（375px）：卡片行可横向滚动，点按放大可用
  const mobile = await browser.newPage({ viewport: { width: 375, height: 800 }, hasTouch: true })
  await mobile.goto(fixtureUrl)
  await mobile.waitForFunction(
    () => {
      const next = document.querySelector('#static-valid')?.nextElementSibling
      return next !== null && next !== undefined && next.querySelector('img') !== null
    },
    null,
    { timeout: 5000 }
  )
  const mobileCard = mobile.locator('#static-valid + *')
  const scroll = await mobileCard.evaluate((card) => {
    const row = Array.from(card.querySelectorAll('div')).find((el) => getComputedStyle(el).overflowX === 'auto')
    return row ? { scrollWidth: row.scrollWidth, clientWidth: row.clientWidth } : null
  })
  check('移动端：卡片行横向可滚动（scrollWidth > clientWidth）', scroll !== null && scroll.scrollWidth > scroll.clientWidth, JSON.stringify(scroll))
  await mobileCard.locator('img').first().tap()
  const mobileOverlay = await mobile.evaluate(() => {
    const overlays = Array.from(document.querySelectorAll('div')).filter((el) => el.style.position === 'fixed')
    return overlays.some((el) => el.textContent?.includes('展示面板'))
  })
  check('移动端：点按缩略图 lightbox 出现', mobileOverlay)
  await mobile.close()

  // 6. 页面无 JS 错误
  check('页面无 JS 错误', errors.length === 0, errors.slice(0, 3).join(' | '))

  // 证据截图（gitignored）
  await page.screenshot({ path: fileURLToPath(new URL('evidence.png', outDir)), fullPage: true })
} finally {
  await browser.close()
}

console.log(`\nbrowser test: ${passed} passed / ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
