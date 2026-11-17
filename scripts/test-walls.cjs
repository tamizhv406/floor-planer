// Wall drawing on phone (finger drag, tap-tap, Done) and desktop (click-click, drag). Run with npm run dev up: node scripts/test-walls.cjs

const puppeteer = require('puppeteer-core')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const res = []
const check = (n, ok, d) => res.push(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`)
;(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
  const page = await browser.newPage()
  await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14) Mobile' })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('dialog', (d) => d.accept())
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__canvasStage, { timeout: 30000 })
  await wait(6000)
  const store = (src) => page.evaluate(async (src) => new Function('st', src)((await import('/src/store/planStore.ts')).usePlanStore.getState()), src)
  await store(`st.commit({ ...st.plan, walls: [], openings: [], furniture: [], site: { ...st.plan.site, zones: [] } }); st.selectWall(null)`)
  await page.evaluate(async () => { const { useLayers } = await import('/src/networks/index.ts'); useLayers.setState({ locks: { ...useLayers.getState().locks, walls: false } }) })
  await wait(1500)
  await store(`st.setCam({ x: 40, y: 220, scale: 0.06, rotation: 0 }); st.setTool('wall')`)
  await wait(600)
  const cdp = await page.createCDPSession()
  const toScreen = (p) => page.evaluate((p) => { const s = window.__canvasStage; const q = s.getAbsoluteTransform().point(p); const r = s.container().getBoundingClientRect(); return { x: r.left + q.x, y: r.top + q.y } }, p)
  const walls = () => store(`return st.plan.walls.map((w) => [w.a.x, w.a.y, w.b.x, w.b.y].map(Math.round).join(','))`)
  const drag = async (a, b, steps = 12) => {
    const A = await toScreen(a), B = await toScreen(b)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: A.x, y: A.y, id: 1 }] })
    for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: A.x + ((B.x - A.x) * i) / steps, y: A.y + ((B.y - A.y) * i) / steps, id: 1 }] }); await wait(16) }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await wait(400)
  }
  const tap = async (p) => {
    const A = await toScreen(p)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: A.x, y: A.y, id: 1 }] })
    await wait(40)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await wait(400)
  }

  // 1. Finger drag from A to B should draw one wall.
  await drag({ x: 0, y: 0 }, { x: 4000, y: 0 })
  let w = await walls()
  check('finger drag draws a wall (0,0 → 4000,0)', w.length === 1 && w[0] === '0,0,4000,0', JSON.stringify(w))
  // 2. A second drag from the end continues the room (and doesn't chain from the old point).
  await drag({ x: 4000, y: 0 }, { x: 4000, y: 3000 })
  w = await walls()
  check('second drag draws the next wall from where the finger starts', w.length === 2 && w[1] === '4000,0,4000,3000', JSON.stringify(w))
  await page.screenshot({ path: require('path').join(__dirname, '..', 'test-screenshots', 'walls-phone-drag.png') })

  // 3. Tap-tap: a start marker is visible after the first tap, and a Done button ends the chain.
  await store(`st.commit({ ...st.plan, walls: [] })`)
  await wait(300)
  await tap({ x: 0, y: 4000 })
  const marker = await page.evaluate(() => window.__canvasStage.find('Circle').some((c) => c.getAttr('name') === 'wall-draft-start'))
  check('first tap shows a start-point marker', marker)
  await tap({ x: 3000, y: 4000 })
  await tap({ x: 3000, y: 6000 })
  w = await walls()
  check('tap-tap draws a chain (2 walls)', w.length === 2, JSON.stringify(w))
  const done = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Done|Finish/i.test(x.textContent))
    if (!b) return false
    b.click()
    return true
  })
  await wait(300)
  await tap({ x: 1000, y: 7000 })
  w = await walls()
  check('a Done button ends the chain (next tap starts fresh, no wall added)', done && w.length === 2, `done button ${done}, walls ${w.length}`)
  await page.screenshot({ path: require('path').join(__dirname, '..', 'test-screenshots', 'walls-phone-tap.png') })
  // ---------- Desktop (mouse) ----------
  const dp = await browser.newPage()
  await dp.setViewport({ width: 1400, height: 900 })
  dp.on('pageerror', (e) => errors.push(String(e)))
  dp.on('dialog', (d) => d.accept())
  await dp.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
  await dp.waitForFunction(() => window.__canvasStage, { timeout: 30000 })
  await wait(6000)
  const dstore = (src) => dp.evaluate(async (src) => new Function('st', src)((await import('/src/store/planStore.ts')).usePlanStore.getState()), src)
  await dstore(`st.commit({ ...st.plan, walls: [], openings: [], furniture: [], site: { ...st.plan.site, zones: [] } })`)
  await dp.evaluate(async () => { const { useLayers } = await import('/src/networks/index.ts'); useLayers.setState({ locks: { ...useLayers.getState().locks, walls: false } }) })
  await wait(1500)
  await dstore(`st.setCam({ x: 300, y: 250, scale: 0.08, rotation: 0 }); st.setTool('wall')`)
  await wait(500)
  const dS = (p) => dp.evaluate((p) => { const s = window.__canvasStage; const q = s.getAbsoluteTransform().point(p); const r = s.container().getBoundingClientRect(); return { x: r.left + q.x, y: r.top + q.y } }, p)
  const dW = () => dstore(`return st.plan.walls.map((w) => [w.a.x, w.a.y, w.b.x, w.b.y].map(Math.round).join(','))`)
  // click-click chain, Escape ends it
  for (const pt of [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }]) { const q = await dS(pt); await dp.mouse.click(q.x, q.y); await wait(500) }
  await dp.keyboard.press('Escape')
  await wait(200)
  let dw = await dW()
  check('desktop: click-click chain draws 2 walls, Esc ends', dw.length === 2 && dw[0] === '0,0,4000,0' && dw[1] === '4000,0,4000,3000', JSON.stringify(dw))
  // mouse drag draws a wall
  let q1 = await dS({ x: 0, y: 4000 }), q2 = await dS({ x: 3000, y: 4000 })
  await dp.mouse.move(q1.x, q1.y); await dp.mouse.down(); await dp.mouse.move(q2.x, q2.y, { steps: 10 }); await dp.mouse.up()
  await wait(300)
  await dp.keyboard.press('Escape')
  await wait(200)
  dw = await dW()
  check('desktop: mouse drag draws a wall', dw.includes('0,4000,3000,4000'), JSON.stringify(dw))
  // Done button also works on desktop
  q1 = await dS({ x: 6000, y: 0 }); await dp.mouse.click(q1.x, q1.y); await wait(250)
  const hasDone = await dp.evaluate(() => !![...document.querySelectorAll('button')].find((x) => /Done/.test(x.textContent)))
  check('desktop: Done button visible while drawing', hasDone)
  await dp.close()

  check('no JS errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  console.log(res.join('\n'))
  await browser.close()
})().catch((e) => { console.log(res.join('\n')); console.error('CRASH', e); process.exit(1) })
