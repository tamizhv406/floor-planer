// Duplicate (Ctrl+D) and room sets. Run with npm run dev up: node scripts/test-furniture-sets.cjs
const puppeteer = require('puppeteer-core')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const res = []
const check = (n, ok, d) => res.push(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`)
;(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
  const page = await browser.newPage()
  await page.setViewport({ width: 1400, height: 900 })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('dialog', (d) => d.accept())
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__canvasStage, { timeout: 30000 })
  await wait(3000)
  const store = (src, arg) => page.evaluate(async (src, arg) => new Function('st', 'arg', src)((await import('/src/store/planStore.ts')).usePlanStore.getState(), arg), src, arg)
  await store(`
    st.commit({ ...st.plan, walls: [], openings: [], furniture: [{ id: 'c1', type: 'chair', x: 1000, y: 1000, rotationDeg: 0 }, { id: 'p1', type: 'pillar', x: 3000, y: 1000, rotationDeg: 90 }] })
    st.setTool('select'); st.selectFurniture('c1')
    st.setCam({ x: 300, y: 200, scale: 0.05, rotation: 0 })
  `)
  await wait(400)
  await page.click('body', { offset: { x: 700, y: 880 } }).catch(() => {})
  await store(`st.selectFurniture('c1')`)
  await page.keyboard.down('Control'); await page.keyboard.press('d'); await page.keyboard.up('Control')
  await wait(300)
  let s = await store(`return { f: st.plan.furniture, sel: st.selectedFurnitureId }`)
  let copy = s.f.find((x) => x.id === s.sel)
  check('Ctrl+D copies one chair beside it (x + 450)', s.f.length === 3 && copy && copy.type === 'chair' && copy.x === 1450 && copy.y === 1000, JSON.stringify(copy))
  await page.keyboard.down('Control'); await page.keyboard.press('d'); await page.keyboard.up('Control')
  await wait(300)
  s = await store(`return { f: st.plan.furniture, sel: st.selectedFurnitureId }`)
  copy = s.f.find((x) => x.id === s.sel)
  check('repeat Ctrl+D makes a row (x + 900)', copy && copy.x === 1900, JSON.stringify(copy && { x: copy.x }))
  // Rotated item: copies along its own width axis.
  await store(`st.selectFurniture('p1')`)
  await page.keyboard.down('Control'); await page.keyboard.press('d'); await page.keyboard.up('Control')
  await wait(300)
  s = await store(`return { f: st.plan.furniture, sel: st.selectedFurnitureId }`)
  copy = s.f.find((x) => x.id === s.sel)
  check('rotated 90° item copies along its width (y + 400)', copy && copy.x === 3000 && copy.y === 1400 && copy.rotationDeg === 90, JSON.stringify(copy && { x: copy.x, y: copy.y, rot: copy.rotationDeg }))

  // Room set by click in the panel.
  await store(`st.commit({ ...st.plan, furniture: [] }); st.selectFurniture(null); st.setFurniturePanel(true)`)
  await wait(500)
  const names = await page.$$eval('.furniture-panel__group:first-of-type .furniture-panel__name', (e) => e.map((x) => x.textContent))
  check('panel shows 6 room sets first', names.length === 6, names.join(', '))
  await page.evaluate(() => [...document.querySelectorAll('.furniture-panel__item')].find((x) => x.textContent.includes('Bedroom set')).click())
  await wait(500)
  s = await store(`return { f: st.plan.furniture, group: st.group }`)
  check('Bedroom set placed (7 items) and selected as a group', s.f.length === 7 && s.group && s.group.furniture.length === 7, `${s.f.length} items, group ${s.group && s.group.furniture.length}`)
  const groupIds = s.group.furniture
  // Duplicate the group with Ctrl+D.
  await page.keyboard.down('Control'); await page.keyboard.press('d'); await page.keyboard.up('Control')
  await wait(300)
  s = await store(`return { f: st.plan.furniture, group: st.group }`)
  const orig = s.f.filter((x) => groupIds.includes(x.id))
  const dup = s.f.filter((x) => s.group.furniture.includes(x.id))
  const dx = dup[1].x - orig[1].x
  check('Ctrl+D on group copies the whole set side by side', s.f.length === 14 && dup.length === 7 && dx > 2000 && dup.every((d, i) => d.x - orig[i].x === dx && d.y === orig[i].y), `dx ${dx}`)

  // Drop a room set onto the canvas.
  await store(`st.commit({ ...st.plan, furniture: [] }); st.setGroup(null); st.setFurniturePanel(false)`)
  await wait(300)
  await page.evaluate(() => {
    const el = document.querySelector('.plan-canvas')
    const dt = new DataTransfer()
    dt.setData('text/x-room-template', 'kitchen')
    el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, clientX: 700, clientY: 450, bubbles: true, cancelable: true }))
  })
  await wait(400)
  s = await store(`return { f: st.plan.furniture, group: st.group }`)
  check('drop Kitchen set → 6 items as a group', s.f.length === 6 && s.group && s.group.furniture.length === 6, `${s.f.length} items`)

  check('no JS errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  console.log(res.join('\n'))
  await browser.close()
})().catch((e) => { console.log(res.join('\n')); console.error('CRASH', e); process.exit(1) })
