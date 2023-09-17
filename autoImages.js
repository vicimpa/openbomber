const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function main() {
  const localPageUrl = 'http://127.0.0.1:3000/';
  const screenshotPath1 = path.join(__dirname, 'screen', 'screen1.png');
  const screenshotPath2 = path.join(__dirname, 'screen', 'screen2.png');
  const screenshotPath3 = path.join(__dirname, 'screen', 'screen3.png');
  const screenshotPath4 = path.join(__dirname, 'screen', 'screen4.png');
  const screenshotPath5 = path.join(__dirname, 'screen', 'screen5.png');
  const screenshotPath6 = path.join(__dirname, 'screen', 'screen6.png');
  const screenshotPathPublic = path.join(__dirname, 'public/images', 'screen.png');


  const browser = await puppeteer.launch({
    headless: 'false',
  });
  const page = await browser.newPage();
  await page.goto(localPageUrl);
  await page.waitForTimeout(500);  

  
  await page.waitForSelector('form');
  await page.waitForSelector('input');

  await page.setViewport({ width: 1200, height: 800 });


  // write NickName 
  await page.type('input', 'nickname');
  await page.screenshot({ path: screenshotPath1 });

  const buttonSelector = 'form.restart > div.button';
  await page.waitForTimeout(100);


  await page.click(buttonSelector);
  await page.screenshot({ path: screenshotPath2 });
  await page.waitForTimeout(500);


  // left side
  await page.mouse.move(0, 0);

  await page.waitForTimeout(250);  
  await page.screenshot({ path: screenshotPath4 });

  // right side
  const RigthSelector = 'div.right';
  await page.click(RigthSelector);
  await page.waitForTimeout(250);  
  await page.screenshot({ path: screenshotPath3 });

  // select selector skins
  await page.waitForTimeout(300);
  const buttonSelector2 = 'div.restart > div.skins > div.skin-item';
  const buttonSelector3 = 'div.restart > div.button';

  // click into Skins and confim
  await page.click(buttonSelector2);
  await page.waitForTimeout(100);
  await page.click(buttonSelector3);

  await page.screenshot({ path: screenshotPath5 });


  // join into Game
  const buttonSelectorConfim = 'div.restart > div.scroll > div.button';
  await page.click(buttonSelectorConfim);
  const joinButton = 'div.footer > div.button';
  await page.click(joinButton);
  await page.waitForTimeout(1500);

  await page.screenshot({ path: screenshotPath6 });
  await page.screenshot({ path: screenshotPathPublic });

  await browser.close();
}

main().catch(console.error);
