import { query } from '../catalog'
import { characterParts } from '../characterParts'
import { clientWeaponLayer } from '../clientWeapon'
import { companionCatalog, companionLayer } from '../companions'

export const DESIGN_SLOTS = [['pants','Quần'],['shirt','Áo'],['weapon','Vũ khí'],['mount','Thú cưỡi'],['pet','Thú cưng']]
export function designTemplates(slot, clazz) {
  if(slot==='pants'||slot==='shirt')return characterParts().filter(p=>p.slot===slot).map(p=>{
    const frames=JSON.parse(p.frames),offsets=JSON.parse(p.offsets)
    const asset={id:p.id,source:p.source,image:p.image,width:p.width,height:p.height,density:p.density}
    return {key:`${slot}:${p.part_id}`,slot,id:p.part_id,label:p.label,assets:{sheet:asset},
      definition:{version:1,slot,partId:p.part_id,label:p.label,source:p.source,provenance:p.provenance,width:p.width,height:p.height,density:p.density,frames,offsets},
      layer:{slot,partId:p.part_id,name:p.label,provenance:p.provenance,asset,...frames[0],x:offsets[0][0],y:offsets[0][1],visible:true,poseFrames:frames,poseOffsets:offsets},
      items:query('SELECT * FROM item3 WHERE type=? ORDER BY (part=?) DESC,id',[slot==='shirt'?0:1,p.part_id]).map(row=>({table:'item3',row}))}
  })
  if(slot==='weapon') {
    const rows=query('SELECT * FROM item3 WHERE type IN (8,9,10,11) AND clazz=? ORDER BY id',[clazz])
    return [...new Set(rows.map(i=>i.part))].map(part=>{
      const items=rows.filter(i=>i.part===part),layer=clientWeaponLayer(items[0],clazz)
      if(!layer)return null
      return {key:`weapon:${clazz}:${part}`,slot,id:part,clazz,label:`${items[0].name} · part ${part}`,layer,
        assets:{sheet:layer.asset,splash:layer.clientWeapon.splash},definition:layer.clientWeapon,
        items:items.map(row=>({table:'item3',row}))}
    }).filter(Boolean)
  }
  return companionCatalog[slot==='mount'?'mounts':'pets'].map(d=>({key:`${slot}:${d.id}`,slot,id:d.id,label:d.label,
    assets:{sheet:d.asset},definition:d,layer:companionLayer(slot,d.id),items:companionCatalog.inventory.filter(i=>i.kind===slot&&i.companionId===d.id&&i.status==='ready').map(i=>({table:i.table,row:query(`SELECT * FROM ${i.table} WHERE id=?`,[i.id])[0]})).filter(i=>i.row)}))
}

export function reservedNativeIds(template) {
  const family=template?.assets.sheet.source.match(/^part_char\/imgver\/x[1-4]\/(\d+)_\d+$/)?.[1]
  if(!family)return []
  return query('SELECT source FROM assets WHERE source GLOB ?',[`part_char/imgver/x[1-4]/${family}_[0-9]*`]).map(row=>Number(row.source.match(/_(\d+)$/)?.[1])).filter(Number.isInteger)
}
export function nextDesignId(templates, slot) {
  const ids=[...templates.map(t=>Number(t.id)).filter(Number.isInteger),...reservedNativeIds(templates[0])]
  return slot==='mount'||slot==='pet'?Math.max(9000,...ids)+1:Math.max(...ids)+1
}
export function nextItemId(table) { return query(`SELECT MAX(id)+1 AS id FROM ${table}`)[0].id }
export function itemIdExists(table,id) { return query(`SELECT id FROM ${table} WHERE id=?`,[id]).length>0 }
