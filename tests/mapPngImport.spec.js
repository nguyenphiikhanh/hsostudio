import {test,expect} from '@playwright/test'
import fs from 'node:fs/promises'
import {unzipSync,strFromU8} from 'fflate'
async function download(page,name){const pending=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();const d=await pending;return new Uint8Array(await fs.readFile(await d.path()))}
test('large PNG import previews grid, pads explicitly, deduplicates, edits and restores a self-contained draft and Phaser ZIP',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/maps');const view=page.locator('.map-canvas-shell canvas')
 await expect(view).toHaveAttribute('data-rendered-map-id','0',{timeout:30000})
 const original=await (await page.request.get('/game/maps/0.json')).text()
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=193;c.height=97;const x=c.getContext('2d');x.fillStyle='#f02040';x.fillRect(0,0,193,97);x.fillStyle='#2040f0';x.fillRect(48,0,48,48);x.fillRect(144,0,48,48);return c.toDataURL().split(',')[1]})
 await page.getByText('Nhập PNG lớn → tạo map nháp',{exact:true}).click()
 await page.getByLabel('Mật độ PNG map',{exact:true}).selectOption('2')
 await page.getByLabel('Ảnh nền PNG',{exact:true}).setInputFiles({name:'new-map.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')})
 await expect(page.getByTestId('png-map-size')).toContainText('5 × 3 ô')
 await expect(page.getByLabel('Lưới cắt PNG map',{exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Tạo map nháp từ PNG',exact:true})).toBeDisabled()
 await page.getByLabel('Thêm viền trong suốt',{exact:true}).check();await page.getByLabel('Tên map PNG',{exact:true}).fill('Map thiết kế mới')
 await page.getByRole('button',{name:'Tạo map nháp từ PNG',exact:true}).click()
 await expect(page.locator('.map-inspector')).toContainText('Map thiết kế mới')
 await expect(view).not.toHaveAttribute('data-map-id','0')
 const id=await view.getAttribute('data-map-id')
 await expect(page.getByLabel('Nước động',{exact:true})).toBeDisabled()
 const doc=JSON.parse(new TextDecoder().decode(await download(page,'Tải JSON map')))
 expect(doc.tileset.terrain.density).toBe(2);expect(doc.width).toBe(5);expect(doc.height).toBe(3)
 expect(doc.tileset.terrain.tileCount).toBeLessThan(15);expect(doc.tiles[1]).toBe(doc.tiles[3]);expect(doc.collision.every(v=>v===0)).toBe(true)
 // Reconstruct every padded pixel from the generated atlas and compare to the uploaded PNG.
 expect(await page.evaluate(async({doc,png})=>{
  const original=await createImageBitmap(await (await fetch('data:image/png;base64,'+png)).blob()),atlas=await createImageBitmap(await (await fetch(doc.tileset.terrain.image)).blob())
  const c=document.createElement('canvas');c.width=240;c.height=144;const ctx=c.getContext('2d');const s=48,a=doc.tileset.terrain
  for(let i=0;i<doc.tiles.length;i++){const t=doc.tiles[i]-1;ctx.drawImage(atlas,t%a.columns*s,Math.floor(t/a.columns)*s,s,s,i%5*s,Math.floor(i/5)*s,s,s)}
  const result=ctx.getImageData(0,0,240,144).data;ctx.clearRect(0,0,240,144);ctx.drawImage(original,0,0);const expected=ctx.getImageData(0,0,240,144).data
  return result.every((v,i)=>v===expected[i])
 },{doc,png})).toBe(true)
 await page.getByRole('button',{name:'Thêm vùng chặn',exact:true}).click();await view.scrollIntoViewIfNeeded()
 const b=await view.boundingBox(),z=Number(await view.getAttribute('data-zoom')),x=Number(await view.getAttribute('data-pan-x')),y=Number(await view.getAttribute('data-pan-y'))
 await page.mouse.click(b.x+x+12*z,b.y+y+12*z)
 await expect(page.getByTestId('map-edit-count')).toContainText('Vùng chặn đổi: 1')
 const draft=await download(page,'Tải nháp JSON')
 expect(JSON.parse(new TextDecoder().decode(draft)).importedBase.tileset.terrain.image).toMatch(/^data:image\/png/)
 await page.getByLabel('Bản đồ HSO',{exact:true}).selectOption('0');await expect(view).toHaveAttribute('data-map-id','0')
 await page.getByLabel('Bản đồ HSO',{exact:true}).selectOption(id);await expect(page.getByTestId('map-edit-count')).toContainText('Vùng chặn đổi: 1')
 await page.screenshot({path:'/tmp/hso-png-map-import.png',fullPage:true})
 await page.reload();await expect(view).toHaveAttribute('data-rendered-map-id','0')
 await page.getByText('Nhập PNG lớn → tạo map nháp',{exact:true}).click()
 await page.getByLabel('Mở nháp map PNG',{exact:true}).setInputFiles({name:'map.map-draft.json',mimeType:'application/json',buffer:Buffer.from(draft)})
 await expect(view).toHaveAttribute('data-rendered-map-id',id)
 await expect(page.getByTestId('map-edit-count')).toContainText('Vùng chặn đổi: 1')
 const zip=unzipSync(await download(page,'Xuất map cho Phaser')),map=JSON.parse(strFromU8(zip['map.json']))
 expect(map.tileset.terrain.image).toBe('tiles/terrain.png');expect(zip['tiles/terrain.png']).toBeTruthy();expect(map.collision[0]).toBe(1)
 await page.route('**/map-smoke/**',route=>{
  const path=new URL(route.request().url()).pathname.replace('/map-smoke/','')
  if(path==='index.html')return route.fulfill({contentType:'text/html',body:'<script type="module" src="/tests/mapHarness.js"></script>'})
  return route.fulfill({status:zip[path]?200:404,contentType:path.endsWith('.png')?'image/png':path.endsWith('.js')?'text/javascript':'application/json',body:zip[path]?Buffer.from(zip[path]):'missing'})
 })
 await page.goto('/map-smoke/index.html');await expect.poll(()=>page.evaluate(()=>window.mapReady===true)).toBe(true)
 expect(await page.evaluate(()=>({width:window.mapActor.width,height:window.mapActor.height,scale:window.mapActor.terrainLayer.first.scaleX,block:window.mapActor.collisionAt(12,12)}))).toEqual({width:120,height:72,scale:.5,block:1})
 expect(await (await page.request.get('/game/maps/0.json')).text()).toBe(original)
 expect(errors).toEqual([])
})
