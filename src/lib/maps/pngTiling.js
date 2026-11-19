const MAX_PIXELS=16000000
export function pngMapSize(width,height,density,pad=false,{cols,rows,mode='original',crop=false}={}){
 if(![width,height,density].every(Number.isInteger)||width<1||height<1||![1,2,3,4].includes(density)||width*height>MAX_PIXELS)throw new Error('PNG tối đa 16 triệu pixel; mật độ phải là x1–x4')
 const size=24*density,custom=cols!==undefined||rows!==undefined
 cols=custom?cols:Math.ceil(width/size);rows=custom?rows:Math.ceil(height/size)
 if(!Number.isInteger(cols)||!Number.isInteger(rows)||cols<1||rows<1||cols>127||rows>127)throw new Error('Map phải có 1–127 ô ngang và dọc')
 const paddedWidth=cols*size,paddedHeight=rows*size
 if(paddedWidth*paddedHeight>MAX_PIXELS)throw new Error('Map tối đa 16 triệu pixel sau đổi kích thước')
 if(!['original','contain','cover'].includes(mode))throw new Error('Cách đặt ảnh không hợp lệ')
 const scale=mode==='original'?1:mode==='contain'?Math.min(paddedWidth/width,paddedHeight/height):Math.max(paddedWidth/width,paddedHeight/height)
 const drawWidth=width*scale,drawHeight=height*scale
 const x=mode==='original'?0:(paddedWidth-drawWidth)/2,y=mode==='original'?0:(paddedHeight-drawHeight)/2
 const needsPadding=drawWidth<paddedWidth-0.001||drawHeight<paddedHeight-0.001,needsCrop=drawWidth>paddedWidth+0.001||drawHeight>paddedHeight+0.001
 return {size,cols,rows,paddedWidth,paddedHeight,needsPadding,needsCrop,scale,placement:{x,y,width:drawWidth,height:drawHeight},mode,ready:(!needsPadding||pad)&&(!needsCrop||crop)}
}
// Hash buckets are an optimization only; equality compares every RGBA byte.
export function splitPngTiles(pixels,width,height,density,pad=false,options={},progress=()=>{}){
 const info=pngMapSize(width,height,density,pad,options)
 if(!info.ready)throw new Error(info.needsCrop&&!options.crop?'Hãy cho phép cắt phần ảnh ngoài map':'Kích thước chưa chia hết cho ô; hãy chọn thêm viền trong suốt')
 if(info.mode!=='original'||info.scale!==1)throw new Error('Ảnh cần được đặt vào canvas đích trước khi cắt tile')
 if(pixels.length!==width*height*4)throw new Error('Dữ liệu pixel PNG không hợp lệ')
 const unique=[],tiles=[],buckets=new Map(),s=info.size
 for(let row=0;row<info.rows;row++){
  for(let col=0;col<info.cols;col++){
   const bytes=new Uint8ClampedArray(s*s*4);let hash=2166136261
   for(let y=0;y<s;y++)for(let x=0;x<s;x++){
    const target=(y*s+x)*4,sx=col*s+x,sy=row*s+y
    for(let c=0;c<4;c++){const value=sx<width&&sy<height?pixels[(sy*width+sx)*4+c]:0;bytes[target+c]=value;hash=Math.imul(hash^value,16777619)>>>0}
   }
   let index=(buckets.get(hash)??[]).find(i=>unique[i].every((v,j)=>v===bytes[j]))
   if(index===undefined){index=unique.length;unique.push(bytes);const bucket=buckets.get(hash)??[];bucket.push(index);buckets.set(hash,bucket)}
   tiles.push(index+1)
  }
  progress((row+1)/info.rows)
 }
 return {...info,tiles,unique}
}
