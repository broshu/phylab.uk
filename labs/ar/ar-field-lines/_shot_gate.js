const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
  const p = await b.newPage();
  await p.setViewport({width: 900, height: 760, deviceScaleFactor: 1.5});
  await p.goto('file://'+process.cwd()+'/index.html', {waitUntil:'domcontentloaded'});
  await new Promise(r=>setTimeout(r,1200));
  const gate = await p.$('#gate');
  await gate.screenshot({path:'/tmp/gate.png'});
  await b.close(); console.log('ok');
})().catch(e=>{console.error(e.message);process.exit(1)});
