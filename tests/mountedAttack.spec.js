import {inCharacterTab} from './workspaceTabs.js'
import {test,expect} from '@playwright/test'
import fs from 'node:fs/promises'
import {unzipSync,strFromU8} from 'fflate'
import companions from '../src/data/companions.json' with {type:'json'}

test('all permitted sheet mounts attack and export native mounted runtime, with four-class WPS coverage',async({page})=>{
 test.setTimeout(90000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/')
 const mount=page.getByLabel('Thú cưỡi',{exact:true}),motion=page.getByLabel('Trạng thái nhân vật',{exact:true})
 const weapon=page.getByLabel('Vũ khí thường HSO',{exact:true})
 await expect(mount).toBeVisible({timeout:30000})
 for(const [clazz,item,folder]of [[0,0,'kiem'],[1,5,'songkiem'],[2,10,'phapsu'],[3,15,'sung']]) {
   await inCharacterTab(page,'Trang bị',()=>page.getByLabel('Phái nhân vật',{exact:true}).selectOption(String(clazz)))
   await inCharacterTab(page,'Trang bị',()=>weapon.selectOption(String(item)));await inCharacterTab(page,'Trang bị',()=>mount.selectOption('1'))
   await inCharacterTab(page,'Animation',()=>motion.selectOption('idle'));await inCharacterTab(page,'Animation',()=>motion.selectOption('attack'))
   await expect(page.getByTestId('mounted-attack-status')).toContainText('Ngựa trắng')
   await expect(page.getByTestId('client-weapon-animation')).toContainText('#0')
   await expect(page.getByLabel('Kỹ năng tấn công',{exact:true}).locator('option[value="1"]')).toHaveJSProperty('disabled',false)
   await inCharacterTab(page,'Animation',()=>page.getByRole('button',{name:'Tạm dừng',exact:true}).click())
   for(let i=0;i<9 && !(await page.locator('.frame-status').textContent()).includes('tick 1/9');i++)await inCharacterTab(page,'Animation',()=>page.getByRole('button',{name:'Frame tiếp →',exact:true}).click())
   for(let i=0;i<5;i++)await inCharacterTab(page,'Animation',()=>page.getByRole('button',{name:'Frame tiếp →',exact:true}).click())
   await expect(page.locator('.frame-status')).toContainText('body 5')
   await page.locator('.direction-views').screenshot({path:`/tmp/hso-mounted-attack-class-${clazz}.png`})
   const pending=page.waitForEvent('download')
   await page.getByRole('button',{name:'Xuất cho Phaser',exact:false}).click()
   const pose=unzipSync(await fs.readFile(await(await pending).path()))
   const config=JSON.parse(strFromU8(pose['character-composition.json']))
   expect(config.preview.attackOptions.mountEntry.motion).toBe('idle')
   expect(config.layers.find(l=>l.slot==='weapon').source).toBe(`jar:x1/wps/${folder}/0.png`)
   expect(config.layers.find(l=>l.slot==='pants').visible).toBe(false)
   expect(config.layers.find(l=>l.slot==='mount').source).toBe('icon/x4/10701.png')
 }
 for(const d of companions.mounts.filter(d=>d.mountedAttack.status==='ready')) {
   await inCharacterTab(page,'Trang bị',()=>mount.selectOption(d.id));await inCharacterTab(page,'Animation',()=>motion.selectOption('idle'));await inCharacterTab(page,'Animation',()=>motion.selectOption('attack'))
   await expect(page.getByTestId('mounted-attack-status')).toContainText(d.label)
   await inCharacterTab(page,'Animation',()=>page.getByRole('button',{name:'Tạm dừng',exact:true}).click())
   await expect(page.locator('.direction-views canvas').first()).toHaveAttribute('data-rendered-mount',d.id)
   await expect(page.getByRole('alert')).toHaveCount(0)
   await page.locator('.direction-views').screenshot({path:`/tmp/hso-mounted-rig-${d.id}.png`})
 }
 const pending=page.waitForEvent('download')
 await page.getByRole('button',{name:'Xuất thư viện part',exact:true}).click()
 const zip=unzipSync(await fs.readFile(await(await pending).path()))
 expect(JSON.parse(strFromU8(zip['animations.json'])).states.attack).toMatchObject({clientBasic:true,experimental:false,clazz:3,skillId:0})
 await inCharacterTab(page,'Trang bị',()=>mount.selectOption('0'))
 await expect(motion).toHaveValue('idle')
 await expect(motion.locator('option[value="attack"]')).toHaveJSProperty('disabled',true)
 await expect(page.getByTestId('mounted-attack-status')).toContainText('Ngựa nâu')
 await page.route('**/companion-smoke/**',route=>{
   const path=new URL(route.request().url()).pathname.replace('/companion-smoke/','')
   if(path==='index.html')return route.fulfill({contentType:'text/html',body:'<script type="module" src="/tests/companionHarness.js"></script>'})
   return route.fulfill({status:zip[path]?200:404,contentType:path.endsWith('.png')?'image/png':path.endsWith('.js')?'text/javascript':'application/json',body:zip[path]?Buffer.from(zip[path]):'missing'})
 })
 await page.goto('/companion-smoke/index.html')
 await expect.poll(()=>page.evaluate(()=>window.companionReady===true)).toBe(true)
 const result=await page.evaluate(()=>{
   const c=window.companionCharacter
   c.setState('walk','right');c.elapsed=160;c.render()
   const entry=c.images.get('mount').frame.name
   c.setState('attack','right');c.update(120)
   const a={shirt:c.images.get('shirt').frame.name,mount:c.images.get('mount').frame.name,y:c.images.get('mount').y}
   c.update(80)
   const b={shirt:c.images.get('shirt').frame.name,mount:c.images.get('mount').frame.name,y:c.images.get('mount').y}
   const pants=c.images.get('pants').visible
   c.mount('0');let blocked=false;try{c.setState('attack')}catch{blocked=true}
   c.mount('2');c.setState('attack');const armorAllowed=c.state==='attack'
   c.mount('1');c.setState('idle','up');c.setState('attack','up');c.update(200)
   const allMounts=[]
   for(const [id,d] of Object.entries(c.manifest.companions.mount)) {
     if(d.mountedAttack.status!=='ready')continue
     for(const direction of ['down','up','left','right']) {
       c.mount(id);c.setState('walk',direction);c.elapsed=160;c.render()
       const image=c.images.get('mount'),frame=image.frame.name,x=image.x,y=image.y
       c.setState('attack',direction);c.update(120);const shirtA=c.images.get('shirt').frame.name
       c.update(80);const shirtB=c.images.get('shirt').frame.name
       allMounts.push({id,direction,held:image.frame.name===frame&&image.x===x&&image.y===y,animated:shirtA!==shirtB,hidden:!c.images.get('pants').visible})
     }
   }
   const basic=c.animations.attack;c.animations.attack={...basic,clientBasic:false,skillId:1}
   let blockedSkill=false;try{c.setState('attack')}catch{blockedSkill=true}
   c.animations.attack=basic
   return {entry,a,b,pants,blocked,armorAllowed,allMounts,blockedSkill,finalState:c.state,phase:c.images.get('shirt').frame.name}
 })
 expect(result.a.mount).toBe(result.entry);expect(result.b.mount).toBe(result.entry)
 expect(result.a.y).toBe(result.b.y);expect(result.a.shirt).not.toBe(result.b.shirt)
 expect(result.pants).toBe(false);expect(result.blocked).toBe(true);expect(result.armorAllowed).toBe(true)
 expect(result.allMounts).toHaveLength(52)
 for(const sample of result.allMounts)expect(sample).toMatchObject({held:true,animated:true,hidden:true})
 expect(result.blockedSkill).toBe(true)
 expect(result.finalState).toBe('attack')
 await page.screenshot({path:'/tmp/hso-mounted-attack-phaser.png'})
 expect(errors).toEqual([])
})
