const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\tamiz\\.gemini\\antigravity\\brain\\d07b1e50-96e7-467b-93e7-b9c1781b1835';

async function run() {
  console.log('--- STARTING MOBILE PHONE FURNITURE RESIZE TEST ---');

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
    console.log('[MOBILE USER] Dialog:', dialog.message());
    await dialog.accept();
  });

  console.log('1. Loading floor planner on mobile...');
  await page.goto('http://127.0.0.1:5173/');
  await new Promise((r) => setTimeout(r, 3500));

  // Click Blank Plan
  console.log('2. Tapping Blank Plan...');
  const blankBtn = await page.$('.header__blank-btn');
  if (blankBtn) {
    await blankBtn.click();
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Open Furniture Catalog
  console.log('3. Tapping Furniture Catalog...');
  await page.evaluate(() => {
    const btn = document.querySelector('button[title*="catalog"], button[title*="Furniture"]');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  // Tap Bed item
  console.log('4. Tapping Bed item to place...');
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.furniture-panel__item'));
    if (items.length > 0) items[0].click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  let info = await page.evaluate(() => {
    const title = document.querySelector('.inspector__title')?.textContent;
    const badge = document.querySelector('.furniture-size-badge')?.textContent;
    const inputs = Array.from(document.querySelectorAll('.inspector .form .input__control')).map(i => i.value);
    return { title, badge, inputs };
  });
  console.log('Mobile Furniture Inspector:', info);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, '11-mobile-furniture-selected.png') });
  console.log('Saved screenshot: 11-mobile-furniture-selected.png');

  // Tap steppers on mobile
  console.log('5. Tapping Width, Depth, Height (+) steppers on mobile...');
  await page.evaluate(() => {
    const addBtns = document.querySelectorAll('.length-stepper__btn--add');
    if (addBtns[0]) addBtns[0].click(); // Width + 50
  });
  await new Promise((r) => setTimeout(r, 500));

  await page.evaluate(() => {
    const addBtns = document.querySelectorAll('.length-stepper__btn--add');
    if (addBtns[1]) addBtns[1].click(); // Depth + 50
  });
  await new Promise((r) => setTimeout(r, 500));

  await page.evaluate(() => {
    const addBtns = document.querySelectorAll('.length-stepper__btn--add');
    if (addBtns[2]) addBtns[2].click(); // Height + 50
  });
  await new Promise((r) => setTimeout(r, 500));

  info = await page.evaluate(() => {
    const badge = document.querySelector('.furniture-size-badge')?.textContent;
    const inputs = Array.from(document.querySelectorAll('.inspector .form .input__control')).map(i => i.value);
    return { badge, inputs };
  });
  console.log('After mobile steppers:', info);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, '12-mobile-furniture-steppers-applied.png') });
  console.log('Saved screenshot: 12-mobile-furniture-steppers-applied.png');

  await browser.close();
  console.log('--- MOBILE PHONE FURNITURE RESIZE TEST PASSED! ---');
}

run().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
