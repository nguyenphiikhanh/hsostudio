import {gameUrl} from '../catalog'
import {downloadZip,exportFileName,download} from '../export'
import {mapAssets,collisionGrid} from './mapGeometry.js'
import {drawMap} from './mapCanvas.js'
import {effectAssets} from './mapEffects.js'
import effectsSource from './mapEffects.js?raw'
import geometrySource from './mapGeometry.js?raw'
import runtimeSource from './mapRuntime.js?raw'

function nameOf(map,modified=false){return exportFileName(`map-${map.id}-${map.name}${modified?'-edited':''}`)}
export function mapDocument(data) {
  const {map,templates}=data
  const objectTemplates=Object.fromEntries([...new Set(map.objects.map(o=>o.templateId))].map(id=>[id,templates[id]]))
  return {...map,editInfo:data.editInfo??{modified:false},sourceScope:map.tileset.kind==='imported-png'?'User imported PNG; no native HSO layout.':data.editInfo?.modified?'Reference base packet; rawHex/checksum do not encode Studio edits.':'Original native layout',objectTableSource:data.tableSource,objectTemplates,collision:collisionGrid(map,templates),rendering:{mode:map.tileset.kind==='imported-png'?'imported-png-grid':'native-waterfall-v1',animation:{water:false,waterfall:false,...data.animation},coordinateUnits:'x1',textureDensity:map.tileset.terrain.density,markerActors:false,layout:data.editInfo?.modified?'studio-draft':'native'}}
}
export function exportMapJSON(data){download(nameOf(data.map,data.editInfo?.modified)+'.json',new Blob([JSON.stringify(mapDocument(data),null,2)],{type:'application/json'}))}
export async function exportMapPNG(data,density=1) {
  if(![1,4].includes(density))throw new Error('Độ phân giải PNG không hợp lệ')
  const m=data.map,w=m.width*m.tileSize*density,h=m.height*m.tileSize*density
  if(w*h>64000000)throw new Error('PNG vượt giới hạn 64 triệu pixel; hãy chọn x1')
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h
  const ctx=canvas.getContext('2d');ctx.scale(density,density)
  drawMap(ctx,m,data.templates,data.images,{terrain:true,objects:true,...data.animation,tick:0})
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Không tạo được PNG map'))))
  download(`${nameOf(m,data.editInfo?.modified)}-x${density}.png`,blob)
}
export async function exportMapZIP(data) {
  const doc=JSON.parse(JSON.stringify(mapDocument(data))),files={},paths=new Map()
  paths.set(data.map.tileset.terrain.image,'tiles/terrain.png')
  for(const o of data.map.objects){const d=data.templates[o.templateId];paths.set(d.asset.image,`objects/${d.image}.png`)}
  for(const a of effectAssets(data.map))paths.set(a.image,`effects/${a.sha256}.png`)
  for(const a of mapAssets(data.map,data.templates)){
    const response=await fetch(gameUrl(a.image))
    if(!response.ok || response.headers.get('content-type')?.includes('text/html'))throw new Error('Không tải được PNG map: '+a.source)
    const bytes=new Uint8Array(await response.arrayBuffer())
    if(bytes.length<24 || ![137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))throw new Error('Dữ liệu không phải PNG: '+a.source)
    const header=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
    if(header.getUint32(16)!==a.width || header.getUint32(20)!==a.height)throw new Error('Kích thước PNG map không khớp: '+a.source)
    files[paths.get(a.image)]=bytes
  }
  doc.tileset.terrain.image=paths.get(doc.tileset.terrain.image)
  doc.tileset.water=null;doc.tileset.mini=null
  for(const a of effectAssets(doc))a.image=paths.get(a.image)
  for(const d of Object.values(doc.objectTemplates))d.asset.image=paths.get(d.asset.image)
  files['map.json']=doc;files['mapEffects.js']=effectsSource;files['mapGeometry.js']=geometrySource;files['runtime.js']=runtimeSource
  files['package.json']={private:true,type:'module'}
  files['example.js']=`import {preloadMap,createMap} from './runtime.js';\n// Fetch map.json before creating a Phaser scene.\nexport function mapScene(Phaser,map,baseUrl='.') {\n return class extends Phaser.Scene {\n  preload(){preloadMap(this,baseUrl,map)}\n  create(){this.map=createMap(this,map);this.cameras.main.setBounds(0,0,this.map.width,this.map.height)}\n };\n}\n`
  files['README.md']=`# ${doc.name}\n\n${doc.tileset.kind==='imported-png'?'MAP NHẬP PNG CỦA NGƯỜI DÙNG: collision mặc định đi được, không tự nhận diện vật thể hoặc hiệu ứng.':doc.editInfo.modified?'LAYOUT BẢN NHÁP STUDIO: tile/vật thể đã chỉnh; không phải layout HSO gốc. Raw/checksum giữ để tham chiếu bản gốc.':'Layout nguồn gốc, chưa chỉnh sửa trong Studio.'}\n\nPNG giữ density trong metadata (ảnh nhập x1–x4), layout dùng đơn vị x1; ô24×24. Nạp map.json trước Scene, gọi preloadMap trong preload và createMap trong create (xem example.js). Runtime cần thư viện Phaser của game; không cần HSO/JAR/Python.\n\nBản xuất nền tĩnh theo client tick7, PNG vật thể gốc và vị trí của layout đang xem. terrainLayer là nền; objectLayer đã sắp xếp theo y như client. Nếu thêm actor, tự đưa vào lớp phù hợp và cập nhật depth; chưa khôi phục toàn bộ quy tắc actor/NPC.\n\ncollisionAt(x,y): 0 bình thường,1 chặn hoặc ngoài map,2 chậm theo client. Collision chỉ gồm nền và template.Block, chưa có NPC/event/runtime server. Không tự bật physics/pathfinding.\n\nSpawn/cổng/NPC tham chiếu nằm trong map.json; không được vẽ thành actor. Nước/thác phục hồi theo client 4.0.3; map.rendering.animation giữ lựa chọn xuất. Gọi map.setAnimations({water:true,waterfall:true}) để bật hoặc false để tắt từng lớp. Thác dùng ảnh x1 gốc; nước tileset 9/11/12 fallback x1 có provenance. Background/parallax và đuôi hiệu ứng chưa được dựng. PNG/JSON export không ghi thay đổi vào server. Raw nguồn và checksum giữ trong source; giữ tọa độ, không tự suy diễn metadata chưa hiểu.\n`
  await downloadZip(nameOf(doc,doc.editInfo.modified),files)
}
