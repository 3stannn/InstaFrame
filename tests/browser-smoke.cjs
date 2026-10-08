const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
// Run against a local production server: node tests/browser-smoke.cjs http://localhost:3100
(async () => {
 const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
 try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(process.argv[2] || 'http://localhost:3100', { waitUntil: 'networkidle0' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.equal(await page.$eval('body', el => /Free Tier|Get License|Studio Pro/.test(el.innerText)), false);
  const click = async text => page.evaluate(text => [...document.querySelectorAll('button')].find(b => b.textContent.includes(text)).click(), text);
  await click('Device Mockups');
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Download PNG') && b.disabled));
  const png = await page.evaluate(() => {
   const c=document.createElement('canvas'); c.width=400; c.height=300;
   const x=c.getContext('2d'); x.fillStyle='#e04242'; x.fillRect(0,0,400,300); return c.toDataURL('image/png');
  });
  await page.evaluate(data => {
   const bytes=Uint8Array.from(atob(data.split(',')[1]), c=>c.charCodeAt(0));
   const input=document.querySelector('input[type=file]'); const transfer=new DataTransfer();
   transfer.items.add(new File([bytes], 'sample.png', {type:'image/png'})); input.files=transfer.files;
   input.dispatchEvent(new Event('change', {bubbles:true}));
  }, png);
  await page.waitForFunction(() => !!document.querySelector('img[alt="Device Mockup"]'));
  assert.deepEqual(await page.$eval('img[alt="Device Mockup"]', el=>[el.naturalWidth,el.naturalHeight]), [400,300]);
  const jpeg = await page.evaluate(async data => {
   const image = new Image(); image.src = data; await image.decode();
   const canvas = document.createElement('canvas'); canvas.width=image.width; canvas.height=image.height;
   canvas.getContext('2d').drawImage(image,0,0);return canvas.toDataURL('image/jpeg');
  }, png);
  await page.evaluate(data => {
   const bytes=Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0));
   const input=document.querySelector('input[type=file]');const transfer=new DataTransfer();
   transfer.items.add(new File([bytes],'sample.jpg',{type:'image/jpeg'}));input.files=transfer.files;
   input.dispatchEvent(new Event('change',{bubbles:true}));
  },jpeg);
  await page.waitForFunction(() => document.querySelector('img[alt="Device Mockup"]')?.src.startsWith('data:image/png'));
  await page.setViewport({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth), false, 'Mobile horizontal overflow');
  await page.setViewport({width:1440,height:1000});
  await click('Responsive Studio');
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.title.startsWith('Rotate to')).click());
  await page.waitForFunction(() => document.body.innerText.includes('852 × 393'));
  const dimensions = await page.evaluate(()=>JSON.parse(localStorage.getItem('instaframe_web_settings')).responsive.activeDevices[0]);
  assert.equal(dimensions.width,852); assert.equal(dimensions.height,393);
  const statuses = await page.evaluate(async () => {
   const invalid = await fetch('/api/screenshot', { method:'POST',headers:{'Content-Type':'application/json'},body:'null' });
   const privateTarget = await fetch('/api/screenshot', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'http://127.0.0.1/'}) });
   return [invalid.status, privateTarget.status];
  });
  assert.deepEqual(statuses,[400,403]);
  if (process.env.INSTAFRAME_SMOKE_LIVE_URL) {
   const result = await page.evaluate(async url => {
    const response = await fetch('/api/screenshot', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,presetKey:'iphone-15',customW:852,customH:393,useCustomDimensions:true,captureQuality:'preview',settleDelay:0}) });
    const body = await response.json();
    return {status:response.status,success:body.success,width:body.width,height:body.height,png:body.screenshotBase64?.startsWith('data:image/png;base64,'),error:body.error};
   },process.env.INSTAFRAME_SMOKE_LIVE_URL);
   assert.equal(result.status,200,result.error); assert.equal(result.success,true);assert.equal(result.png,true);
   assert.equal(result.width,852);assert.equal(result.height,393);
   console.log('Live screenshot service passed at rotated viewport dimensions.');
  }
  const requests = [];
  await page.setRequestInterception(true);
  page.on('request', request => {
   if (request.url().includes('/api/screenshot')) {
    const body = JSON.parse(request.postData()); requests.push(body);
    request.respond({ status:200, contentType:'application/json', body:JSON.stringify({ success:true, screenshotBase64:png, width:body.customW, height:body.customH, fullHeight:body.customH, deviceScaleFactor:1 }) });
   } else if (request.url().includes('/api/check-embed')) {
    request.respond({status:200,contentType:'application/json',body:JSON.stringify({canEmbed:true,isRestricted:false})});
   } else if (request.url().startsWith('https://example.com/')) {
    request.respond({status:200,contentType:'text/html',body:'<html><body>Preview fixture</body></html>'});
   } else request.continue();
  });
  const navigate = async path => {
   await page.evaluate(path=>{
    const input=document.querySelector('form input');
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(input,'https://example.com/'+path);input.dispatchEvent(new Event('input',{bubbles:true}));
   },path);
   await click('Go');
  };
  await navigate('PageOne');
  await click('Snapshot');
  await page.waitForFunction(() => document.querySelectorAll('img[alt$="Snapshot"]').length === 2);
  assert.equal(requests[0].customW,852); assert.equal(requests[0].customH,393); assert.equal(requests[0].useCustomDimensions,true);
  const count=requests.length;
  await page.evaluate(()=>document.querySelector('button[title="Reload viewport"]').click());
  await page.waitForFunction(count=>document.querySelectorAll('img[alt$="Snapshot"]').length===2,count);
  await page.waitForFunction(() => !document.body.innerText.includes('Rendering high-fidelity preview...'));
  await navigate('PageTwo');
  await page.waitForFunction(() => document.querySelectorAll('img[alt$="Snapshot"]').length === 2);
  assert.ok(requests.length>count);
  assert.ok(requests.some(request=>request.url==='https://example.com/PageTwo'));
  assert.deepEqual(errors, []);
  console.log('Browser smoke checks passed: desktop/mobile layout, free features, empty export, image upload, rotation, persistence, snapshot mode, exact capture dimensions, reload and page navigation.');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
