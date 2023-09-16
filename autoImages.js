const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function main() {
  const localPageUrl = 'http://127.0.0.1:3000/';
  const screenshotPath1 = path.join(__dirname, 'screen', 'screen1.png');
  const screenshotPath2 = path.join(__dirname, 'screen', 'screen2.png');
  const screenshotPath3 = path.join(__dirname, 'screen', 'screen3.png');
  const screenshotPath4 = path.join(__dirname, 'screen', 'screen4.png');

  const browser = await puppeteer.launch({
    headless: 'false',
  });
  const page = await browser.newPage();

  await page.goto(localPageUrl);

  await page.waitForSelector('form');
  await page.waitForSelector('input');

  await page.setViewport({ width: 1200, height: 800 });

  await page.screenshot({ path: screenshotPath1 });

  await page.type('input', 'NickName');


  const buttonSelector = '.button';

  await page.waitForTimeout(200);
  await page.click(buttonSelector);

  await page.screenshot({ path: screenshotPath2 });

  await page.mouse.move(1200, 0);
  await page.waitForTimeout(1000);

  await page.screenshot({ path: screenshotPath3 });

  await page.mouse.move(1200, 0);
  await page.waitForTimeout(1000);

  await page.screenshot({ path: screenshotPath4 });

  await browser.close();
}

main().catch(console.error);
