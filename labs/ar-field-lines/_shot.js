const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  await page.setViewport({width: 820, height: 1160, deviceScaleFactor: 1.4});
  for (const name of ['dipole-sheet','quadrupole-sheet']) {
    await page.goto('file://' + process.cwd() + '/' + name + '.html', {waitUntil:'networkidle0'});
    const el = await page.$('.page');
    await el.screenshot({path: '/tmp/'+name+'.png'});
    console.log('shot', name);
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
