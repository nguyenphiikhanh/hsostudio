import {pngMapSize,splitPngTiles} from './pngTiling.js'
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')
self.onmessage=async({data})=>{
 let source
 try{
  const {blob,width,height,density,pad,options}=data
  const info=pngMapSize(width,height,density,pad,options)
  if(!info.ready)throw new Error('Cần cho phép thêm viền hoặc cắt ảnh trước khi tạo map')
  const progress=(percent,message)=>self.postMessage({type:'progress',percent,message})
  progress(5,'Đang đọc ảnh gốc…');source=await createImageBitmap(blob)
  if(source.width!==width||source.height!==height)throw new Error('Kích thước PNG không khớp')
  const canvas=new OffscreenCanvas(info.paddedWidth,info.paddedHeight),ctx=canvas.getContext('2d',{willReadFrequently:true}),p=info.placement
  ctx.imageSmoothingEnabled=false;ctx.drawImage(source,p.x,p.y,p.width,p.height);source.close();source=null
  progress(15,'Đang tách và gộp ô trùng…')
  const split=splitPngTiles(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,density,false,{},v=>progress(Math.round(15+v*55),'Đang tách và gộp ô trùng…'))
  const columns=Math.min(split.unique.length,Math.floor(4096/info.size)),rows=Math.ceil(split.unique.length/columns),atlas=new OffscreenCanvas(columns*info.size,rows*info.size)
  if(atlas.width*atlas.height>16000000)throw new Error('Atlas vượt giới hạn 16 triệu pixel')
  progress(75,'Đang ghép atlas…');const ac=atlas.getContext('2d')
  split.unique.forEach((bytes,i)=>ac.putImageData(new ImageData(bytes,info.size,info.size),i%columns*info.size,Math.floor(i/columns)*info.size))
  progress(85,'Đang nén PNG atlas…');const encoded=await atlas.convertToBlob({type:'image/png'})
  if(encoded.size>16*1024*1024)throw new Error('Atlas PNG vượt 16 MB; hãy chia map thành khu vực nhỏ hơn')
  progress(95,'Đang kiểm tra dữ liệu…')
  const hash=await sha(await encoded.arrayBuffer()),originalHash=await sha(await blob.arrayBuffer()),identity=await sha(new TextEncoder().encode(JSON.stringify({originalHash,density,pad,cols:info.cols,rows:info.rows,mode:info.mode,crop:Boolean(options.crop)})))
  const image=new FileReaderSync().readAsDataURL(encoded),bitmap=atlas.transferToImageBitmap()
  self.postMessage({type:'done',result:{info,tiles:split.tiles,tileCount:split.unique.length,columns,width:atlas.width,height:atlas.height,image,hash,originalHash,identity,bitmap}},[bitmap])
 }catch(e){self.postMessage({type:'error',message:e.message??'Không xử lý được PNG'})}
 finally{source?.close()}
}
