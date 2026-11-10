import {createMapEditor} from './mapEditor.js'
import {validateMap} from './mapGeometry.js'
const MAX_PIXELS=16000000
export function pngMapSize(width,height,density,pad=false){
 if(![width,height,density].every(Number.isInteger)||width<1||height<1||![1,2,3,4].includes(density)||width*height>MAX_PIXELS)throw new Error('PNG tối đa 16 triệu pixel; mật độ phải là x1–x4')
 const size=24*density,cols=Math.ceil(width/size),rows=Math.ceil(height/size),paddedWidth=cols*size,paddedHeight=rows*size
 if(cols>127||rows>127||paddedWidth*paddedHeight>MAX_PIXELS)throw new Error('Map tối đa 127 × 127 ô và 16 triệu pixel sau thêm viền')
 const needsPadding=paddedWidth!==width||paddedHeight!==height
 return {size,cols,rows,paddedWidth,paddedHeight,needsPadding,ready:!needsPadding||pad}
}
// Hash buckets are only a lookup optimization: every match compares all RGBA bytes.
export function splitPngTiles(pixels,width,height,density,pad=false){
 const info=pngMapSize(width,height,density,pad)
 if(!info.ready)throw new Error('Kích thước chưa chia hết cho ô; hãy chọn thêm viền trong suốt')
 if(pixels.length!==width*height*4)throw new Error('Dữ liệu pixel PNG không hợp lệ')
 const unique=[],tiles=[],buckets=new Map(),s=info.size
 for(let row=0;row<info.rows;row++)for(let col=0;col<info.cols;col++){
  const bytes=new Uint8ClampedArray(s*s*4);let hash=2166136261
  for(let y=0;y<s;y++)for(let x=0;x<s;x++){
   const target=(y*s+x)*4,sx=col*s+x,sy=row*s+y
   for(let c=0;c<4;c++){const value=sx<width&&sy<height?pixels[(sy*width+sx)*4+c]:0;bytes[target+c]=value;hash=Math.imul(hash^value,16777619)>>>0}
  }
  let index=(buckets.get(hash)??[]).find(i=>unique[i].every((v,j)=>v===bytes[j]))
  if(index===undefined){index=unique.length;unique.push(bytes);const bucket=buckets.get(hash)??[];bucket.push(index);buckets.set(hash,bucket)}
  tiles.push(index+1)
 }
 return {...info,tiles,unique}
}
export async function readMapPNG(file){
 if(file.size>16*1024*1024)throw new Error('File PNG tối đa 16 MB')
 const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer)
 if(bytes.length<24||![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))throw new Error('Hãy chọn file PNG hợp lệ')
 const width=view.getUint32(16),height=view.getUint32(20)
 if(width<1||height<1||width*height>MAX_PIXELS)throw new Error('PNG tối đa 16 triệu pixel')
 const image=await createImageBitmap(new Blob([bytes],{type:'image/png'}))
 return {image,bytes,width,height,name:file.name.replace(/\.png$/i,'')}
}
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')
export async function buildPngMap(source,{density=4,pad=false,name=source.name},reference){
 const c=document.createElement('canvas');c.width=source.width;c.height=source.height
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(source.image,0,0)
 const split=splitPngTiles(ctx.getImageData(0,0,c.width,c.height).data,c.width,c.height,density,pad)
 const columns=Math.min(split.unique.length,Math.floor(4096/split.size)),rows=Math.ceil(split.unique.length/columns)
 const atlas=document.createElement('canvas');atlas.width=columns*split.size;atlas.height=rows*split.size
 if(atlas.width*atlas.height>MAX_PIXELS)throw new Error('Atlas vượt giới hạn 16 triệu pixel')
 const ac=atlas.getContext('2d')
 split.unique.forEach((bytes,i)=>ac.putImageData(new ImageData(bytes,split.size,split.size),i%columns*split.size,Math.floor(i/columns)*split.size))
 const blob=await new Promise(resolve=>atlas.toBlob(resolve,'image/png'))
 if(blob?.size>16*1024*1024)throw new Error('Atlas PNG vượt 16 MB; hãy chia map thành khu vực nhỏ hơn')
 if(!blob)throw new Error('Không tạo được atlas PNG')
 const bytes=new Uint8Array(await blob.arrayBuffer()),hash=await sha(bytes),originalHash=await sha(source.bytes)
 const identity=await sha(new TextEncoder().encode(`${originalHash}:${density}:${pad}`))
 const id=-1-parseInt(identity.slice(0,7),16),image=atlas.toDataURL('image/png')
 const map={version:1,id,name:String(name).trim().slice(0,120)||'Map PNG mới',width:split.cols,height:split.rows,tileSize:24,tiles:split.tiles,objects:[],warps:[],spawns:[],npcReferences:[],collisionOverrides:{},tileset:{id:-1,kind:'imported-png',info:[split.unique.length+1,split.unique.length+1],terrain:{source:'Imported PNG atlas',image,width:atlas.width,height:atlas.height,density,columns,tileCount:split.unique.length,sha256:hash}},source:{path:source.name+'.png',sha256:identity,originalPngSha256:originalHash,width:source.width,height:source.height,paddedWidth:split.paddedWidth,paddedHeight:split.paddedHeight,provenance:'user-imported-png'},limitations:['Map nhập PNG: collision mặc định đi được; ô trống ID0 bị chặn. Hãy tự cấu hình vùng chặn.','Ảnh nền không tự tách vật thể/NPC, cổng hoặc animation nước/thác.']}
 validateMap(map,reference.templates)
 return {map,templates:reference.templates,tableSource:reference.tableSource,images:new Map([[image,atlas]])}
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
