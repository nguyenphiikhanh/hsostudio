import {gameUrl} from '../catalog'
import {downloadZip,exportFileName,download} from '../export'
import {mapAssets,collisionGrid} from './mapGeometry.js'
import {drawMap} from './mapCanvas.js'
import geometrySource from './mapGeometry.js?raw'
import runtimeSource from './mapRuntime.js?raw'

function nameOf(map){return exportFileName(`map-${map.id}-${map.name}`)}
export function mapDocument(data) {
  const {map,templates}=data
  const objectTemplates=Object.fromEntries([...new Set(map.objects.map(o=>o.templateId))].map(id=>[id,templates[id]]))
  return {...map,objectTableSource:data.tableSource,objectTemplates,collision:collisionGrid(map,templates),rendering:{mode:'native-static-tick-7',coordinateUnits:'x1',textureDensity:4,markerActors:false}}
}
export function exportMapJSON(data){download(nameOf(data.map)+'.json',new Blob([JSON.stringify(mapDocument(data),null,2)],{type:'application/json'}))}
export async function exportMapPNG(data,density=1) {
  if(![1,4].includes(density))throw new Error('Độ phân giải PNG không hợp lệ')
  const m=data.map,w=m.width*m.tileSize*density,h=m.height*m.tileSize*density
  if(w*h>64000000)throw new Error('PNG vượt giới hạn 64 triệu pixel; hãy chọn x1')
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h
  const ctx=canvas.getContext('2d');ctx.scale(density,density)
  drawMap(ctx,m,data.templates,data.images)
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Không tạo được PNG map'))))
  download(`${nameOf(m)}-x${density}.png`,blob)
}
export async function exportMapZIP(data) {
  const doc=JSON.parse(JSON.stringify(mapDocument(data))),files={},paths=new Map()
  paths.set(data.map.tileset.terrain.image,'tiles/terrain.png')
  for(const o of data.map.objects){const d=data.templates[o.templateId];paths.set(d.asset.image,`objects/${d.image}.png`)}
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
  for(const d of Object.values(doc.objectTemplates))d.asset.image=paths.get(d.asset.image)
  files['map.json']=doc;files['mapGeometry.js']=geometrySource;files['runtime.js']=runtimeSource
  files['package.json']={private:true,type:'module'}
  files['example.js']=`import {preloadMap,createMap} from './runtime.js';\n// Fetch map.json before creating a Phaser scene.\nexport function mapScene(Phaser,map,baseUrl='.') {\n return class extends Phaser.Scene {\n  preload(){preloadMap(this,baseUrl,map)}\n  create(){this.map=createMap(this,map);this.cameras.main.setBounds(0,0,this.map.width,this.map.height)}\n };\n}\n`
  files['README.md']=`# ${doc.name}\n\nPNG x4 gốc, layout dùng đơn vị x1; ô24×24. Nạp map.json trước Scene, gọi preloadMap trong preload và createMap trong create (xem example.js). Runtime cần thư viện Phaser của game; không cần HSO/JAR/Python.\n\nBản xuất nền tĩnh theo client tick7 và vật thể gốc. terrainLayer là nền; objectLayer đã sắp xếp theo y như client. Nếu thêm actor, tự đưa vào lớp phù hợp và cập nhật depth; chưa khôi phục toàn bộ quy tắc actor/NPC.\n\ncollisionAt(x,y): 0 bình thường,1 chặn hoặc ngoài map,2 chậm theo client. Collision chỉ gồm nền và template.Block, chưa có NPC/event/runtime server. Không tự bật physics/pathfinding.\n\nSpawn/cổng/NPC tham chiếu nằm trong map.json; không được vẽ thành actor. Nước/thác động, background/parallax, đuôi hiệu ứng chưa được dựng. PNG/JSON export không ghi thay đổi vào server. Raw nguồn và checksum giữ trong source; giữ tọa độ, không tự suy diễn metadata chưa hiểu.\n`
  await downloadZip(nameOf(doc),files)
}
