const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
const fs = require('node:fs');
const path = require('node:path');
const bridge = fs.readFileSync(path.join(__dirname, '../public/preview-bridge.js'), 'utf8').replace(/<\/script/gi, '<\\/script');

(async () => {
  const base = process.argv[2] || 'http://127.0.0.1:3101';
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    const errors = [];
    const logs = [];
    page.on("console",message=>logs.push(message.text()));
    const captures = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base, { waitUntil: 'networkidle0' });
    const png = await page.evaluate(() => { const c=document.createElement('canvas');c.width=1280;c.height=832;c.getContext('2d').fillRect(0,0,1280,832);return c.toDataURL('image/png'); });
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname === '/api/proxy') {
        const target = url.searchParams.get('url');
        const next = 'https://browse.example/details';
        const html = `<!doctype html><html><head><script>window.__INSTAFRAME_TARGET_URL__=${JSON.stringify(target)};</script><script data-allowed-origins="${base}">${bridge}</script></head><body style="margin:0;height:4000px"><h1>${target}</h1><a id="next" href="${base}/api/proxy?url=${encodeURIComponent(next)}">Next page</a><div style="margin-top:650px">Section to snap</div></body></html>`;
        request.respond({ status:200,contentType:'text/html',body:html });
      } else if (url.pathname === '/api/screenshot') {
        const params = JSON.parse(request.postData());captures.push(params);
        request.respond({ status:200,contentType:'application/json',body:JSON.stringify({success:true,screenshotBase64:png,width:1280,height:832,fullHeight:4000,deviceScaleFactor:1}) });
      } else request.continue();
    });
    const click = async text => page.evaluate(text => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === text).click(), text);
    await click('Device Mockups');
    await page.evaluate(() => {
      const input=document.querySelector('form[aria-label="Open live website"] input');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'https://browse.example/start');
      input.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await click('Open website');
    try {
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Snap view' && !button.disabled), { timeout:10000 });
    } catch (error) {
      console.log('Debug',await page.$eval('body',element=>element.innerText.slice(-1800)),logs,errors,page.frames().map(frame=>[frame.name(),frame.url()]));
      throw error;
    }
    const frame = page.frames().find(frame=>frame.name()==='instaframe-live-preview');
    assert.ok(frame);
    await frame.evaluate(() => document.querySelector('#next').click());
    await page.waitForFunction(() => document.querySelector('[data-testid="live-website-preview"]').innerText.includes('https://browse.example/details'), {timeout:10000}).catch(async error => { console.log('Navigation debug',logs,errors,page.frames().map(frame=>[frame.name(),frame.url()]));throw error; });
    await frame.evaluate(() => window.scrollTo(0,750));
    await new Promise(resolve=>setTimeout(resolve,60));
    await click('Snap view');
    await page.waitForFunction(() => !!document.querySelector('img[alt="Device Mockup"]'));
    assert.equal(captures.length,1);
    assert.equal(captures[0].url,'https://browse.example/details');
    assert.equal(captures[0].scrollY,750);
    assert.equal(captures[0].captureFullPage,false);
    await click('Live website');
    assert.equal(await frame.evaluate(()=>window.scrollY),750,'Browsing position must survive switching to the mockup');
    await page.setViewport({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);
    console.log('Live studio passed: interactive links, navigation tracking, scrolling, snap request, mockup output, preserved browsing position and mobile layout.');
    if (process.env.INSTAFRAME_TEST_REAL_WEBSITE) {
      page.removeAllListeners('request');
      await page.setRequestInterception(false);
      await page.reload({waitUntil:'networkidle0'});
      await click('Device Mockups');
      await page.evaluate(() => {
        const input=document.querySelector('form[aria-label="Open live website"] input');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'https://example.com');
        input.dispatchEvent(new Event('input',{bubbles:true}));
      });
      await click('Open website');
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Snap view' && !button.disabled),{timeout:10000}).catch(async error=>{console.log('Real preview debug',logs,errors,await page.frames().find(frame=>frame.name()==='instaframe-live-preview').evaluate(()=>document.body.innerText));throw error;});
      assert.ok(await page.frames().find(frame=>frame.name()==='instaframe-live-preview').evaluate(()=>document.body.innerText.length>100));
      console.log('Real website preview passed: proxy loading and live capture connection.');
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
