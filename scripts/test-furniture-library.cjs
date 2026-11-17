// End-to-end check of the extended furniture library in the running app.
// Run with the dev server up (npm run dev): node scripts/test-furniture-library.cjs
const puppeteer = require('puppeteer-core')
const path = require('path')
const OUT = path.join(__dirname, '..', 'test-screenshots')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail) => {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

;(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--window-size=1400,900', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1400, height: 900 })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('dialog', (d) => d.accept())
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
  await wait(5000)
  const blank = await page.$('.header__blank-btn')
  if (blank) {
    await blank.click()
    await wait(1200)
  }

  // A room: 6 m × 4 m, walls 200 mm thick, centred on (0,0)-(6000,4000).
  const ok = await page.evaluate(async () => {
    const { usePlanStore } = await import('/src/store/planStore.ts')
    const st = usePlanStore.getState()
    if (!st.plan) return 'no plan'
    const wall = (id, a, b) => ({ id, a, b, thickness: 200, height: 2800 })
    const plan = {
      ...st.plan,
      walls: [wall('tw1', { x: 0, y: 0 }, { x: 6000, y: 0 }), wall('tw2', { x: 6000, y: 0 }, { x: 6000, y: 4000 }), wall('tw3', { x: 6000, y: 4000 }, { x: 0, y: 4000 }), wall('tw4', { x: 0, y: 4000 }, { x: 0, y: 0 })],
      openings: [],
      furniture: [],
    }
    st.commit(plan)
    st.setTool('select')
    const { fitCamera } = await import('/src/canvas/camera.ts')
    return 'ok'
  })
  check('setup room', ok === 'ok', ok)
  // Frame the room: scale so 6 m fits, origin at a known screen offset.
  await page.evaluate(async () => {
    const { usePlanStore } = await import('/src/store/planStore.ts')
    usePlanStore.getState().setCam({ x: 300, y: 200, scale: 0.12, rotation: 0 })
  })
  await wait(500)

  const toScreen = (p) =>
    page.evaluate((p) => {
      const stage = window.__canvasStage
      const q = stage.getAbsoluteTransform().point(p)
      const r = stage.container().getBoundingClientRect()
      return { x: r.left + q.x, y: r.top + q.y }
    }, p)
  const furniture = () =>
    page.evaluate(async () => {
      const { usePlanStore } = await import('/src/store/planStore.ts')
      return usePlanStore.getState().plan.furniture
    })
  const drop = async (type, world) => {
    const s = await toScreen(world)
    await page.evaluate(
      (type, s) => {
        const el = document.querySelector('.plan-canvas')
        const dt = new DataTransfer()
        dt.setData('text/x-furniture', type)
        el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, clientX: s.x, clientY: s.y, bubbles: true, cancelable: true }))
      },
      type,
      s,
    )
    await wait(300)
    const list = await furniture()
    return list[list.length - 1]
  }

  // 1. Drop a sofa 600 mm below the top wall: back should face the wall, flush with its face.
  let f = await drop('sofa', { x: 3000, y: 700 })
  check('drop sofa near top wall → rotation 0, flush (y = 100 + 475)', f && f.rotationDeg === 0 && f.y === 575, JSON.stringify(f && { x: f.x, y: f.y, rot: f.rotationDeg }))

  // 2. Drop a wardrobe near the right wall: should turn 90° and sit flush.
  f = await drop('wardrobe', { x: 5500, y: 2000 })
  check('drop wardrobe near right wall → rotation 90, flush (x = 5900 − 300)', f && f.rotationDeg === 90 && f.x === 5600, JSON.stringify(f && { x: f.x, y: f.y, rot: f.rotationDeg }))

  // 3. Drop a bed in the bottom-left corner: should go into the corner.
  f = await drop('bathtub', { x: 900, y: 3500 })
  check('drop bathtub near bottom wall → rotation 180, flush (y = 3900 − 375)', f && f.rotationDeg === 180 && f.y === 3525, JSON.stringify(f && { x: f.x, y: f.y, rot: f.rotationDeg }))

  // 4. Drag the sofa down 1 m with the mouse, then back up near the wall: it re-snaps flush.
  const sofa = (await furniture()).find((x) => x.type === 'sofa')
  let a = await toScreen({ x: sofa.x, y: sofa.y })
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  let b = await toScreen({ x: sofa.x + 500, y: sofa.y + 1000 })
  await page.mouse.move(b.x, b.y, { steps: 8 })
  b = await toScreen({ x: sofa.x + 500, y: sofa.y + 60 })
  await page.mouse.move(b.x, b.y, { steps: 8 })
  await page.mouse.up()
  await wait(300)
  f = (await furniture()).find((x) => x.type === 'sofa')
  check('drag sofa 60 mm off the wall → snaps back flush (y = 575), x on 50 mm grid', f.y === 575 && f.x % 50 === 0, JSON.stringify({ x: f.x, y: f.y }))

  // 5. Proportional resize of a round item via the SE corner handle (lockAspect).
  f = await drop('side-table', { x: 3000, y: 2200 })
  await wait(300)
  a = await toScreen({ x: f.x + 250, y: f.y + 250 })
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  b = await toScreen({ x: f.x + 250 + 400, y: f.y + 250 + 120 })
  await page.mouse.move(b.x, b.y, { steps: 8 })
  await page.mouse.up()
  await wait(300)
  f = (await furniture()).find((x) => x.type === 'side-table')
  check('round side table corner-resize keeps W = D', f.w && f.w === f.d && f.w > 500, JSON.stringify({ w: f.w, d: f.d }))

  // 6. Non-round item: east edge stretches width only; Alt+east keeps ratio.
  f = await drop('coffee-table', { x: 3000, y: 3000 })
  await wait(300)
  a = await toScreen({ x: f.x + 550, y: f.y })
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  b = await toScreen({ x: f.x + 550 + 400, y: f.y })
  await page.mouse.move(b.x, b.y, { steps: 8 })
  await page.mouse.up()
  await wait(300)
  f = (await furniture()).find((x) => x.type === 'coffee-table')
  check('coffee table east-edge stretch → W grows, D unchanged', f.w === 1500 && (f.d ?? 600) === 600, JSON.stringify({ w: f.w, d: f.d }))
  a = await toScreen({ x: f.x + f.w / 2, y: f.y })
  await page.keyboard.down('Alt')
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  b = await toScreen({ x: f.x + f.w / 2 + 500, y: f.y })
  await page.mouse.move(b.x, b.y, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await wait(300)
  const g = (await furniture()).find((x) => x.type === 'coffee-table')
  check('Alt + east edge keeps W:D ratio (1500:600)', Math.abs(g.w / g.d - 2.5) < 0.02 && g.w > 1500, JSON.stringify({ w: g.w, d: g.d }))

  // 7. Door width presets present in the toolbar select.
  await page.evaluate(async () => {
    const { usePlanStore } = await import('/src/store/planStore.ts')
    usePlanStore.getState().setTool('door')
  })
  await wait(300)
  const opts = await page.$$eval('.toolbar__material select option', (o) => o.map((x) => x.value))
  check('door presets include d600…d1000 and garage', ['d600', 'd700', 'd800', 'd900', 'd1000', 'garage'].every((v) => opts.includes(v)), opts.join(','))

  // 8. Place every new item on a showcase grid and screenshot 2D.
  const types = await page.evaluate(async () => {
    const { usePlanStore } = await import('/src/store/planStore.ts')
    const { FURNITURE_CATALOG } = await import('/src/furniture/catalog.ts')
    const fresh = ['bed-round', 'bedside-lamp', 'closet-built-in', 'dressing-table', 'sofa-2', 'coffee-table-round', 'side-table', 'rug', 'rug-round', 'media-console', 'floor-lamp', 'kitchen-l', 'kitchen-island', 'bar-counter', 'bar-stool', 'dining-square', 'bathtub-corner', 'jacuzzi', 'bathroom-counter', 'stairs', 'stairs-l', 'stairs-u', 'pillar', 'pillar-round', 'divider', 'car', 'tree', 'shrub', 'ceiling-fan']
    const st = usePlanStore.getState()
    st.setTool('select')
    const furniture = fresh.map((type, i) => ({ id: 'sx' + i, type, x: 8000 + (i % 6) * 5000, y: 0 + Math.floor(i / 6) * 5500, rotationDeg: 0 }))
    // A sofa on top of the rug to confirm the rug draws underneath.
    furniture.push({ id: 'sx-on-rug', type: 'coffee-table', x: 8000 + 3 * 5000, y: 5500, rotationDeg: 0 })
    st.commit({ ...st.plan, furniture: [...st.plan.furniture, ...furniture] })
    st.selectFurniture(null)
    st.setCam({ x: 20, y: 140, scale: 0.042, rotation: 0 })
    return FURNITURE_CATALOG.filter((d) => fresh.includes(d.type)).map((d) => d.name)
  })
  check('all new catalog entries have translated names', types.length === 29 && types.every((n) => !n.includes('furniture.items')), types.length + ' items')
  await wait(800)
  await page.screenshot({ path: OUT + '/app-2d.png' })

  // 9. Furniture panel shows the new categories.
  await page.evaluate(async () => {
    const { usePlanStore } = await import('/src/store/planStore.ts')
    usePlanStore.getState().setFurniturePanel(true)
  })
  await wait(500)
  const cats = await page.$$eval('.furniture-panel__group .eyebrow', (e) => e.map((x) => x.textContent))
  check('panel shows Stairs & structure and Outdoor groups', cats.includes('Stairs & structure') && cats.includes('Outdoor'), cats.join(' | '))
  await page.screenshot({ path: OUT + '/app-panel.png' })

  check('no page errors (API 404s ignored)', errors.filter((e) => !e.includes('404')).length === 0, errors.slice(0, 3).join(' || '))
  console.log(results.join('\n'))
  await browser.close()
})().catch((e) => {
  console.log(results.join('\n'))
  console.error('CRASH', e)
  process.exit(1)
})
