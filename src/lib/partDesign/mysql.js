import {clientWalkClip,IDLE_CYCLE,IDLE_FPS,clientBasicClip} from '../characterPose.js'
export const H5_ID_MAX=2147483647
const clone=v=>JSON.parse(JSON.stringify(v))
export function sqlValue(value) {
  if(value===null)return 'NULL'
  if(typeof value==='number'){if(!Number.isSafeInteger(value))throw new Error('Giá trị SQL phải là số nguyên an toàn');return String(value)}
  if(typeof value!=='string')throw new Error('Giá trị SQL không hợp lệ')
  if(value==='')return "''"
  return `CONVERT(0x${Array.from(new TextEncoder().encode(value),b=>b.toString(16).padStart(2,'0')).join('')} USING utf8mb4)`
}
export function h5PartKey(doc){
  if(!['pants','shirt','weapon','mount','pet'].includes(doc.slot)||!/^[a-zA-Z0-9_-]+$/.test(String(doc.id)))throw new Error('ID part H5 không hợp lệ')
  if(doc.slot==='weapon'&&(!Number.isInteger(doc.template?.clazz)||doc.template.clazz<0||doc.template.clazz>3))throw new Error('Phái vũ khí không hợp lệ')
  return doc.slot==='weapon'?`weapon-${doc.template.clazz}-${doc.id}`:`${doc.slot}-${doc.id}`
}
function rigId(doc){
  if(['pants','shirt'].includes(doc.slot))return 'humanoid-part-v1'
  if(doc.slot==='weapon')return 'weapon-wps-v1'
  return doc.definition.rig?.kind?`${doc.definition.rig.kind}-v1`:`${doc.slot}-grid-v1`
}
function animation(doc){
  const idle={fps:IDLE_FPS,repeat:-1,provenance:'studio-preview',frames:IDLE_CYCLE.map(idleOffset=>({pose:0,idleOffset}))}
  if(['pants','shirt','weapon'].includes(doc.slot))return {driver:'humanoid-motion-v1',idle,walk:clientWalkClip(),...(doc.slot==='weapon'?{attack:doc.resources.splash?clientBasicClip(doc.template.clazz):null}:{}),limitations:['Weapon WPS/skill effects and gameplay hits require the corresponding H5 renderer; content registration alone does not implement it.']}
  return {driver:'companion-motion-v1',fps:25,states:['idle','walk'],mountedAttack:clone(doc.definition.mountedAttack??null),limitations:clone(doc.definition.warnings??[])}
}
export function h5Content(doc){
  const key=h5PartKey(doc)
  if(!doc.resources?.sheet)throw new Error('Thiếu PNG chính')
  const assets=Object.entries(doc.resources).map(([role,r])=>{
    if(!['sheet','splash'].includes(role)||!/^[a-f0-9]{64}$/.test(r.sha256)||![1,2,3,4].includes(r.density)||![r.width,r.height].every(n=>Number.isInteger(n)&&n>0&&n<=8192))throw new Error('Metadata PNG không hợp lệ')
    const directory=doc.slot==='weapon'?`weapon/${doc.template.clazz}/${doc.id}`:`${doc.slot}/${doc.id}`
    return {key:`${key}:${role}:${r.sha256}`,partKey:key,role,path:`parts/${directory}/x${r.density}/${r.sha256}/${role}.png`,sha256:r.sha256,width:r.width,height:r.height,density:r.density}
  })
  const definition=clone(doc.definition),sheet=assets.find(a=>a.role==='sheet'),splash=assets.find(a=>a.role==='splash')
  if(['mount','pet'].includes(doc.slot))definition.itemIds=[]
  definition.image=sheet.path
  if(definition.asset)definition.asset={...definition.asset,image:sheet.path}
  if(definition.splash)definition.splash={...definition.splash,image:splash?.path??null}
  definition.resources=Object.fromEntries(assets.map(a=>[a.role,a.key]))
  const item=doc.h5Item?{...clone(doc.h5Item),partKey:key}:null
  if(item&&(!Number.isInteger(item.id)||item.id<0||item.id>H5_ID_MAX))throw new Error('ID vật phẩm H5 phải trong 0–2147483647')
  return {schema:'h5-part-content',version:1,part:{key,slot:doc.slot,designId:String(doc.id),label:doc.label,rigId:rigId(doc),definition,animation:animation(doc),source:{provenance:doc.provenance,template:clone(doc.template),coordinateUnits:'x1',nativeIdsAreTemplateReferences:true}},assets,item}
}
export function designSQL(doc){
  const content=h5Content(doc)
  return ['-- H5 content contract v1; MySQL 8.0.21+ (8.4 recommended).',
    '-- Run the one-time schema SQL first. Select your H5 database.',
    '-- Execute this CALL outside another transaction. Duplicate IDs roll back all rows.',
    '-- Copy PNG files to the asset root at the relative paths below BEFORE registering:',
    ...content.assets.map(a=>`-- ${a.path}`),
    '-- Changes only h5_* tables. Does not grant items to player inventories.',
    '-- The H5 server must implement this renderer contract and refresh content_revision.',
    `CALL h5_register_part_v1(${sqlValue(JSON.stringify(content))});`,''].join('\n')
}
export function serverIntegration(){
  return {target:'h5-content-v1',status:'requires-h5-runtime',dialect:'mysql',minimumVersion:'8.0.21',schemaSource:'docs/h5-content-schema.md',
    sqlScope:'part-assets-rig-animation-item',imageBytesInDatabase:false,metadataInDatabase:true,
    remaining:['Run the one-time H5 schema SQL, copy PNG files to the declared asset paths, then execute the part registration SQL.','The future H5 server must load h5_* definitions, implement the renderer keys, serve/cache PNGs and refresh the content revision.'],
    limits:{itemId:[0,H5_ID_MAX],partId:[0,H5_ID_MAX]}}
}
