/* Actual Lite templates/controllers with synthetic fixtures and fully intercepted requests.
 * Run: node tests/js/account_midnight_qa.cjs (see ACCOUNT-QA.md for portable overrides).
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const os=require('node:os'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const options={};for(let i=2;i<process.argv.length;i+=2){assert(['--root','--output','--python','--browser'].includes(process.argv[i]),'Unknown option');assert(process.argv[i+1],'Missing option value');options[process.argv[i].slice(2)]=process.argv[i+1];}
const root=path.resolve(options.root||path.join(__dirname,'../..'));
const out=path.resolve(options.output||process.env.OMAKASE_ACCOUNT_QA_OUTPUT||fs.mkdtempSync(path.join(os.tmpdir(),'omakase-account-qa-')));fs.mkdirSync(out,{recursive:true});
const python=options.python||process.env.OMAKASE_QA_PYTHON||(()=>{const venv=path.join(root,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');return fs.existsSync(venv)?venv:process.platform==='win32'?'python':'python3';})();
const rendered=spawnSync(python,[path.join(__dirname,'render_account_midnight.py'),'--root',root,'--output',out],{encoding:'utf8',shell:false});assert.equal(rendered.status,0,rendered.stderr||rendered.error?.message||'Fixture renderer failed');
const modulePaths=[root,...(process.env.OMAKASE_QA_NODE_MODULES?[process.env.OMAKASE_QA_NODE_MODULES]:[])];
const {chromium}=require(require.resolve('playwright',{paths:modulePaths}));
const sourceSha256={};for(const rel of ['src/omakase/web/static/account.css','src/omakase/web/static/public-theme.css','src/omakase/web/static/geist-variable.woff2','src/omakase/web/static/account.js','src/omakase/web/static/account_state.js',...['account_base','login','invite','dashboard','admin_requests'].map(n=>'src/omakase/lite/templates/'+n+'.html')])sourceSha256[rel]=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex');
(async()=>{
 assert(fs.existsSync(path.join(root,'src/omakase/web/static/public-theme.css')),'Shared theme must exist before qualification');
 const executable=options.browser||process.env.OMAKASE_QA_BROWSER_EXECUTABLE;const channel=process.env.OMAKASE_QA_BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined);
 const browser=await chromium.launch({headless:true,...(executable?{executablePath:executable}:channel?{channel}:{} )});
 try {
 const ctx=await browser.newContext({reducedMotion:'reduce'});let writes=[],errors=[],expectedConsole=[],failProfile=false;
 await ctx.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname;
  if(url.origin!=='http://127.0.0.1:9138') {errors.push('Unexpected network origin');return route.abort();}
  if(req.method()!=='GET') {
   writes.push({path:p,method:req.method(),csrf:req.headers()['x-csrf-token']||req.postData()?.includes('csrf_token')});
   let data={},status=200;
   if(p==='/api/account/profile') {status=failProfile?500:200;}
   else if(p.startsWith('/api/account/provider-keys/')) data={provider:'openai',hint:'test'};
   else if(p==='/account/admin/invites') data={invite_url:'http://127.0.0.1:9138/account/invite#synthetic-one-time-code'};
   else {errors.push('Unexpected mutation '+p);status=405;}
   return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  }
  let file,contentType;
  if(p.startsWith('/static/')) {file=path.join(root,'src/omakase/web',p);contentType=p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':p.endsWith('.woff2')?'font/woff2':'image/svg+xml';}
  else {file=path.join(out,p.slice(1)+'.html');contentType='text/html';}
  assert(path.resolve(file).startsWith(path.resolve(p.startsWith('/static/')?path.join(root,'src/omakase/web/static'):out)+path.sep),'Fixture path escape');
  if(!fs.existsSync(file)) {errors.push('Missing fixture/static '+p);return route.fulfill({status:404,body:'Missing fixture'});}
  return route.fulfill({contentType,body:fs.readFileSync(file)});
 });
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'){if(failProfile&&m.text().includes('status of 500'))expectedConsole.push(m.text());else errors.push(m.text());}});
 const names=['login','login-error','invite','invite-error','dashboard','dashboard-empty','dashboard-connected','dashboard-long-name','admin-empty','admin'];let checks=[];
 async function geometry(name,width){
  const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,background:getComputedStyle(document.body).backgroundColor,font:getComputedStyle(document.body).fontFamily,unlabelled:[...document.querySelectorAll('input:not([type=hidden]),textarea,select')].filter(e=>!e.labels?.length&&!e.getAttribute('aria-labelledby')&&!e.getAttribute('aria-label')).length,smallControls:[...document.querySelectorAll('button,input:not([type=hidden]),select,summary')].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().height<43.9).map(e=>e.id||e.tagName),heading:!!document.querySelector('h1'),contrastFailures:(()=>{function lum(c){let a=c.match(/[0-9.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return a[0]*.2126+a[1]*.7152+a[2]*.0722}return [...document.querySelectorAll('h1,h2,h3,p,label,small,button,nav a,.status,summary')].filter(e=>e.getClientRects().length&&e.textContent.trim()).flatMap(e=>{let cs=getComputedStyle(e),bg=cs.backgroundColor,n=e;while(bg==='rgba(0, 0, 0, 0)'&&n.parentElement){n=n.parentElement;bg=getComputedStyle(n).backgroundColor}let a=lum(cs.color),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),threshold=parseFloat(cs.fontSize)>=24||parseFloat(cs.fontSize)>=18.66&&Number(cs.fontWeight)>=700?3:4.5;return ratio<threshold?[{tag:e.tagName,ratio}]:[]})})()}));
  assert.deepEqual(result.contrastFailures,[]);assert.equal(result.overflow,false,`${name}@${width} overflow`);assert.equal(result.unlabelled,0);assert.deepEqual(result.smallControls,[]);assert(result.heading);assert(result.font.includes('Geist'));assert.equal(result.background,'rgb(9, 11, 18)');
  const estimates=await page.locator('.recommendation-list li').evaluateAll(rows=>rows.filter(e=>e.getClientRects().length&&!e.closest('details:not([open])')).map(row=>{const score=row.querySelector(':scope > .model-estimate'),label=score?.querySelector('.model-estimate-label'),copy=row.querySelector(':scope > div');if(!score||!label||!copy)return {missing:true};const a=score.getBoundingClientRect(),b=copy.getBoundingClientRect(),style=getComputedStyle(label);return {label:label.innerText,score:score.innerText,labelHeight:label.getBoundingClientRect().height,labelFont:parseFloat(style.fontSize),overlap:Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1};}));
  for(const estimate of estimates){assert(!estimate.missing,`${name}: missing visible model-score label`);assert.equal(estimate.label,'Model estimate');assert(estimate.score.includes('/10'));assert(estimate.labelHeight>0&&estimate.labelFont>=14);assert.equal(estimate.overlap,false,`${name}@${width}: score/copy overlap`);}
  if(await page.locator('#watched-title').count()&&await page.locator('#watched-title').evaluate(e=>e.closest('section').querySelectorAll('li').length))assert((await page.locator('#watched-title').evaluate(e=>e.closest('section').innerText)).includes('Your rating 8/10'));
  checks.push({name,width,...result,visibleModelEstimates:estimates.length});
 }
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:1000});
  for(const name of names){await page.goto('http://127.0.0.1:9138/'+name);await page.evaluate(()=>document.fonts.ready);await geometry(name,width);if(['login','dashboard','admin','admin-empty','invite-error'].includes(name))await page.screenshot({path:path.join(out,`${name}-${width}.png`),fullPage:true});}
 }
 await page.setViewportSize({width:390,height:1000});await page.goto('http://127.0.0.1:9138/dashboard');await page.locator('#watched-title').evaluate(e=>e.closest('section').scrollIntoView());await page.screenshot({path:path.join(out,'watched-visible-scores-390.png')});await page.setViewportSize({width:1440,height:1000});await page.locator('#saved-title').evaluate(e=>e.closest('section').scrollIntoView());await page.screenshot({path:path.join(out,'saved-visible-scores-1440.png')});
 await page.setViewportSize({width:390,height:900});await page.goto('http://127.0.0.1:9138/login');await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').textContent(),'Skip to content');await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
 await page.goto('http://127.0.0.1:9138/dashboard-empty');await page.locator('#account-profile').fill('Synthetic taste note');await page.locator('#save-profile').click();await page.waitForFunction(()=>document.querySelector('#profile-status').textContent==='Saved');failProfile=true;await page.locator('#save-profile').click();await page.waitForFunction(()=>document.querySelector('#profile-status').textContent==='Could not save');
 await page.locator('#account-provider-credential').fill('synthetic-key-not-a-credential');await page.locator('#save-provider-key').click();await page.waitForFunction(()=>document.querySelector('#provider-key-status').textContent.includes('saved and encrypted'));assert.equal(await page.locator('#account-provider-credential').inputValue(),'');assert(await page.locator('#provider-key-list').isVisible());page.once('dialog',d=>d.accept());await page.locator('[data-forget-provider]').click();await page.waitForFunction(()=>!document.querySelector('#provider-key-empty').hidden);
 await page.goto('http://127.0.0.1:9138/admin-empty');await page.locator('#create-owner-invite').click();await page.locator('#owner-invite-result input').waitFor();await geometry('admin-generated',390);await page.screenshot({path:path.join(out,'admin-generated-390.png'),fullPage:true});
 await page.goto('http://127.0.0.1:9138/invite');await page.locator('[name=display_name]').fill('Synthetic member');await page.locator('[name=email]').fill('member@example.test');await page.locator('[name=password]').fill('synthetic-password');await page.locator('[name=confirm_password]').fill('synthetic-password');await page.locator('button[type=submit]').click();assert(await page.locator('#invite-client-error').isVisible());await geometry('invite-missing-code',390);
 await page.goto('http://127.0.0.1:9138/dashboard');const detail=page.locator('.history-run').nth(1);assert.equal(await detail.getAttribute('open'),null);await detail.locator('summary').click();assert.notEqual(await detail.getAttribute('open'),null);await geometry('history-expanded',390);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:9138/login');await page.screenshot({path:path.join(out,'login-desktop-initial.png')});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(out,'login-desktop-settled.png')});assert.equal(await page.locator('h1').evaluate(e=>getComputedStyle(e).opacity),'1');assert.equal(writes.length,5);assert(writes.every(x=>x.csrf));assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'browser-receipt.json'),JSON.stringify({browser:await browser.version(),sourceSha256,fixtureOnly:true,providerCalls:0,realWrites:0,mockedWrites:writes,checks,errors,expectedConsole},null,2));
 console.log(JSON.stringify({layouts:checks.length,mockedJourneyWrites:writes.length,errors:errors.length,out}));
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
