import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import initSqlJs from 'sql.js'
import {textureDensity,makeDesign,designLayer,validateRestoredDesign} from '../src/lib/partDesign/schema.js'
import {designSQL,sqlValue} from '../src/lib/partDesign/mysql.js'
import {resolvePose} from '../src/lib/characterPose.js'

const SQL=await initSqlJs(),db=new SQL.Database(await readFile(new URL('../public/game/catalog.sqlite',import.meta.url)))
const query=sql=>{const r=db.exec(sql)[0];return r?r.values.map(v=>Object.fromEntries(r.columns.map((k,i)=>[k,v[i]]))):[]}
const rows=query(`SELECT a.*,p.slot,p.part_id,p.label,p.provenance,t.frames,t.offsets,t.density FROM character_parts p JOIN character_textures t ON t.base_asset=p.asset_id JOIN assets a ON a.id=t.asset_id WHERE p.slot IN ('pants','shirt')`)
const template=r=>({key:`${r.slot}:${r.part_id}`,slot:r.slot,id:r.part_id,assets:{sheet:{width:r.width,height:r.height,density:r.density}},
 definition:{slot:r.slot,partId:r.part_id,width:r.width,height:r.height,density:r.density,frames:JSON.parse(r.frames),offsets:JSON.parse(r.offsets),provenance:r.provenance}})
const meta=a=>({width:a.width,height:a.height,density:a.density,sha256:'a'.repeat(64),file:'sheet.png'})
test('every garment template clones geometry without mutating native data, preserving logical size x1–x4',()=>{
 for(const row of rows){
  const t=template(row),before=JSON.stringify(t)
  for(const density of [1,2,3,4]){
   const width=row.width/row.density*density,height=row.height/row.density*density
   assert.equal(textureDensity(t.assets.sheet,width,height),density)
   const d=makeDesign(t,{id:122,label:'Áo mới',resources:{sheet:{...meta(row),width,height,density}}})
   assert.deepEqual(d.definition.frames,t.definition.frames);assert.deepEqual(d.definition.offsets,t.definition.offsets)
   validateRestoredDesign(d,t)
  }
  assert.equal(JSON.stringify(t),before)
 }
 assert.throws(()=>textureDensity({width:292,height:172,density:4},291,172),/giữ bố cục/)
})
test('MySQL uses exact native columns and preserves item stats; malicious names stay UTF-8 hex data',()=>{
 const row=query('SELECT * FROM item3 WHERE id=0')[0],t=template(rows[0]),name="Áo'; DROP TABLE item3; -- \\ thử"
 const d=makeDesign(t,{id:122,label:name,item:{table:'item3',sourceId:0,row:{...row,id:4792}},resources:{sheet:meta(t.assets.sheet)}})
 assert.equal(d.serverItem.row.data,row.data);assert.equal(d.serverItem.row.part,122)
 const sql=designSQL(d)
 assert.ok(sql.includes('INSERT INTO `item3` (`id`, `name`, `type`, `part`, `clazz`, `iconid`, `level`, `data`, `color`)'))
 assert.ok(sql.includes(Buffer.from(name).toString('hex')));assert.ok(!sql.includes('DROP TABLE'))
 assert.throws(()=>makeDesign(t,{id:122,label:'Áo 😀',item:{table:'item3',row:{...row,id:4792}},resources:{sheet:meta(t.assets.sheet)}}),/3-byte/)
 assert.equal(sqlValue(null),'NULL');assert.throws(()=>sqlValue(Infinity))
 assert.throws(()=>makeDesign(t,{id:128,label:'X',resources:{sheet:meta(t.assets.sheet)}}),/0–127/)
 assert.throws(()=>makeDesign(t,{id:122,label:'X',item:{table:'item3',row:{...row,id:32768}},resources:{sheet:meta(t.assets.sheet)}}),/0–32767/)
 assert.ok(designSQL({...d,serverItem:null}).includes('No INSERT generated'))
 const changed=structuredClone(d);changed.definition.frames[0].sx++
 assert.throws(()=>validateRestoredDesign(changed,t),/đổi frame/)
})
test('new weapon retains native WPS geometry but cannot borrow original attack art when its WPS is absent',()=>{
 const source=JSON.parse(query('SELECT definition FROM hso_weapon_sheets WHERE clazz=0 AND part=0')[0].definition)
 const splash=JSON.parse(query('SELECT definition FROM hso_client_reference')[0].definition).classes[0].splash
 const layer={slot:'weapon',clazz:0,visible:true,asset:source,clientWeapon:{...source,splash}}
 const t={key:'weapon:0:0',slot:'weapon',id:0,clazz:0,assets:{sheet:source,splash},definition:source,layer}
 const d=makeDesign(t,{id:24,label:'Kiếm mới',resources:{sheet:meta(source)}})
 const l=designLayer(t,d,{sheet:'blob:sheet'})
 assert.equal(resolvePose([l],'down',0,0,{clientAttack:true,clientBodyFrame:4,clientWeaponFrame:4})[0].visible,false)
 d.resources.splash=meta(splash);d.definition.splash={...splash,...meta(splash)}
 const ready=designLayer(t,d,{sheet:'blob:sheet',splash:'blob:splash'})
 assert.equal(resolvePose([ready],'down',0,0,{clientAttack:true,clientBodyFrame:4,clientWeaponFrame:4})[0].asset.image,'blob:splash')
})
after(()=>db.close())
