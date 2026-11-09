import { gameUrl } from '../catalog'
import { download, downloadZip } from '../export'
import { designSQL } from './mysql.js'
import { textureDensity } from './schema.js'
const signature=[137,80,78,71,13,10,26,10]
export const sha256 = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')
export async function readDesignPNG(blob,asset) {
  if(blob.size>20*1024*1024)throw new Error('PNG vượt giới hạn 20 MB')
  const bytes=new Uint8Array(await blob.arrayBuffer())
  if(bytes.length<33||signature.some((v,i)=>bytes[i]!==v)||String.fromCharCode(...bytes.slice(12,16))!=='IHDR')throw new Error('File không có cấu trúc PNG hợp lệ')
  const view=new DataView(bytes.buffer),width=view.getUint32(16),height=view.getUint32(20)
  if(width<1||height<1||width>8192||height>8192||width*height>32*1024*1024)throw new Error('Kích thước PNG vượt giới hạn 8192px / 32 triệu pixel')
  const density=textureDensity(asset,width,height)
  const url=URL.createObjectURL(new Blob([bytes],{type:'image/png'}))
  try {
    const image=new Image();image.src=url;await image.decode()
    if(image.naturalWidth!==width||image.naturalHeight!==height)throw new Error('Kích thước PNG không khớp dữ liệu giải mã')
    return {url,bytes,meta:{file:'sheet.png',width,height,density,sha256:await sha256(bytes),byteLength:bytes.length}}
  }catch{URL.revokeObjectURL(url);throw new Error('Không giải mã được PNG; hãy chọn ảnh PNG đầy đủ')}
}
export async function readSourcePNG(asset) {
  const response=await fetch(gameUrl(asset.image))
  if(!response.ok||response.headers.get('content-type')?.includes('text/html'))throw new Error(`Không tải được PNG mẫu: ${asset.source}`)
  const result=await readDesignPNG(await response.blob(),asset)
  URL.revokeObjectURL(result.url)
  return result
}
export async function exportDesign(document,files,format='zip') {
  const stem=`${document.slot}-${document.id}`
  if(format==='json')return download(`${stem}.design.json`,document)
  if(format==='sql')return download(`${stem}.mysql.sql`,designSQL(document),'text/plain;charset=utf-8')
  const entries={'design.json':document,'item.mysql.sql':designSQL(document),
    'README.md':`# ${document.label}\n\n${document.mode==='draft'?'Thiết kế nháp của người dùng; rig/frame kế thừa mẫu.':'Tham chiếu tài nguyên gốc.'}\n\nĐơn vị frame/anchor: x1. PNG có density riêng. design.json giữ định nghĩa và SHA-256 PNG. Để mở lại trong Studio: nhập JSON nháp rồi chọn lại các PNG có checksum khớp.\n\nSQL chỉ INSERT template vào bảng ${document.serverItem?.table??'(không có vật phẩm mẫu)'} của MySQL HSO, không chứa PNG/rig. Không có lệnh ghi đè dữ liệu. Không import SQL vào catalog.sqlite của Studio. Kiểm tra ID trên database đích trước khi dùng. ID gợi ý chỉ biết catalog đóng gói, không biết database đang chạy.\n\nCần làm tiếp để dùng trong HSO:\n${document.serverIntegration.remaining.map(s=>'- '+s).join('\n')}\n\nManager dùng list theo index; ID vật phẩm phải liên tục và thứ tự nạp phải khớp ID. PNG/JSON này không phải packet -52 và không được tự động chép vào server/client. SQL không thêm mapping thú/pet trong Java. Thiết kế mới chỉ preview trong Studio cho tới khi tích hợp nguồn game.\n`}
  for(const key of Object.keys(document.resources)){
    if(!files[key])throw new Error('Thiếu PNG trong gói thiết kế: '+key)
    entries[`${key}.png`]=files[key]
  }
  return downloadZip(stem+'-design',entries)
}
