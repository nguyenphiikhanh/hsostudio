import { compilePart } from '../library/partSchema.js'
import { validateCompanion } from '../companionPose.js'
import { serverIntegration, H5_ID_MAX } from './mysql.js'
const clone = value => JSON.parse(JSON.stringify(value))
const canonical = value => JSON.stringify(value, function(_key,v){return v && typeof v==='object' && !Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v})
const body = slot => slot==='pants'||slot==='shirt'
export function textureDensity(asset,width,height) {
  const logicalWidth=asset.width/(asset.density||1),logicalHeight=asset.height/(asset.density||1)
  const density=width/logicalWidth
  if(![1,2,3,4].includes(density)||height!==logicalHeight*density)throw new Error(`PNG phải giữ bố cục ${logicalWidth} × ${logicalHeight} logical; cho phép x1–x4, không cắt/đổi sheet.`)
  return density
}
export function validateIdentity(template,id,label) {
  const max=H5_ID_MAX
  if(!Number.isInteger(id)||id<0||id>max)throw new Error(`ID thiết kế phải là số nguyên 0–${max}`)
  if(typeof label!=='string'||!label.trim()||[...label].length>255||/[\u0000-\u001f]/.test(label))throw new Error('Tên thiết kế cần 1–255 ký tự và không chứa ký tự điều khiển')
}
export function makeDesign(template,{id,label,item,resources,itemId,reference=false}) {
  if(reference){if(!/^[a-zA-Z0-9_-]+$/.test(String(id)))throw new Error('ID nguồn không hợp lệ')}else validateIdentity(template,id,label)
  if(!resources.sheet)throw new Error('Thiếu PNG chính')
  const slot=template.slot,definition=clone(template.definition)
  const assetSource=`custom-design:${slot}/${id}`
  const meta=(key,base)=>({...clone(base),...resources[key],id:`${assetSource}/${key}`,image:`${key}.png`,source:reference?base.source:`${assetSource}/${key}`,provenance:reference?base.provenance:'custom-design'})
  if(body(slot)) {
    Object.assign(definition,{partId:id,label,density:resources.sheet.density,width:resources.sheet.width,height:resources.sheet.height,source:reference?template.definition.source:assetSource,provenance:reference?definition.provenance:'custom-design'})
    compilePart(definition,'design')
  } else if(slot==='weapon') {
    // Persist the native geometry, not the large skill/effect catalog or session URLs.
    const w=template.layer.clientWeapon
    Object.assign(definition,{frames:clone(w.frames),offsets:clone(w.offsets),clazz:template.clazz,part:id,provenance:reference?w.provenance:'custom-design',source:reference?w.source:assetSource,image:'sheet.png',width:resources.sheet.width,height:resources.sheet.height,density:resources.sheet.density,
      splash:resources.splash?meta('splash',w.splash):null})
    delete definition.skillOne;delete definition.skillTwo;delete definition.skillThree;delete definition.skillFour;delete definition.skillEffects
  } else {
    definition.id=String(id);definition.label=label;definition.asset=meta('sheet',template.assets.sheet);definition.provenance=reference?template.layer.provenance:'custom-design'
    delete definition.asset.sha256
    definition.asset.sha256=resources.sheet.sha256
    if(!reference){definition.itemIds=[];definition.serverAppearanceStatus='not-registered'}
    validateCompanion(definition,slot)
  }
  let serverItem=null
  if(item){
    const row=clone(item.row)
    serverItem={table:item.table,sourceId:item.sourceId??item.row.id,row}
  }
  const requestedItemId=itemId??(!reference?item?.row.id:undefined)
  if(requestedItemId!==undefined&&(!Number.isInteger(requestedItemId)||requestedItemId<0||requestedItemId>H5_ID_MAX))throw new Error('ID vật phẩm H5 phải trong 0–2147483647')
  const sourceRow=serverItem?.row
  const h5Item=requestedItemId===undefined?null:{id:requestedItemId,label:label.trim(),requirements:sourceRow?{clazz:sourceRow.clazz??null,level:sourceRow.level??null}:{},stats:{format:'hso-template-options-v1',options:sourceRow?.data?JSON.parse(sourceRow.data):[]},source:serverItem?clone(serverItem):{kind:'custom-design',noGameplayStats:true}}
  return {schema:'hso-part-design' ,version:1,mode:reference?'source-reference':'draft',slot,id,label:label.trim(),provenance:reference?template.layer.provenance:'custom-design',
    template:{key:template.key,id:template.id,clazz:template.clazz??null,assets:clone(template.assets)},coordinateUnits:'x1',
    resources:clone(resources),definition,serverItem,h5Item,serverIntegration:serverIntegration(slot),
    preview:{layout:'inherited-template',weaponAttack:slot==='weapon'?(resources.splash?'custom-wps':'hidden-until-wps-uploaded'):null}}
}
export function designLayer(template,document,images) {
  const l=clone(template.layer),r=document.resources.sheet,source=`custom-design:${document.slot}/${document.id}`
  l.asset={...l.asset,...r,id:`${source}/sheet`,source,image:images.sheet}
  l.name=document.label;l.partId=document.id;l.provenance='custom-design'
  l.customDesign={id:document.id,slot:document.slot,templateKey:template.key,splashReady:Boolean(images.splash),label:document.label}
  if(l.companion){l.companion=clone(document.definition);l.companion.asset={...l.asset}}
  if(l.clientWeapon){
    l.clientWeapon={...l.clientWeapon,...l.asset,part:document.id,frames:clone(document.definition.frames),offsets:clone(document.definition.offsets)}
    if(images.splash)l.clientWeapon.splash={...clone(document.definition.splash),image:images.splash}
  }
  return l
}
export function validateRestoredDesign(doc,template) {
  if(doc?.schema!=='hso-part-design'||doc.version!==1||doc.mode!=='draft'||doc.slot!==template.slot||doc.template?.key!==template.key)throw new Error('JSON không phải thiết kế nháp đúng loại/template đang chọn')
  validateIdentity(template,doc.id,doc.label)
  if(!doc.resources?.sheet||Object.keys(doc.resources).some(k=>!['sheet','splash'].includes(k)))throw new Error('Danh sách PNG trong JSON không hợp lệ')
  for(const [key,resource] of Object.entries(doc.resources)) {
    if(!template.assets[key]||textureDensity(template.assets[key],resource.width,resource.height)!==resource.density||!/^[a-f0-9]{64}$/.test(resource.sha256))throw new Error('PNG/density/checksum trong JSON không hợp lệ')
  }
  const expected=makeDesign(template,{id:doc.id,label:doc.label,resources:doc.resources})
  if(canonical(expected.definition)!==canonical(doc.definition)||canonical(doc.template.assets)!==canonical(template.assets))throw new Error('JSON đã đổi frame/rig hoặc khác phiên bản mẫu; chỉ hỗ trợ kế thừa nguyên bố cục')
  return doc
}
