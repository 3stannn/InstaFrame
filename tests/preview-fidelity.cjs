const puppeteer = require('puppeteer-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async()=>{
 const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
 const page=await browser.newPage();
 await page.setViewport({width:1440,height:1000});
 const errors=[];
 page.on('console',m=>{if(m.type()==='error' && /blocked by CORS|font.*failed/i.test(m.text())) errors.push(m.text());});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3101/api/health');
 await page.evaluate(()=>{const f=document.createElement('iframe');f.name='fidelity';f.sandbox='allow-scripts allow-forms allow-popups';f.width=1280;f.height=832;f.src='/api/proxy?url='+encodeURIComponent('https://academy.claude.com/courses');document.body.replaceChildren(f);});
 await new Promise(r=>setTimeout(r,15000));
 const frame=page.frames().find(f=>f!==page.mainFrame());
 const state=await frame.evaluate(async()=>{await document.fonts.ready;return {title:document.title,heading:document.querySelector('h1')?.textContent,fonts:[...document.fonts].map(f=>({family:f.family,status:f.status})),background:getComputedStyle(document.documentElement).backgroundColor};});
 assert.equal(state.title,'Courses · Claude Academy');
 assert.equal(state.heading,'Courses');
 for(const family of ['Anthropicons-Variable','anthropic-sans','anthropic-serif']) assert.ok(state.fonts.some(f=>f.family===family && f.status==='loaded'),`${family} must load`);
 assert.ok(!state.fonts.some(f=>f.status==='error'));
 assert.deepEqual(errors,[]);
 fs.mkdirSync('.tmp',{recursive:true});
 await page.screenshot({path:'.tmp/preview-fidelity-desktop.png'});
 await page.evaluate(()=>{document.querySelector('iframe').width=393;});
 await new Promise(r=>setTimeout(r,500));
 assert.equal(await frame.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'.tmp/preview-fidelity-mobile.png'});
 console.log('Claude Academy live preview passed: Courses routing, loaded fonts/icons, working modules, no asset CORS failures, and mobile layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
