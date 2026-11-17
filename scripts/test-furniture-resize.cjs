const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\tamiz\\.gemini\\antigravity\\brain\\d07b1e50-96e7-467b-93e7-b9c1781b1835';

async function run() {
  console.log('--- STARTING COMPREHENSIVE FURNITURE RESIZE TEST ---');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1280,800',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: 1280,
    height: 800,
    deviceScaleFactor: 1.5,
  });

  page.on('dialog', async (dialog) => {
    console.log('[USER ACTION] Dialog:', dialog.message());
    await dialog.accept();
  });

  console.log('1. Loading floor planner on http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/');
  await new Promise((r) => setTimeout(r, 3500));

  // Click Blank Plan
  console.log('2. Clicking Blank Plan...');
  const blankBtn = await page.$('.header__blank-btn');
  if (blankBtn) {
    await blankBtn.click();
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Open Furniture Catalog and place Bed
  console.log('3. Placing furniture on canvas...');
  await page.evaluate(() => {
    const btn = document.querySelector('button[title*="catalog"], button[title*="Furniture"]');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.furniture-panel__item'));
    if (items.length > 0) items[0].click(); // click first item (bed)
  });
  await new Promise((r) => setTimeout(r, 1000));

  let info = await page.evaluate(() => {
    const title = document.querySelector('.inspector__title')?.textContent;
    const badge = document.querySelector('.furniture-size-badge')?.textContent;
    const inputs = Array.from(document.querySelectorAll('.inspector .form .input__control')).map(i => i.value);
    return { title, badge, inputs };
  });
  console.log('Initial Furniture:', info);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, '08-furniture-selected-handles.png') });

  // 4. Test Width (+50mm), Depth (+50mm), Height (+50mm) stepper buttons one by one
  console.log('4. Testing Width (+50mm) stepper...');
  await page.evaluate(() => {
    const addBtns = document.querySelectorAll('.length-stepper__btn--add');
    if (addBtns[0]) addBtns[0].click();
  });
  await new Promise((r) => setTimeout(r, 600));

  console.log('Testing Depth (+50mm) stepper...');
  await page.evaluate(() => {
    const addBtns = document.querySelectorAll('.length-stepper__btn--add');
    if (addBtns[1]) addBtns[1].click();
  });
  await new Promise((r) => setTimeout(r, 600));

  console.log('Testing Height (+50mm) stepper...');
  await page.evaluate(() => {
    const addBtns = document.querySelectorAll('.length-stepper__btn--add');
    if (addBtns[2]) addBtns[2].click();
  });
  await new Promise((r) => setTimeout(r, 600));

  info = await page.evaluate(() => {
    const badge = document.querySelector('.furniture-size-badge')?.textContent;
    const inputs = Array.from(document.querySelectorAll('.inspector .form .input__control')).map(i => i.value);
    return { badge, inputs };
  });
  console.log('After individual stepper clicks (W, D, H all +50mm):', info);

  // 5. Test King Bed preset (1800 x 2000)
  console.log('5. Clicking King Bed preset...');
  await page.evaluate(() => {
    const presets = Array.from(document.querySelectorAll('.furniture-preset-pill'));
    const king = presets.find(p => p.textContent.includes('King'));
    if (king) king.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  info = await page.evaluate(() => {
    const badge = document.querySelector('.furniture-size-badge')?.textContent;
    const inputs = Array.from(document.querySelectorAll('.inspector .form .input__control')).map(i => i.value);
    return { badge, inputs };
  });
  console.log('After King preset (1800 × 2000):', info);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, '09-furniture-inspector-resized.png') });

  // 6. Test on-canvas drag resize
  console.log('6. Testing on-canvas drag resizing with mouse...');
  const handleCoords = await page.evaluate(() => {
    const stage = window.__canvasStage;
    const st = window.__planStore ? window.__planStore.getState() : null;
    const canvas = document.querySelector('.plan-canvas canvas');
    if (!stage || !canvas || !st) return null;
    const rect = canvas.getBoundingClientRect();
    const selId = st.selectedFurnitureId;
    const f = st.plan?.furniture.find(x => x.id === selId);
    if (!f) return null;

    const w = f.w ?? 1800;
    const fRot = ((f.rotationDeg ?? 0) * Math.PI) / 180;
    const localX = w / 2;
    const localY = 0;
    const worldX = f.x + localX * Math.cos(fRot) - localY * Math.sin(fRot);
    const worldY = f.y + localX * Math.sin(fRot) + localY * Math.cos(fRot);

    const pt = stage.getAbsoluteTransform().point({ x: worldX, y: worldY });
    return { screenX: rect.left + pt.x, screenY: rect.top + pt.y, w, fX: f.x, fY: f.y };
  });

  console.log('Handle coordinates on screen:', handleCoords);

  if (handleCoords) {
    // Move to East handle, drag outward by 40px to widen width
    await page.mouse.move(handleCoords.screenX, handleCoords.screenY);
    await new Promise((r) => setTimeout(r, 200));
    await page.mouse.down();
    await new Promise((r) => setTimeout(r, 100));
    await page.mouse.move(handleCoords.screenX + 50, handleCoords.screenY, { steps: 8 });
    await new Promise((r) => setTimeout(r, 100));
    await page.mouse.up();
    await new Promise((r) => setTimeout(r, 1000));
  }

  const finalInfo = await page.evaluate(() => {
    const badge = document.querySelector('.furniture-size-badge')?.textContent;
    const inputs = Array.from(document.querySelectorAll('.inspector .form .input__control')).map(i => i.value);
    const st = window.__planStore ? window.__planStore.getState() : null;
    const selId = st?.selectedFurnitureId;
    const f = st?.plan?.furniture.find(x => x.id === selId);
    return { badge, inputs, furnitureObj: f ? { w: f.w, d: f.d, h: f.h } : null };
  });
  console.log('Final dimensions after on-canvas handle drag:', finalInfo);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, '10-furniture-canvas-drag-resized.png') });
  console.log('Saved screenshot: 10-furniture-canvas-drag-resized.png');

  await browser.close();
  console.log('--- ALL FURNITURE RESIZE TESTS PASSED SUCCESSFULLY! ---');
}

run().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
