import {gameUrl} from '../catalog'
import {loadImage} from '../export'
import {mapAssets,validateMap} from './mapGeometry.js'

async function read(path) {
  const response=await fetch(gameUrl(path))
  if(!response.ok || response.headers.get('content-type')?.includes('text/html'))throw new Error(`Không tải được dữ liệu map: ${path}`)
  return response.json()
}
let tableRequest, indexRequest
const requests=new Map()
export function loadMapIndex() {
  if(!indexRequest)indexRequest=read('maps/index.json').catch(e=>{indexRequest=null;throw e})
  return indexRequest
}
export async function loadMapAsset(asset) {
  if(!asset?.image)throw new Error('Template chưa có PNG được hỗ trợ')
  const image=await loadImage(asset)
  if(image.naturalWidth!==asset.width || image.naturalHeight!==asset.height)throw new Error('Kích thước PNG không khớp metadata map: '+asset.source)
  return image
}
export async function loadMap(id) {
  if(!Number.isInteger(Number(id))||Number(id)<0)throw new Error('Map ID không hợp lệ')
  if(!tableRequest)tableRequest=read('maps/objects.json').catch(e=>{tableRequest=null;throw e})
  if(!requests.has(String(id)))requests.set(String(id),read(`maps/${Number(id)}.json`).catch(e=>{requests.delete(String(id));throw e}))
  const [map,table]=await Promise.all([requests.get(String(id)),tableRequest])
  const templates=Object.fromEntries(table.templates.map(t=>[t.id,t]))
  validateMap(map,templates)
  const assets=mapAssets(map,templates)
  const images=new Map(await Promise.all(assets.map(async a=>{
    const image=await loadMapAsset(a)
    return [a.image,image]
  })))
  return {map,templates,images,tableSource:table.source}
}
