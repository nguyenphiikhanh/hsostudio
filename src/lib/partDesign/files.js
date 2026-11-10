import { gameUrl } from '../catalog'
import { download, downloadZip } from '../export'
import { h5Content } from './mysql.js'
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
  if(!['json','zip'].includes(format))throw new Error('SQL chỉ hiển thị để sao chép trong Studio, không tải file')
  if(format==='json')return download(`${stem}.design.json`,document)
  const content=h5Content(document)
  const entries={'design.json':document,'h5-content.json':content,
    'README.md':`# ${document.label}\n\nGói PNG/JSON; SQL chỉ hiển thị để sao chép trong Studio, không có file SQL trong ZIP.\n\nChạy SQL khởi tạo MySQL H5 một lần. Chép thư mục assets/ vào asset root của server, giữ nguyên đường dẫn bên trong. Sau đó sao chép SQL đăng ký part trong Studio và chạy trong database H5.\n\nĐường dẫn PNG:\n${content.assets.map(a=>'- '+a.path).join('\n')}\n\nSQL chỉ ghi h5_* tables, không sửa HSO item3/item4. Cùng ID đã có sẽ báo lỗi, không ghi đè. Chạy lại cần ID mới hoặc migration riêng. Server H5 cần đọc contract v1, phục vụ PNG, cache theo content_revision và triển khai các renderer đã khai báo; đăng ký dữ liệu không tự tạo server/gameplay. Không tự cấp vật phẩm vào túi người chơi.\n\nMở lại nháp: nhập design.json và các PNG sheet/splash tương ứng (checksum phải khớp).\n`}

  for(const key of Object.keys(document.resources)){
    if(!files[key])throw new Error('Thiếu PNG trong gói thiết kế: '+key)
    entries[`assets/${content.assets.find(a=>a.role===key).path}`]=files[key]
  }
  return downloadZip(stem+'-design',entries)
}
