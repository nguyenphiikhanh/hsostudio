import {test,expect} from '@playwright/test'
import fs from 'node:fs/promises'
import {unzipSync,strFromU8} from 'fflate'
import titles from '../src/data/titles.json' with {type:'json'}

test('all titles preview, animate independently, export and equip in the actual Phaser library',async({page})=>{
 test.setTimeout(120000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/')
 const select=page.getByLabel('Danh hiệu cá nhân',{exact:true}),motion=page.getByLabel('Trạng thái nhân vật',{exact:true})
 const canvases=page.locator('.direction-views canvas')
 await expect(select).toBeVisible({timeout:30000});await expect(select.locator('option')).toHaveCount(12)
 for(const d of titles.titles){
  await select.selectOption(d.id)
  await expect(canvases.first()).toHaveAttribute('data-rendered-title',d.id)
  if(await page.getByRole('button',{name:'Tạm dừng',exact:true}).count())await page.getByRole('button',{name:'Tạm dừng',exact:true}).click()
  const first=Number(await canvases.first().getAttribute('data-title-frame'))
  for(let i=0;i<5;i++)await page.getByRole('button',{name:'Frame tiếp →',exact:true}).click()
  for(const canvas of await canvases.all())await expect(canvas).toHaveAttribute('data-title-frame',String((first+1)%d.rig.frames.length))
  await expect(page.getByRole('alert')).toHaveCount(0)
 }
 await select.selectOption('4720')
 await page.getByLabel('Vũ khí thường HSO',{exact:true}).selectOption('0')
 await motion.selectOption('attack')
 await page.getByRole('button',{name:'Tạm dừng',exact:true}).click()
 const before=Number(await canvases.first().getAttribute('data-title-frame'))
 for(let i=0;i<30;i++)await page.getByRole('button',{name:'Frame tiếp →',exact:true}).click()
 await expect(canvases.first()).toHaveAttribute('data-title-frame',String(before))
 await page.getByLabel('Thú cưỡi',{exact:true}).selectOption('effect-106')
 await expect(motion).toHaveValue('idle')
 await page.locator('.direction-views').screenshot({path:'/tmp/hso-titles-mounted.png'})
 const posePending=page.waitForEvent('download');await page.getByRole('button',{name:'Xuất cho Phaser',exact:false}).click()
 const pose=unzipSync(await fs.readFile(await(await posePending).path()))
 expect(JSON.parse(strFromU8(pose['character-composition.json'])).layers.some(l=>l.slot==='title')).toBe(true)
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Xuất thư viện part',exact:true}).click()
 const zip=unzipSync(await fs.readFile(await(await pending).path())),json=p=>JSON.parse(strFromU8(zip[p]))
 expect(json('library.json').titleAtlases).toHaveLength(11)
 expect(json('character.json').title.id).toBe('4720')
 for(const d of titles.titles){expect(json(`titles/${d.id}/title.json`).rig.frames).toEqual(d.rig.frames);expect(zip[`titles/${d.id}/sheet.png`]).toBeTruthy()}
 await page.route('**/companion-smoke/**',route=>{
  const path=new URL(route.request().url()).pathname.replace('/companion-smoke/','')
  if(path==='index.html')return route.fulfill({contentType:'text/html',body:'<script type="module" src="/tests/companionHarness.js"></script>'})
  return route.fulfill({status:zip[path]?200:404,contentType:path.endsWith('.png')?'image/png':path.endsWith('.js')?'text/javascript':'application/json',body:zip[path]?Buffer.from(zip[path]):'missing'})
 })
 await page.goto('/companion-smoke/index.html');await expect.poll(()=>page.evaluate(()=>window.companionReady===true)).toBe(true)
 const result=await page.evaluate(()=>{
  const c=window.companionCharacter;let visible=true,bounded=true,continuous=true
  for(const d of Object.values(c.manifest.titles)){
   c.setTitle(d.id)
   for(const dir of ['down','up','left','right'])for(const state of ['idle','walk']){
    c.setState(state,dir);c.update(200)
    const sprites=[...c.images].filter(([key,image])=>key.startsWith('title:piece:')&&image.visible)
    visible&&=sprites.length>0;bounded&&=c.images.size<=20+Math.max(...d.rig.frames.map(f=>f.length))
   }
  }
  c.setTitle('4720');c.update(200);const elapsed=c.titleElapsed;c.setState('idle');continuous&&=c.titleElapsed===elapsed;c.setState('walk');continuous&&=c.titleElapsed===elapsed
  c.equipItem(4724);const selected=c.title.id
  let rejected=false;try{c.setTitle('missing')}catch{rejected=c.title.id===selected}
  c.setTitle(null);const removed=![...c.images.keys()].some(k=>k.startsWith('title:'))
  return{visible,bounded,continuous,selected,rejected,removed}
 })
 expect(result).toEqual({visible:true,bounded:true,continuous:true,selected:'4724',rejected:true,removed:true})
 expect(errors).toEqual([])
})
