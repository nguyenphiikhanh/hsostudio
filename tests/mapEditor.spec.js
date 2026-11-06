import {test,expect} from '@playwright/test'
import fs from 'node:fs/promises'
import {unzipSync,strFromU8} from 'fflate'
import {createHash} from 'node:crypto'
import {createMapEditor} from '../src/lib/maps/mapEditor.js'
import {objectPlacement,hitObject,collisionGrid} from '../src/lib/maps/mapGeometry.js'
const native=JSON.parse(await fs.readFile(new URL('../public/game/maps/0.json',import.meta.url),'utf8'))
const table=JSON.parse(await fs.readFile(new URL('../public/game/maps/objects.json',import.meta.url),'utf8'))
const templates=Object.fromEntries(table.templates.map(t=>[t.id,t]))
async function download(page,name){const pending=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();const d=await pending;return{bytes:await fs.readFile(await d.path()),name:d.suggestedFilename()}}
async function exported(page){const d=await download(page,'Tải JSON map');return JSON.parse(d.bytes.toString())}
async function screen(page,x,y){const c=page.locator('.map-canvas-shell canvas');await c.scrollIntoViewIfNeeded();const b=await c.boundingBox();return{x:b.x+Number(await c.getAttribute('data-pan-x'))+x*Number(await c.getAttribute('data-zoom')),y:b.y+Number(await c.getAttribute('data-pan-y'))+y*Number(await c.getAttribute('data-zoom'))}}
async function clickCell(page,col,row){const p=await screen(page,col*24+12,row*24+12);await page.mouse.click(p.x,p.y)}

test('tile strokes, fill, eyedropper, cancellation, per-map history and draft JSON preserve native maps',async({page})=>{
 test.setTimeout(90000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/maps');const c=page.locator('.map-canvas-shell canvas')
 await expect(c).toHaveAttribute('data-rendered-map-id','0',{timeout:30000})
 const col=26,row=13,paint=[2,3,4,72].find(t=>[0,1,2,3].every(dx=>native.tiles[row*58+col+dx]!==t))
 await page.getByRole('button',{name:'Bút tile',exact:true}).click()
 await page.getByRole('button',{name:`Chọn tile ${paint}`,exact:true}).click()
 await page.getByRole('button',{name:'Phóng to map',exact:true}).click()
 const zoom=await c.getAttribute('data-zoom'),pan=await c.getAttribute('data-pan-x')
 const a=await screen(page,col*24+12,row*24+12),b=await screen(page,(col+3)*24+12,row*24+12)
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:3});await page.mouse.up()
 await expect(page.getByTestId('map-edit-count')).toContainText('Tile đổi: 4')
 await expect(c).toHaveAttribute('data-zoom',zoom);await expect(c).toHaveAttribute('data-pan-x',pan)
 const edited=await exported(page),expected=[...native.tiles];for(let dx=0;dx<4;dx++)expected[row*58+col+dx]=paint
 expect(edited.tiles).toEqual(expected);expect(edited.editInfo.modified).toBe(true);expect(edited.source.sha256).toBe(native.source.sha256)
 expect(edited.collision).toEqual(collisionGrid(edited,templates));expect(await(await page.request.get('/game/maps/0.json')).json()).toEqual(native)
 await page.getByRole('button',{name:'Undo',exact:true}).click();expect((await exported(page)).tiles).toEqual(native.tiles)
 await page.getByRole('button',{name:'Redo',exact:true}).click();expect((await exported(page)).tiles).toEqual(expected)
 await page.getByRole('button',{name:'Tẩy tile',exact:true}).click()
 const point=await screen(page,col*24+12,row*24+12);await page.mouse.move(point.x,point.y);await page.mouse.down();await page.keyboard.press('Escape');await page.mouse.up()
 expect((await exported(page)).tiles).toEqual(expected)
 await page.getByRole('button',{name:'Hút tile',exact:true}).click();await clickCell(page,col,row)
 await expect(page.getByRole('button',{name:'Bút tile',exact:true})).toHaveAttribute('aria-pressed','true')
 await expect(page.getByRole('button',{name:`Chọn tile ${paint}`,exact:true})).toHaveAttribute('aria-pressed','true')
 const fill=paint===3?4:3
 await page.getByRole('button',{name:`Chọn tile ${fill}`,exact:true}).click();await page.getByRole('button',{name:'Tô vùng',exact:true}).click();await clickCell(page,col,row)
 expect((await exported(page)).tiles[row*58+col]).toBe(fill)
 await page.getByRole('button',{name:'Undo',exact:true}).click();expect((await exported(page)).tiles).toEqual(expected)
 await c.focus();await page.keyboard.press('Control+z');expect((await exported(page)).tiles).toEqual(native.tiles)
 await c.focus();await page.keyboard.press('Control+Shift+z');expect((await exported(page)).tiles).toEqual(expected)
 await c.scrollIntoViewIfNeeded();const box=await c.boundingBox(),oldPan=await c.getAttribute('data-pan-x')
 await c.focus();await page.keyboard.down('Space');await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+30,box.y+box.height/2+15);await page.mouse.up();await page.keyboard.up('Space')
 await expect(c).not.toHaveAttribute('data-pan-x',oldPan);expect((await exported(page)).tiles).toEqual(expected)
 const file=await download(page,'Tải nháp JSON'),doc=JSON.parse(file.bytes.toString())
 expect(doc.schema).toBe('hso-map-draft');expect(doc.edits.tiles).toEqual(expected)
 await page.getByLabel('Bản đồ HSO',{exact:true}).selectOption('1');await expect(c).toHaveAttribute('data-rendered-map-id','1')
 await page.getByLabel('Bản đồ HSO',{exact:true}).selectOption('0');await expect(c).toHaveAttribute('data-rendered-map-id','0')
 expect((await exported(page)).tiles).toEqual(expected)
 await page.getByRole('link',{name:'Character Lab',exact:true}).click();await page.getByRole('link',{name:'Map',exact:true}).click()
 expect((await exported(page)).tiles).toEqual(expected)
 await page.reload();await expect(c).toHaveAttribute('data-rendered-map-id','0',{timeout:30000});expect((await exported(page)).tiles).toEqual(native.tiles)
 await page.getByLabel('File nháp map',{exact:true}).setInputFiles({name:file.name,mimeType:'application/json',buffer:file.bytes})
 await expect(page.getByRole('status')).toContainText('Đã nhập nháp')
 expect((await exported(page)).tiles).toEqual(expected)
 const bad=structuredClone(doc);bad.base.sourceSha256='wrong'
 await page.getByLabel('File nháp map',{exact:true}).setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))})
 await expect(page.getByRole('alert')).toContainText('không khớp')
 expect((await exported(page)).tiles).toEqual(expected)
 await page.getByRole('button',{name:'Khôi phục map gốc',exact:true}).click();expect((await exported(page)).tiles).toEqual(native.tiles)
 await page.getByRole('button',{name:'Undo',exact:true}).click();expect((await exported(page)).tiles).toEqual(expected)
 await page.screenshot({path:'/tmp/hso-map-editor.png',fullPage:true})
 expect(errors).toEqual([])
})

test('native object placement, snapped dragging, duplication and removal export edited PNG/Phaser data',async({page})=>{
 test.setTimeout(120000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/maps');const c=page.locator('.map-canvas-shell canvas');await expect(c).toHaveAttribute('data-rendered-map-id','0',{timeout:30000})
 const beforePNG=await download(page,'Tải PNG map'),used=new Set(native.objects.map(o=>templates[o.templateId].asset.image))
 const template=table.templates.find(t=>t.asset&&!used.has(t.asset.image)&&t.blocks.length&&t.asset.width/4<=120&&t.asset.height/4<=120)
 expect(template).toBeTruthy()
 await page.getByRole('button',{name:'Đặt vật thể',exact:true}).click()
 await page.getByLabel('Template vật thể',{exact:true}).selectOption(String(template.id))
 await expect(page.getByText('Sẵn sàng đặt.',{exact:false})).toBeVisible()
 const index=Math.max(...native.objects.map(o=>o.index))+1
 let target
 for(let row=8;row<22&&!target;row++)for(let col=15;col<42&&!target;col++){
  const object={index,templateId:template.id,cellX:col,cellY:row},p=objectPlacement(object,template),x=p.x+p.width*.3+.123,y=p.y+p.height*.3+.321
  if(x>0&&y>0&&x<1392&&y<720&&hitObject({...native,objects:[...native.objects,object]},templates,x,y)?.index===index)target={object,x,y}
 }
 expect(target).toBeTruthy();await clickCell(page,target.object.cellX,target.object.cellY)
 await expect(page.locator('.map-inspector')).toContainText(`Vật thể #${index}`)
 let doc=await exported(page);expect(doc.objects).toHaveLength(78);expect(doc.objects.find(o=>o.index===index)).toEqual(target.object)
 await page.getByRole('button',{name:'Kéo vật thể',exact:true}).click()
 const a=await screen(page,target.x,target.y),b=await screen(page,target.x+48,target.y+24)
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:5});await page.mouse.up()
 doc=await exported(page);expect(doc.objects.find(o=>o.index===index)).toMatchObject({cellX:target.object.cellX+2,cellY:target.object.cellY+1})
 await page.getByRole('button',{name:'Undo',exact:true}).click();expect((await exported(page)).objects.find(o=>o.index===index)).toEqual(target.object)
 await page.getByRole('button',{name:'Redo',exact:true}).click()
 await page.getByRole('button',{name:'Nhân bản vật thể',exact:true}).click();expect((await exported(page)).objects).toHaveLength(79)
 await page.getByRole('button',{name:'Xóa vật thể',exact:true}).click();expect((await exported(page)).objects).toHaveLength(78)
 await page.getByRole('button',{name:'Undo',exact:true}).click();doc=await exported(page);expect(doc.objects).toHaveLength(79)
 expect(doc.collision).toEqual(collisionGrid(doc,templates));expect(doc.source.sha256).toBe(native.source.sha256)
 const png=await download(page,'Tải PNG map');expect(png.name).toContain('-edited-');expect(png.bytes.equals(beforePNG.bytes)).toBe(false)
 const archive=await download(page,'Xuất map cho Phaser');expect(archive.name).toContain('-edited.zip')
 const zip=unzipSync(archive.bytes),map=JSON.parse(strFromU8(zip['map.json']))
 expect(map.editInfo.modified).toBe(true);expect(map.objects).toEqual(doc.objects);expect(map.collision).toEqual(doc.collision)
 const imagePath=map.objectTemplates[template.id].asset.image
 expect(createHash('sha256').update(zip[imagePath]).digest('hex')).toBe(template.asset.sha256)
 await page.route('**/map-smoke/**',route=>{
  const path=new URL(route.request().url()).pathname.replace('/map-smoke/','')
  if(path==='index.html')return route.fulfill({contentType:'text/html',body:'<script type="module" src="/tests/mapHarness.js"></script>'})
  return route.fulfill({status:zip[path]?200:404,contentType:path.endsWith('.png')?'image/png':path.endsWith('.js')?'text/javascript':'application/json',body:zip[path]?Buffer.from(zip[path]):'missing'})
 })
 await page.goto('/map-smoke/index.html');await expect.poll(()=>page.evaluate(()=>window.mapReady===true)).toBe(true)
 const actual=await page.evaluate(()=>({objects:window.mapActor.objectLayer.length,collision:window.mapActor.collision}))
 expect(actual).toEqual({objects:79,collision:doc.collision})
 expect(errors).toEqual([])
})


test('import requiring a missing object PNG leaves draft/history intact and recovers on retry',async({page})=>{
 const used=new Set(native.objects.map(o=>templates[o.templateId].asset.image)),t=table.templates.find(t=>t.asset&&!used.has(t.asset.image))
 const e=createMapEditor(native,templates,table.source.sha256);e.add(t.id,20,15)
 const file={name:'object.map-draft.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(e.draft()))}
 await page.route('**/game/'+t.asset.image,route=>route.fulfill({status:404,body:'missing'}))
 await page.goto('/maps');await expect(page.locator('.map-canvas-shell canvas')).toHaveAttribute('data-rendered-map-id','0',{timeout:30000})
 await page.getByLabel('File nháp map',{exact:true}).setInputFiles(file)
 await expect(page.getByRole('alert')).toContainText('Không tải được PNG')
 expect((await exported(page)).objects).toEqual(native.objects)
 await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled()
 await page.unroute('**/game/'+t.asset.image)
 await page.getByLabel('File nháp map',{exact:true}).setInputFiles(file)
 await expect(page.getByRole('status')).toContainText('Đã nhập nháp')
 expect((await exported(page)).objects).toHaveLength(78)
 await page.getByRole('button',{name:'Undo',exact:true}).click();expect((await exported(page)).objects).toEqual(native.objects)
})


test('mobile painting keeps canvas coordinates stable when the draft status changes',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/maps')
 const c=page.locator('.map-canvas-shell canvas');await expect(c).toHaveAttribute('data-rendered-map-id','0',{timeout:30000})
 const col=26,row=13,tile=[2,3,4,72].find(t=>[0,1,2,3].every(dx=>native.tiles[row*58+col+dx]!==t))
 await page.getByRole('button',{name:'Bút tile',exact:true}).click();await page.getByRole('button',{name:`Chọn tile ${tile}`,exact:true}).click()
 const a=await screen(page,col*24+12,row*24+12),b=await screen(page,(col+3)*24+12,row*24+12)
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:3});await page.mouse.up()
 const doc=await exported(page),expected=[...native.tiles];for(let dx=0;dx<4;dx++)expected[row*58+col+dx]=tile
 expect(doc.tiles).toEqual(expected)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})
