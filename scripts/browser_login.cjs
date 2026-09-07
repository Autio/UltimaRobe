// Synthetic bundled-login check. Run in the test gateway's network namespace.
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage();
 await page.goto('http://ultimarobe.localhost:3000/login');
 await page.getByRole('button',{name:/SSO|sign in|log in/i}).first().click();
 await page.waitForURL(/identity/);
 const email=page.locator('input[type=email],input[name=login]');
 await email.first().fill('tester@example.org');
 await page.locator('input[type=password]').fill('Synthetic-test-only-03!');
 await page.getByRole('button',{name:/log.?in|sign.?in/i}).click();
 await page.waitForURL(/dashboard|onboarding/,{timeout:30000});
 const session=await page.request.get('http://ultimarobe.localhost:3000/api/auth/session');
 const data=await session.json();
 if(!data.accessToken)throw Error('OIDC callback did not create an authenticated backend session');
 console.log('PASS: browser → Dex password login → OIDC callback → authenticated application session');
 const headers={Authorization:'Bearer '+data.accessToken};
 if(process.env.EXPECT_RESTORED==='1'){
  const looks=await page.request.get('http://ultimarobe.localhost:3000/api/v1/outfits',{headers});
  const saved=await looks.json();
  if(!looks.ok()||!(saved.total>0))throw Error('Restored wardrobe has no saved outfits');
  console.log('PASS: original login identity and saved outfits survived backup and restore');
 }
 await page.request.post('http://ultimarobe.localhost:3000/api/v1/users/me/onboarding/complete',{headers});
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=80;c.height=100;const ctx=c.getContext('2d');for(let y=10;y<90;y+=10)for(let x=10;x<70;x+=10){ctx.fillStyle='#'+Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0');ctx.fillRect(x,y,10,10);}return c.toDataURL('image/png').split(',')[1];});
 const name='Browser shirt '+Date.now();
 const upload=await page.request.post('http://ultimarobe.localhost:3000/api/v1/items',{headers,multipart:{name,type:'top',skip_ai:'true',image:{name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')}}});
 if(upload.status()!==201)throw Error('Synthetic upload failed: '+upload.status());
 await page.goto('http://ultimarobe.localhost:3000/dashboard/inventory');
 const tile=page.getByRole('button',{name:'Equip '+name,exact:true});
 await tile.focus();await page.keyboard.press('Enter');
 await page.getByLabel('Outfit name',{exact:true}).fill('Browser-tested outfit '+Date.now());
 await page.getByRole('button',{name:/Save outfit/}).click();
 await page.getByRole('status').filter({hasText:/saved to your looks/}).waitFor({timeout:15000});
 console.log('PASS: synthetic garment upload, keyboard equipping, and saved outfit in the browser');
 await browser.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
