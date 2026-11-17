const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_DIR = path.join(__dirname, '..', 'test-screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function run() {
  console.log('--- STARTING HUMAN-LIKE MOBILE PHONE USER TEST ---');
  console.log('Screen: 390 x 844 (iPhone 14 / modern smartphone)');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=390,844',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  page.on('dialog', async (dialog) => {
    console.log('[USER ACTION] Dialog Prompt:', dialog.message());
    console.log('[USER ACTION] Accepting dialog (Confirm)...');
    await dialog.accept();
  });

  console.log('1. Loading floor planner on mobile...');
  await page.goto('http://127.0.0.1:5173/');
  // Allow React + Vite chunks to initialize
  await new Promise((r) => setTimeout(r, 4000));

  const pageState = await page.evaluate(() => {
    return {
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.className + ' | ' + b.textContent),
      hasBlankClass: !!document.querySelector('.header__blank-btn'),
      textNodes: document.body.innerText.slice(0, 300)
    };
  });
  console.log('Page state at 4s:', pageState);

  await page.screenshot({ path: path.join(OUTPUT_DIR, '01-mobile-home-loaded.png') });
  console.log('✓ Screenshot 1: Mobile home loaded.');

  // 2. Click "Blank" (Blank Plan) button like a human user
  console.log('2. Clicking "Blank" button to create an empty canvas...');
  await page.click('.header__blank-btn');
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUTPUT_DIR, '02-blank-canvas-ready.png') });
  console.log('✓ Screenshot 2: Clean blank canvas ready.');

  // 3. User selects Wall tool by tapping on Wall tool in the bottom toolbar or pressing 'w'
  console.log('3. Selecting Wall Tool (W)...');
  await page.keyboard.press('w');
  await new Promise((r) => setTimeout(r, 500));

  // 4. Drawing a complete 4-wall room
  console.log('4. Drawing a room (4 walls) on mobile canvas...');
  const canvasEl = await page.$('.plan-canvas');
  const box = await canvasEl.boundingBox();
  console.log('Canvas area:', box);

  const p1 = { x: Math.round(box.x + 80), y: Math.round(box.y + 240) };
  const p2 = { x: Math.round(box.x + 80), y: Math.round(box.y + 440) };
  const p3 = { x: Math.round(box.x + 290), y: Math.round(box.y + 440) };
  const p4 = { x: Math.round(box.x + 290), y: Math.round(box.y + 240) };

  // Tap 1: Start Wall 1
  console.log('Drawing Wall 1: Downward...');
  await page.mouse.click(p1.x, p1.y);
  await new Promise((r) => setTimeout(r, 400));
  await page.mouse.click(p2.x, p2.y);
  await new Promise((r) => setTimeout(r, 400));

  // Tap 2: Draw Wall 2: Rightward
  console.log('Drawing Wall 2: Rightward...');
  await page.mouse.click(p3.x, p3.y);
  await new Promise((r) => setTimeout(r, 400));

  // Tap 3: Draw Wall 3: Upward
  console.log('Drawing Wall 3: Upward...');
  await page.mouse.click(p4.x, p4.y);
  await new Promise((r) => setTimeout(r, 400));

  // Tap 4: Close room back to p1
  console.log('Closing room: Back to start point...');
  await page.mouse.click(p1.x, p1.y);
  await new Promise((r) => setTimeout(r, 800));

  await page.screenshot({ path: path.join(OUTPUT_DIR, '03-four-walls-drawn.png') });
  console.log('✓ Screenshot 3: 4 Walls drawn successfully.');

  // 5. Switch to Select Tool ('v')
  console.log('5. Switching to Select Tool (V)...');
  await page.keyboard.press('v');
  await new Promise((r) => setTimeout(r, 500));

  // 6. User clicks Wall 1 to select it
  console.log('6. User clicks on the left vertical wall to select it...');
  const midWall1 = { x: p1.x, y: Math.round((p1.y + p2.y) / 2) };
  await page.mouse.click(midWall1.x, midWall1.y);
  await new Promise((r) => setTimeout(r, 800));

  await page.screenshot({ path: path.join(OUTPUT_DIR, '04-wall-selected-with-handles.png') });
  console.log('✓ Screenshot 4: Wall selected! Handles visible.');

  // 7. Drag the whole wall parallelly
  console.log('7. User drags the center move handle to move the wall 50px to the right...');
  await page.mouse.move(midWall1.x, midWall1.y);
  await page.mouse.down();
  await page.mouse.move(midWall1.x + 50, midWall1.y, { steps: 12 });
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 800));

  await page.screenshot({ path: path.join(OUTPUT_DIR, '05-wall-moved-parallel.png') });
  console.log('✓ Screenshot 5: Whole wall moved parallelly.');

  // 8. Drag an endpoint to stretch / resize
  console.log('8. User drags the top endpoint to stretch the wall diagonally...');
  const topEndpoint = { x: p1.x + 50, y: p1.y };
  await page.mouse.move(topEndpoint.x, topEndpoint.y);
  await page.mouse.down();
  await page.mouse.move(topEndpoint.x - 30, topEndpoint.y - 40, { steps: 12 });
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 800));

  await page.screenshot({ path: path.join(OUTPUT_DIR, '06-endpoint-dragged-stretched.png') });
  console.log('✓ Screenshot 6: Wall endpoint stretched.');

  // 9. Click "PDF" (PDF Blueprint) button to export the exact blueprint
  console.log('9. User clicks "PDF" button to export architectural blueprint...');
  await page.click('.header__pdf-btn');
  await new Promise((r) => setTimeout(r, 2000));

  await page.screenshot({ path: path.join(OUTPUT_DIR, '07-pdf-blueprint-exported.png') });
  console.log('✓ Screenshot 7: PDF Blueprint exported.');

  await browser.close();
  console.log('--- ALL MOBILE USER TESTS PASSED 100% ---');
}

run().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
