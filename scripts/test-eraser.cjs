// Eraser tool: desktop clicks + phone taps. Run with npm run dev up: node scripts/test-eraser.cjs

const puppeteer = require('puppeteer-core')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const res = []
const check = (n, ok, d) => res.push(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`)

async function setup(page) {
  page.on('dialog', (d) => d.accept())
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__canvasStage, { timeout: 30000 })
  await wait(6000)
  await page.evaluate(async () => {
    const { usePlanStore } = await import('/src/store/planStore.ts')
    const { useLayers } = await import('/src/networks/index.ts')
    useLayers.setState({ locks: { ...useLayers.getState().locks, walls: false, furniture: false, zones: false } })
    const st = usePlanStore.getState()
    const wall = (id, a, b) => ({ id, a, b, thickness: 200, height: 2800 })
    st.commit({
      ...st.plan,
      walls: [wall('w1', { x: 0, y: 0 }, { x: 5000, y: 0 }), wall('w2', { x: 5000, y: 0 }, { x: 5000, y: 4000 })],
      openings: [{ id: 'o1', wallId: 'w1', type: 'door', offset: 1000, width: 900, height: 2000, sill: 0, hinge: 'start', side: 'right' }, { id: 'o2', wallId: 'w2', type: 'window', offset: 1500, width: 1200, height: 1400, sill: 800 }],
      furniture: [{ id: 'sofa', type: 'sofa', x: 2500, y: 1500, rotationDeg: 0 }, { id: 'chair', type: 'chair', x: 1000, y: 3000, rotationDeg: 45 }],
      site: { ...st.plan.site, zones: [] },
    })
    st.selectFurniture(null)
    st.setTool('select')
    st.setCam({ x: 60, y: 200, scale: page_scale(), rotation: 0 })
    function page_scale() { return window.innerWidth < 500 ? 0.07 : 0.12 }
  })
  await wait(1500)
  // The app re-fits the view after a plan change; set ours afterwards.
  await page.evaluate(async () => {
    const { usePlanStore } = await import('/src/store/planStore.ts')
    usePlanStore.getState().setCam(window.innerWidth < 500 ? { x: 20, y: 200, scale: 0.07, rotation: 0 } : { x: 300, y: 260, scale: 0.12, rotation: 0 })
  })
  await wait(500)
}
const store = (page, src) => page.evaluate(async (src) => new Function('st', src)((await import('/src/store/planStore.ts')).usePlanStore.getState()), src)
const toScreen = (page, p) => page.evaluate((p) => { const s = window.__canvasStage; const q = s.getAbsoluteTransform().point(p); const r = s.container().getBoundingClientRect(); return { x: r.left + q.x, y: r.top + q.y } }, p)
const ids = (page) => store(page, `return { f: st.plan.furniture.map((x) => x.id), w: st.plan.walls.map((x) => x.id), o: st.plan.openings.map((x) => x.id) }`)

;(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
  const errors = []

  // ---------- Desktop ----------
  const page = await browser.newPage()
  await page.setViewport({ width: 1400, height: 900 })
  page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => m.text().includes('DBG') && console.log('D', m.text()))
  await setup(page)
  const btn = await page.evaluateHandle(() => [...document.querySelectorAll('button.tool')].find((b) => b.textContent.includes('Eraser')))
  check('toolbar has an Eraser button', !!(await btn.evaluate((b) => !!b)))
  await btn.click()
  await wait(200)
  check('Eraser button switches tool', (await store(page, `return st.tool`)) === 'erase')

  // Hover shows red highlight → screenshot.
  let p = await toScreen(page, { x: 2500, y: 1500 })
  await page.mouse.move(p.x, p.y)
  await wait(300)
  await page.screenshot({ path: require('path').join(__dirname, '..', 'test-screenshots', 'eraser-hover.png'), captureBeyondViewport: false })

  await page.mouse.click(p.x, p.y)
  await wait(300)
  let s = await ids(page)
  check('click sofa → sofa deleted', !s.f.includes('sofa') && s.f.includes('chair'), JSON.stringify(s))
  // Rotated chair (45°).
  p = await toScreen(page, { x: 1000, y: 3000 })
  await page.mouse.click(p.x, p.y)
  await wait(300)
  s = await ids(page)
  check('click rotated chair → deleted', !s.f.includes('chair'), JSON.stringify(s.f))
  // Door on wall 1: only the door goes.
  p = await toScreen(page, { x: 1450, y: 0 })
  await page.mouse.click(p.x, p.y)
  await wait(300)
  s = await ids(page)
  check('click door → only the door is deleted', !s.o.includes('o1') && s.w.includes('w1'), JSON.stringify(s))
  // Wall 2 (has a window): wall and its window go.
  p = await toScreen(page, { x: 5000, y: 600 })
  await page.mouse.click(p.x, p.y)
  await wait(300)
  s = await ids(page)
  check('click wall → wall and its window deleted', !s.w.includes('w2') && !s.o.includes('o2'), JSON.stringify(s))
  // Empty space: nothing changes.
  const before = JSON.stringify(await ids(page))
  p = await toScreen(page, { x: 2500, y: 2500 })
  await page.mouse.click(p.x, p.y)
  await wait(300)
  check('click empty space → nothing deleted', JSON.stringify(await ids(page)) === before)
  // Undo brings the wall back.
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control')
  await wait(300)
  s = await ids(page)
  check('Ctrl+Z restores the erased wall + window', s.w.includes('w2') && s.o.includes('o2'), JSON.stringify(s))
  // Locked furniture layer → toast, no delete.
  await store(page, `st.commit({ ...st.plan, furniture: [{ id: 'bed', type: 'bed-1600', x: 2500, y: 2000, rotationDeg: 0 }] })`)
  await page.evaluate(async () => { const { useLayers } = await import('/src/networks/index.ts'); useLayers.setState({ locks: { ...useLayers.getState().locks, furniture: true } }) })
  await wait(200)
  p = await toScreen(page, { x: 2500, y: 2000 })
  await page.mouse.click(p.x, p.y)
  await wait(400)
  s = await ids(page)
  const toast = await page.evaluate(() => document.body.innerText.match(/locked|Unlock/i)?.[0] ?? '')
  check('locked furniture is not erased and a toast explains why', s.f.includes('bed') && !!toast, `toast="${toast}"`)
  // Keyboard shortcut.
  await store(page, `st.setTool('select')`)
  await page.mouse.click(1300, 860).catch(() => {})
  await page.keyboard.press('e')
  await wait(200)
  check('E key selects the eraser', (await store(page, `return st.tool`)) === 'erase')
  await page.close()

  // ---------- Phone ----------
  const ph = await browser.newPage()
  await ph.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14) Mobile' })
  ph.on('pageerror', (e) => errors.push(String(e)))
  await setup(ph)
  await store(ph, `st.setTool('erase')`)
  await wait(300)
  const cdp = await ph.createCDPSession()
  const tap = async (pt) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y, id: 1 }] })
    await wait(50)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await wait(400)
  }
  // One-finger pan in erase mode must not delete.
  const cam0 = await store(ph, `return st.cam`)
  p = await toScreen(ph, { x: 2500, y: 1500 })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 1 }] })
  for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x + i * 8, y: p.y + i * 6, id: 1 }] }); await wait(16) }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await wait(400)
  s = await ids(ph)
  const cam1 = await store(ph, `return st.cam`)
  check('phone: finger pan in eraser mode moves the view, deletes nothing', s.f.includes('sofa') && (cam1.x !== cam0.x || cam1.y !== cam0.y), `cam ${Math.round(cam0.x)}→${Math.round(cam1.x)}`)
  p = await toScreen(ph, { x: 2500, y: 1500 })
  await tap(p)
  s = await ids(ph)
  check('phone: tap sofa → deleted', !s.f.includes('sofa'), JSON.stringify(s.f))
  await ph.screenshot({ path: require('path').join(__dirname, '..', 'test-screenshots', 'eraser-phone.png') })

  check('no JS errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  console.log(res.join('\n'))
  await browser.close()
})().catch((e) => { console.log(res.join('\n')); console.error('CRASH', e); process.exit(1) })
