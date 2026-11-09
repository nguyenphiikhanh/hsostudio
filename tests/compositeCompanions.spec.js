import {inCharacterTab} from './workspaceTabs.js'
import{test,expect}from'@playwright/test'
import fs from'node:fs/promises'
import{unzipSync,strFromU8}from'fflate'
import data from'../src/data/companions.json' with {type:'json'}

test('effect mounts and PetTool animate in Studio and the exported multi-piece Phaser runtime',async({page})=>{
 test.setTimeout(120000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/')
 const mount=page.getByLabel('Thú cưỡi',{exact:true}),pet=page.getByLabel('Thú cưng',{exact:true}),motion=page.getByLabel('Trạng thái nhân vật',{exact:true})
 await expect(mount).toBeVisible({timeout:30000})
 await expect(mount.locator('option')).toHaveCount(23);await expect(pet.locator('option')).toHaveCount(13)
 await expect(page.getByText('Các vật phẩm chưa hỗ trợ (3)',{exact:true})).toBeVisible()
 for(const d of data.mounts.filter(d=>d.rig?.kind)){
  await inCharacterTab(page,'Trang bị',()=>mount.selectOption(d.id));await inCharacterTab(page,'Animation',()=>motion.selectOption('walk'))
  await page.getByRole('tab',{name:'Trang bị',exact:true}).click()
  if(d.riderBinding?.status==='unverified') {
   await expect(mount.locator(`option[value="${d.id}"]`)).toContainText('ghế chưa xác minh')
   await expect(page.getByText('Ghế ngồi chưa xác minh.',{exact:false})).toBeVisible()
  }
  await inCharacterTab(page,'Animation',()=>page.getByRole('button',{name:'Tạm dừng',exact:true}).click())
  await expect(motion.locator('option[value="attack"]')).toHaveJSProperty('disabled',true)
  const canvases=page.locator('.direction-views canvas')
  await expect(canvases.first()).toHaveAttribute('data-rendered-mount',d.id)
  const before=await canvases.evaluateAll(cs=>cs.map(c=>c.toDataURL()))
  // Sample each step: start/end can be the same pose after six ticks.
  let changed=false
  for(let i=0;i<8&&!changed;i++) {
   await inCharacterTab(page,'Animation',()=>page.getByRole('button',{name:'Frame tiếp →',exact:true}).click())
   await page.evaluate(()=>new Promise(requestAnimationFrame))
   changed=await canvases.evaluateAll((cs,old)=>cs.some((c,i)=>c.toDataURL()!==old[i]),before)
  }
  expect(changed).toBe(true)
  await page.locator('.direction-views').screenshot({path:`/tmp/hso-composite-${d.id}.png`})
  await expect(page.getByRole('alert')).toHaveCount(0)
 }
 await inCharacterTab(page,'Trang bị',()=>mount.selectOption(''))
 for(const d of data.pets.filter(d=>d.rig?.kind)){
  await inCharacterTab(page,'Trang bị',()=>pet.selectOption(d.id));await inCharacterTab(page,'Animation',()=>motion.selectOption('walk'))
  await inCharacterTab(page,'Animation',()=>page.getByRole('button',{name:'Tạm dừng',exact:true}).click())
  await inCharacterTab(page,'Animation',()=>page.getByRole('button',{name:'Frame tiếp →',exact:true}).click())
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.locator('.direction-views').screenshot({path:`/tmp/hso-pet-tool-${d.id}.png`})
 }
 await inCharacterTab(page,'Trang bị',()=>mount.selectOption('effect-111'));await inCharacterTab(page,'Trang bị',()=>pet.selectOption('21'))
 await expect(page.getByText('Nguồn gốc có một tham chiếu frame lỗi',{exact:false})).toBeVisible()
 const poseDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Xuất cho Phaser',exact:false}).click()
 const pose=unzipSync(await fs.readFile(await(await poseDownload).path()))
 const layers=JSON.parse(strFromU8(pose['character-composition.json'])).layers
 expect(layers.filter(l=>l.slot==='mount').length).toBeGreaterThan(1)
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Xuất thư viện part',exact:true}).click()
 const zip=unzipSync(await fs.readFile(await(await pending).path()))
 const json=p=>JSON.parse(strFromU8(zip[p]))
 expect(json('library.json').companionAtlases).toHaveLength(34)
 expect(json('companions.inventory.json').filter(i=>i.status!=='ready').map(i=>i.id)).toEqual([271,272,283])
 expect(json('mounts/effect-111/companion.json').rig.frames).toHaveLength(63)
 for(const id of ['effect-69','effect-106']) {
  expect(json(`mounts/${id}/companion.json`).riderBinding).toMatchObject({status:'unverified',policy:'preserve-original'})
 }
 expect(json('pets/21/companion.json').rig.invalidReferences).toEqual([{animation:2,tick:8,frame:64}])
 await page.route('**/companion-smoke/**',route=>{
  const path=new URL(route.request().url()).pathname.replace('/companion-smoke/','')
  if(path==='index.html')return route.fulfill({contentType:'text/html',body:'<script type="module" src="/tests/companionHarness.js"></script>'})
  return route.fulfill({status:zip[path]?200:404,contentType:path.endsWith('.png')?'image/png':path.endsWith('.js')?'text/javascript':'application/json',body:zip[path]?Buffer.from(zip[path]):'missing'})
 })
 await page.goto('/companion-smoke/index.html')
 await expect.poll(()=>page.evaluate(()=>window.companionReady===true)).toBe(true)
 const result=await page.evaluate(()=>{
  const c=window.companionCharacter;let samples=0,multiple=false,hidden=false,mirrored=false,bounded=true,layering=true
  for(const d of Object.values(c.manifest.companions.mount).filter(d=>d.rig?.kind))for(const dir of ['down','up','left','right']){
   c.mount(d.id);c.setState('walk',dir)
   const maxPieces=Math.max(...d.rig.frames.map(a=>a.length))
   for(const state of ['idle','walk']) {
    c.setState(state,dir)
    for(let tick=0;tick<360;tick+=3){
     c.elapsed=tick*40;c.render();bounded&&=c.images.size<=6+maxPieces+10
     const pose=state==='walk'?[2,2,2,3,3,4,4,4][tick%8]:Number(tick%12>=7)
     const frame=(dir==='down'?0:dir==='up'?7:14)+pose+Math.floor(tick/5)%(d.rig.frames.length/21)*21
     const source=d.rig.frames[frame],head=c.images.get('head')
     const expected=source.map((p,i)=>({i,top:p.top===0})).sort((a,b)=>Number(a.top)-Number(b.top))
     const imageKeys=new Map([...c.images].map(([key,image])=>[image,key]))
     const visible=c.container.list.filter(image=>image.visible && (imageKeys.get(image)==='mount'||imageKeys.get(image)?.startsWith('mount:piece:')))
     layering&&=visible.length===source.length
     for(let i=0;i<expected.length;i++) {
      const p=expected[i],image=c.images.get(p.i===0?'mount':'mount:piece:'+p.i)
      layering&&=visible[i]===image && (p.top?image.depth>head.depth:image.depth<head.depth)
     }
    }
   }
   const parts=[...c.images].filter(([key,image])=>(key==='mount'||key.startsWith('mount:piece:'))&&image.visible)
   multiple||=parts.length>1;hidden||=!c.images.get('pants').visible;mirrored||=dir==='right'&&parts.some(([,p])=>p.flipX);samples++
  }
  c.mount(null)
  for(const d of Object.values(c.manifest.companions.pet).filter(d=>d.rig?.kind))for(const dir of ['down','up','left','right']){
   c.setPet(d.id);c.setState('walk',dir);c.update(240);samples++
  }
  c.equipCompanionItem('mount',276);c.equipCompanionItem('pet',4626)
  return{samples,multiple,hidden,mirrored,bounded,layering,selection:c.companions}
 })
 expect(result).toEqual({samples:56,multiple:true,hidden:true,mirrored:true,bounded:true,layering:true,selection:{mount:'effect-111',pet:'21'}})
 await page.screenshot({path:'/tmp/hso-effect-companions-phaser.png'})
 expect(errors).toEqual([])
})
