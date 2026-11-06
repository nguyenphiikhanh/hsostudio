import {test,expect} from '@playwright/test'
import fs from 'node:fs/promises'
import {unzipSync,strFromU8} from 'fflate'
import {clientSkillData} from '../src/lib/clientSkillCatalog.js'
import {clientSkillClip} from '../src/lib/characterPose.js'

test('offensive skills 1+ work while mounted, preserving source FX and exported body clips',async({page})=>{
 test.setTimeout(120000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/')
 const mount=page.getByLabel('Thú cưỡi',{exact:true}),motion=page.getByLabel('Trạng thái nhân vật',{exact:true})
 const weapon=page.getByLabel('Vũ khí thường HSO',{exact:true}),skill=page.getByLabel('Kỹ năng tấn công',{exact:true})
 await expect(mount).toBeVisible({timeout:30000})
 for(const [clazz,item,rig]of [[0,0,'1'],[1,5,'5'],[2,10,'10'],[3,15,'13']]){
  await page.getByLabel('Phái nhân vật',{exact:true}).selectOption(String(clazz))
  await weapon.selectOption(String(item));await mount.selectOption(rig);await motion.selectOption('attack')
  await page.getByRole('button',{name:'Tạm dừng',exact:true}).click()
  for(const skillId of [1,2,3,4,5,6,7,8,17,19,20]){
   await skill.selectOption(String(skillId))
   await expect(page.getByTestId('client-weapon-animation')).toContainText(`#${skillId} `)
   await expect(page.locator('.direction-views canvas').first()).toHaveAttribute('data-rendered-mount',rig)
   if(skillId<=4){
    const canvas=page.getByLabel(`Preview chiêu ${skillId} và mục tiêu mẫu`,{exact:true})
    const trigger=clientSkillData(clazz,skillId).effectTick
    for(let i=0;i<trigger;i++)await page.getByRole('button',{name:'Frame tiếp →',exact:true}).click()
    await expect(canvas).toHaveAttribute('data-effect-frame','0')
    await canvas.screenshot({path:`/tmp/hso-mounted-skill-${skillId}-class-${clazz}.png`})
   }else{
    await expect(page.getByTestId('mounted-body-only')).toBeVisible()
    await page.getByRole('button',{name:'Frame tiếp →',exact:true}).click()
   }
   await expect(page.getByRole('alert')).toHaveCount(0)
  }
  for(const id of [9,10,11,12,13,14,15,16,18])await expect(skill.locator(`option[value="${id}"]`)).toHaveJSProperty('disabled',true)
 }
 const pending=page.waitForEvent('download')
 await page.getByRole('button',{name:'Xuất thư viện part',exact:true}).click()
 const zip=unzipSync(await fs.readFile(await(await pending).path()))
 expect(JSON.parse(strFromU8(zip['animations.json'])).states.attack).toMatchObject({clientSkill:true,clazz:3,skillId:20,experimental:false})
 await page.route('**/companion-smoke/**',route=>{
  const path=new URL(route.request().url()).pathname.replace('/companion-smoke/','')
  if(path==='index.html')return route.fulfill({contentType:'text/html',body:'<script type="module" src="/tests/companionHarness.js"></script>'})
  return route.fulfill({status:zip[path]?200:404,contentType:path.endsWith('.png')?'image/png':path.endsWith('.js')?'text/javascript':'application/json',body:zip[path]?Buffer.from(zip[path]):'missing'})
 })
 await page.goto('/companion-smoke/index.html')
 await expect.poll(()=>page.evaluate(()=>window.companionReady===true)).toBe(true)
 const clips=Array.from({length:4},(_,clazz)=>[1,2,3,4,5,6,7,8,17,19,20].map(id=>clientSkillClip(clazz,id)))
 const result=await page.evaluate(clips=>{
  const c=window.companionCharacter;let samples=0,held=true
  for(const classClips of clips)for(const clip of classClips)for(const id of ['1','5','13'])for(const dir of ['down','up','left','right']){
    c.mount(id);c.animations.attack=clip;c.setState('walk',dir);c.elapsed=160;c.render()
    const horse=c.images.get('mount'),frame=horse.frame.name,x=horse.x,y=horse.y
    c.setState('attack',dir)
    for(let tick=0;tick<clip.frames.length;tick++){c.elapsed=tick*40;c.render();held&&=horse.frame.name===frame&&horse.x===x&&horse.y===y&&!c.images.get('pants').visible}
    samples++
  }
  c.mount('0');let brownBlocked=false;try{c.setState('attack')}catch{brownBlocked=true}
  return {samples,held,brownBlocked}
 },clips)
 expect(result).toEqual({samples:528,held:true,brownBlocked:true})
 expect(errors).toEqual([])
})
