import {inCharacterTab} from './workspaceTabs.js'
import {test,expect} from '@playwright/test'
import fs from 'node:fs/promises'
import {unzipSync,strFromU8} from 'fflate'

test('mount/pet preview and v1 ZIP restore actual horse/owl and run in Phaser',async({page})=>{
 test.setTimeout(90000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/')
 const mount=page.getByLabel('Thú cưỡi',{exact:true}),pet=page.getByLabel('Thú cưng',{exact:true})
 await expect(mount).toBeVisible({timeout:30000})
 await inCharacterTab(page,'Trang bị',()=>mount.selectOption('0'));await inCharacterTab(page,'Trang bị',()=>pet.selectOption('3'))
 await expect(page.getByRole('button',{name:'Chơi thử H5',exact:true})).toBeDisabled()
 await inCharacterTab(page,'Animation',()=>page.getByLabel('Trạng thái nhân vật',{exact:true}).selectOption('walk'))
 await inCharacterTab(page,'Animation',()=>page.getByRole('button',{name:'Tạm dừng',exact:true}).click())
 await expect(page.getByLabel('Tốc độ animation',{exact:true})).toHaveValue('25')
 const canvas=page.locator('.direction-views canvas').first()
 const before=await canvas.evaluate(c=>c.toDataURL())
 for(let i=0;i<4;i++)await inCharacterTab(page,'Animation',()=>page.getByRole('button',{name:'Frame tiếp →',exact:true}).click())
 await expect.poll(()=>canvas.evaluate((c,b)=>c.toDataURL()!==b,before)).toBe(true)
 await page.locator('.direction-views').screenshot({path:'/tmp/hso-mount-owl-preview.png'})
 const pending=page.waitForEvent('download')
 await page.getByRole('button',{name:'Xuất thư viện part',exact:true}).click()
 const zip=unzipSync(await fs.readFile(await(await pending).path()))
 const json=p=>JSON.parse(strFromU8(zip[p]))
 expect(json('character.json').companions).toEqual({mount:'0',pet:'3'})
 expect(zip['mounts/0/sheet.png']).toBeTruthy();expect(zip['pets/3/companion.json']).toBeTruthy()
 expect(json('library.json').companionAtlases).toHaveLength(34)
 for(const d of Object.values(json('library.json').companions.mount))expect(d.asset.density).toBe(4)
 await page.route('**/companion-smoke/**',route=>{
   const path=new URL(route.request().url()).pathname.replace('/companion-smoke/','')
   if(path==='index.html')return route.fulfill({contentType:'text/html',body:'<script type="module" src="/tests/companionHarness.js"></script>'})
   return route.fulfill({status:zip[path]?200:404,contentType:path.endsWith('.png')?'image/png':path.endsWith('.js')?'text/javascript':'application/json',body:zip[path]?Buffer.from(zip[path]):'missing'})
 })
 await page.goto('/companion-smoke/index.html')
 await expect.poll(()=>page.evaluate(()=>window.companionReady===true)).toBe(true)
 const result=await page.evaluate(()=>{
  const c=window.companionCharacter
  c.setState('walk','right');c.update(160)
  const initial={mount:c.companions.mount,pet:c.companions.pet,pants:c.images.get('pants').visible,seat:c.images.get('head').y,mountFlip:c.images.get('mount').flipX}
  let blocked=false;try{c.mount('99999')}catch{blocked=true}
  const retained=c.companions.mount
  c.mount(null);c.setPet(null);c.setState('idle','down')
  const removed={pants:c.images.get('pants').visible,mount:c.images.has('mount')}
  c.equipCompanionItem('mount',70);c.equipCompanionItem('pet',2944)
  const legacyManifest={...c.manifest};delete legacyManifest.companions;delete legacyManifest.companionAtlases
  const legacy=new c.constructor(c.scene,legacyManifest,{items:c.items},{states:c.animations},{equipment:c.outfit},0,0)
  const legacyWorks=legacy.images.size===Object.keys(c.outfit).length;legacy.destroy()
  return {initial,blocked,retained,removed,restored:c.companions,legacyWorks}
 })
 expect(result.initial).toMatchObject({mount:'0',pet:'3',pants:false,mountFlip:true})
 expect(result.legacyWorks).toBe(true)
 expect(result.blocked).toBe(true);expect(result.retained).toBe('0')
 expect(result.removed).toEqual({pants:true,mount:false});expect(result.restored).toEqual({mount:'0',pet:'3'})
 await page.screenshot({path:'/tmp/hso-mount-owl-phaser.png'})
 expect(errors).toEqual([])
})
