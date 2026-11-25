import {test,expect} from '@playwright/test'
import fs from 'node:fs/promises'
import {unzipSync,strFromU8} from 'fflate'
import {objectPlacement} from '../src/lib/maps/mapGeometry.js'
const table=JSON.parse(await fs.readFile(new URL('../public/game/maps/objects.json',import.meta.url),'utf8')),template=table.templates.find(t=>t.id===0)
async function download(page,name){const p=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();return new Uint8Array(await fs.readFile(await(await p).path()))}
async function doc(page){return JSON.parse(new TextDecoder().decode(await download(page,'Tải JSON map')))}
async function number(page,label,value){const input=page.getByLabel(label,{exact:true});await input.fill(String(value));await input.press('Tab')}
test('object scale locks proportionally, preserves anchor/collision, survives drafts and renders correctly in Phaser',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/maps');const canvas=page.locator('.map-canvas-shell canvas');await expect(canvas).toHaveAttribute('data-rendered-map-id','0',{timeout:30000})
 await page.getByRole('button',{name:'Đặt vật thể',exact:true}).click();await expect(page.getByText('Sẵn sàng đặt.',{exact:false})).toBeVisible();await canvas.scrollIntoViewIfNeeded()
 const box=await canvas.boundingBox(),zoom=Number(await canvas.getAttribute('data-zoom')),x=Number(await canvas.getAttribute('data-pan-x')),y=Number(await canvas.getAttribute('data-pan-y'))
 await page.mouse.click(box.x+x+492*zoom,box.y+y+348*zoom)
 const before=await doc(page),id=Math.max(...before.objects.map(o=>o.index)),object=before.objects.find(o=>o.index===id)
 await expect(page.getByLabel('Khóa tỷ lệ vật thể',{exact:true})).toBeChecked()
 await number(page,'Scale X vật thể',2);await expect(page.getByLabel('Scale Y vật thể',{exact:true})).toHaveValue('2')
 let current=await doc(page),scaled=current.objects.find(o=>o.index===id)
 expect(scaled).toEqual({...object,scaleX:2,scaleY:2});expect(current.collision).toEqual(before.collision)
 const placement=objectPlacement(scaled,template);expect(placement.x).toBe(object.cellX*24+template.dx*2);expect(placement.y).toBe(object.cellY*24+template.dy*2)
 await page.getByLabel('Khóa tỷ lệ vật thể',{exact:true}).uncheck();await number(page,'Scale Y vật thể',3)
 await expect(page.getByLabel('Scale X vật thể',{exact:true})).toHaveValue('2')
 await page.getByRole('button',{name:'Nhân bản vật thể',exact:true}).click()
 current=await doc(page);const copyId=Math.max(...current.objects.map(o=>o.index));expect(current.objects.find(o=>o.index===copyId)).toMatchObject({scaleX:2,scaleY:3})
 await page.getByRole('button',{name:'Kích thước gốc ×1',exact:true}).click();await expect(page.getByLabel('Scale X vật thể',{exact:true})).toHaveValue('1');await expect(page.getByLabel('Scale Y vật thể',{exact:true})).toHaveValue('1')
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByLabel('Scale X vật thể',{exact:true})).toHaveValue('2');await expect(page.getByLabel('Scale Y vật thể',{exact:true})).toHaveValue('3')
 await page.getByLabel('Khóa tỷ lệ vật thể',{exact:true}).check();await number(page,'Scale X vật thể',3);await expect(page.getByLabel('Scale Y vật thể',{exact:true})).toHaveValue('4.5')
 await page.getByRole('button',{name:'Undo',exact:true}).click()
 // Invalid values are rejected without changing the object or history.
 const good=await doc(page);await number(page,'Scale X vật thể',0);await expect(page.getByRole('alert')).toContainText('0.1–8');await page.getByRole('button',{name:'Đóng',exact:true}).click();expect((await doc(page)).objects).toEqual(good.objects)
 await page.getByRole('button',{name:'Chỉnh vùng chặn trên map',exact:true}).click();await expect(page.getByLabel('Lớp map Vùng chặn',{exact:true})).toBeChecked();await expect(page.getByRole('button',{name:'Thêm vùng chặn',exact:true})).toHaveAttribute('aria-pressed','true')
 const draft=await download(page,'Tải nháp JSON')
 await page.reload();await expect(canvas).toHaveAttribute('data-rendered-map-id','0',{timeout:30000})
 await page.getByLabel('File nháp map',{exact:true}).setInputFiles({name:'scaled.map-draft.json',mimeType:'application/json',buffer:Buffer.from(draft)})
 await expect(page.getByRole('status')).toContainText('Đã nhập nháp')
 current=await doc(page);expect(current.objects).toEqual(good.objects);expect(current.collision).toEqual(before.collision)
 const zip=unzipSync(await download(page,'Xuất map cho Phaser')),map=JSON.parse(strFromU8(zip['map.json']))
 expect(map.objects.find(o=>o.index===id)).toMatchObject({scaleX:2,scaleY:3})
 await page.route('**/map-smoke/**',route=>{
  const path=new URL(route.request().url()).pathname.replace('/map-smoke/','')
  if(path==='index.html')return route.fulfill({contentType:'text/html',body:'<script type="module" src="/tests/mapHarness.js"></script>'})
  return route.fulfill({status:zip[path]?200:404,contentType:path.endsWith('.png')?'image/png':path.endsWith('.js')?'text/javascript':'application/json',body:zip[path]?Buffer.from(zip[path]):'missing'})
 })
 await page.goto('/map-smoke/index.html');await expect.poll(()=>page.evaluate(()=>window.mapReady===true)).toBe(true)
 const expected=objectPlacement(map.objects.find(o=>o.index===id),template)
 const result=await page.evaluate(({x,y})=>{const m=window.mapActor,s=m.objectLayer.list.find(s=>s.x===x&&s.y===y&&s.scaleX===.5&&s.scaleY===.75);return{found:Boolean(s),width:s?.displayWidth,height:s?.displayHeight,depth:s?.depth,collision:m.collision}},expected)
 expect(result).toEqual({found:true,width:expected.width,height:expected.height,depth:object.cellY*24,collision:map.collision})
 expect(errors).toEqual([])
})
