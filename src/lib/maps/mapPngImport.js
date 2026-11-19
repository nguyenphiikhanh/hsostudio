import {createMapEditor} from './mapEditor.js'
import {validateMap} from './mapGeometry.js'
import {pngMapSize} from './pngTiling.js'
export {pngMapSize,splitPngTiles} from './pngTiling.js'
export async function readMapPNG(file){
 if(file.size>16*1024*1024)throw new Error('File PNG tối đa 16 MB')
 const bytes=new Uint8Array(await file.slice(0,24).arrayBuffer()),view=new DataView(bytes.buffer)
 if(bytes.length<24||![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))throw new Error('Hãy chọn file PNG hợp lệ')
 const width=view.getUint32(16),height=view.getUint32(20)
 if(width<1||height<1||width*height>16000000)throw new Error('PNG tối đa 16 triệu pixel')
 const scale=Math.min(1,900/width,360/height)
 const image=await createImageBitmap(file,{resizeWidth:Math.max(1,Math.round(width*scale)),resizeHeight:Math.max(1,Math.round(height*scale)),resizeQuality:'pixelated'})
 return {image,blob:file,width,height,name:file.name.replace(/\.png$/i,'')}
}
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')
function processPng(source,settings,signal,onProgress){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted)return reject(new DOMException('Đã hủy nhập PNG','AbortError'))
  const worker=new Worker(new URL('./mapPngWorker.js',import.meta.url),{type:'module'})
  const cleanup=()=>{signal?.removeEventListener('abort',abort);worker.terminate()}
  const fail=e=>{cleanup();reject(e)}
  const abort=()=>fail(new DOMException('Đã hủy nhập PNG','AbortError'))
  signal?.addEventListener('abort',abort,{once:true})
  worker.onerror=e=>{e.preventDefault();fail(new Error(e.message||'Không chạy được xử lý PNG nền'))}
  worker.onmessage=({data})=>{
   if(data.type==='progress')onProgress?.(data)
   else if(data.type==='error')fail(new Error(data.message))
   else if(data.type==='done'){cleanup();resolve(data.result)}
  }
  worker.onmessageerror=()=>fail(new Error('Không nhận được kết quả xử lý PNG'))
  try{worker.postMessage({blob:source.blob,width:source.width,height:source.height,...settings})}catch(e){fail(e)}
 })
}
export async function buildPngMap(source,{density=4,pad=false,name=source.name,cols,rows,mode='original',crop=false,signal,onProgress},reference){
 pngMapSize(source.width,source.height,density,pad,{cols,rows,mode,crop})
 const result=await processPng(source,{density,pad,options:{cols,rows,mode,crop}},signal,onProgress)
 const {info,tiles,tileCount,columns,image,hash,originalHash,identity,bitmap}=result
 if(signal?.aborted){bitmap.close();throw new DOMException('Đã hủy nhập PNG','AbortError')}
 const id=-1-parseInt(identity.slice(0,7),16)
 const map={version:1,id,name:String(name).trim().slice(0,120)||'Map PNG mới',width:info.cols,height:info.rows,tileSize:24,tiles,objects:[],warps:[],spawns:[],npcReferences:[],collisionOverrides:{},tileset:{id:-1,kind:'imported-png',info:[tileCount+1,tileCount+1],terrain:{source:'Imported PNG atlas',image,width:result.width,height:result.height,density,columns,tileCount,sha256:hash}},source:{path:source.name+'.png',sha256:identity,originalPngSha256:originalHash,width:source.width,height:source.height,paddedWidth:info.paddedWidth,paddedHeight:info.paddedHeight,placement:info.placement,fitMode:info.mode,provenance:'user-imported-png'},limitations:['Map nhập PNG: collision mặc định đi được; ô trống ID0 bị chặn. Hãy tự cấu hình vùng chặn.','Ảnh nền không tự tách vật thể/NPC, cổng hoặc animation nước/thác.']}
 try{validateMap(map,reference.templates)}catch(e){bitmap.close();throw e}
 onProgress?.({percent:100,message:'Đã tạo map nháp.'})
 return {map,templates:reference.templates,tableSource:reference.tableSource,images:new Map([[image,bitmap]])}
}
export async function restorePngDraft(doc,reference){
 const map=doc?.importedBase,a=map?.tileset?.terrain
 if(doc.schema!=='hso-map-draft'||doc.version!==1||map?.tileset?.kind!=='imported-png'||map.id>=0||!a?.image?.startsWith('data:image/png;base64,')||a.image.length>24*1024*1024)throw new Error('Nháp PNG không hợp lệ')
 validateMap(map,reference.templates)
 if(map.effects||!['objects','warps','spawns','npcReferences'].every(key=>Array.isArray(map[key])&&map[key].length===0)||typeof map.source?.sha256!=='string'||map.source.sha256.length!==64)throw new Error('Nguồn nháp PNG không hợp lệ')
 createMapEditor(map,reference.templates,reference.tableSource.sha256).parseDraft(doc)
 const bytes=new Uint8Array(await (await fetch(a.image)).arrayBuffer())
 if(await sha(bytes)!==a.sha256)throw new Error('Checksum atlas PNG không khớp nháp')
 const image=await createImageBitmap(new Blob([bytes],{type:'image/png'}))
 if(image.width!==a.width||image.height!==a.height){image.close();throw new Error('Kích thước atlas không khớp nháp')}
 return {map,templates:reference.templates,tableSource:reference.tableSource,images:new Map([[a.image,image]])}
}
