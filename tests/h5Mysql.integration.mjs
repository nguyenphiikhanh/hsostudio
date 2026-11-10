// Optional integration check. Uses ONLY an isolated, empty-password MySQL test container.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import initSqlJs from 'sql.js'
import {makeDesign} from '../src/lib/partDesign/schema.js'
import {h5Content,designSQL,sqlValue} from '../src/lib/partDesign/mysql.js'
const container=process.env.H5_MYSQL_TEST_CONTAINER
if(!/^studio-h5-copy-sql-check-[a-zA-Z0-9_-]+$/.test(container??''))throw new Error('Set H5_MYSQL_TEST_CONTAINER to a disposable studio-h5-copy-sql-check-* container (mysql:8.4, empty root password, no network/mounts).')
const database=`studio_h5_sql_test_${Date.now()}`
function mysql(sql,withDatabase=true){
 return execFileSync('docker',['exec','-i',container,'mysql','-uroot','--batch','--raw','--skip-column-names','--default-character-set=utf8mb4',...(withDatabase?[database]:[])],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()
}
mysql(`CREATE DATABASE ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;`,false)
mysql(fs.readFileSync(new URL('../src/lib/partDesign/h5Schema.sql',import.meta.url),'utf8'))
mysql("CREATE TABLE item3(id INT PRIMARY KEY,name VARCHAR(32)); INSERT INTO item3 VALUES(0,'source untouched');")
const counts=()=>mysql('SELECT (SELECT COUNT(*) FROM h5_parts),(SELECT COUNT(*) FROM h5_assets),(SELECT COUNT(*) FROM h5_item_templates),revision FROM h5_content_state;')
const SQL=await initSqlJs(),db=new SQL.Database(fs.readFileSync(new URL('../public/game/catalog.sqlite',import.meta.url)))
const query=sql=>{const r=db.exec(sql)[0];return r.values.map(v=>Object.fromEntries(r.columns.map((k,i)=>[k,v[i]])))}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const resources=assets=>Object.fromEntries(Object.entries(assets).map(([key,a])=>[key,{file:`${key}.png`,width:a.width,height:a.height,density:a.density??1,sha256:sha(fs.readFileSync(new URL('../public/game/'+a.image,import.meta.url)))}]))
const templates=[]
for(const slot of ['pants','shirt']){
 const p=query(`SELECT a.*,p.slot,p.part_id,t.frames,t.offsets,t.density FROM character_parts p JOIN character_textures t ON t.base_asset=p.asset_id JOIN assets a ON a.id=t.asset_id WHERE p.slot='${slot}' AND p.part_id=0`)[0]
 templates.push({slot,key:`${slot}:0`,id:0,assets:{sheet:p},definition:{slot,partId:0,width:p.width,height:p.height,density:p.density,frames:JSON.parse(p.frames),offsets:JSON.parse(p.offsets)}})
}
const ref=JSON.parse(query('SELECT definition FROM hso_client_reference')[0].definition)
for(const r of query('SELECT definition FROM hso_weapon_sheets WHERE part=0')){
 const w=JSON.parse(r.definition),splash=ref.classes[w.clazz].splash
 templates.push({slot:'weapon',key:`weapon:${w.clazz}:0`,id:0,clazz:w.clazz,assets:{sheet:w,splash},definition:w,layer:{clientWeapon:{...w,splash}}})
}
const companions=JSON.parse(fs.readFileSync(new URL('../src/data/companions.json',import.meta.url)))
for(const d of [...companions.mounts,...companions.pets])templates.push({slot:d.slot,key:`${d.slot}:${d.id}`,id:d.id,assets:{sheet:d.asset},definition:d,layer:{provenance:'official-client-4.0.3+server'}})
const documents=[]
for(const [i,t] of templates.entries()){
 const doc=makeDesign(t,{id:10000+i,label:`Mới '${i}' \\ 😀`,itemId:100000+i,resources:resources(t.assets)})
 const content=h5Content(doc)
 mysql('SET SESSION sql_mode=CONCAT(@@sql_mode,\',NO_BACKSLASH_ESCAPES\');\n'+designSQL(doc))
 const stored=JSON.parse(mysql(`SELECT JSON_OBJECT('label',label,'definition',definition_json,'animation',animation_json,'source',source_json) FROM h5_parts WHERE part_key=${sqlValue(content.part.key)};`))
 assert.deepEqual(stored,{label:content.part.label,definition:content.part.definition,animation:content.part.animation,source:content.part.source})
 const assets=JSON.parse(mysql(`SELECT JSON_ARRAYAGG(JSON_OBJECT('path',path,'sha256',sha256,'density',density)) FROM h5_assets WHERE part_key=${sqlValue(content.part.key)};`))
 assert.deepEqual(assets.sort((a,b)=>a.path.localeCompare(b.path)),content.assets.map(a=>({path:a.path,sha256:a.sha256,density:a.density})).sort((a,b)=>a.path.localeCompare(b.path)))
 documents.push(doc)
}
assert.equal(documents.length,40)
const before=counts()
function fails(sql){let failed=false;try{mysql(sql)}catch(e){failed=true;assert.ok(e.stderr?.trim())}assert.ok(failed,'SQL must fail');assert.equal(counts(),before,'failure must leave no partial rows/revision')}
fails(designSQL(documents[0]))
const lateCollision=makeDesign(templates[0],{id:20001,label:'rollback item conflict',itemId:100000,resources:documents[0].resources})
fails(designSQL(lateCollision))
const invalid=h5Content(lateCollision);invalid.item.id=200001;invalid.assets[0].density=9
fails(`CALL h5_register_part_v1(${sqlValue(JSON.stringify(invalid))});`)
invalid.assets[0].density=4;invalid.assets[0].path='parts/../../outside.png'
fails(`CALL h5_register_part_v1(${sqlValue(JSON.stringify(invalid))});`)
const partOnly=makeDesign(templates[0],{id:20002,label:'part without item',resources:documents[0].resources})
mysql(designSQL(partOnly));assert.equal(mysql('SELECT COUNT(*) FROM h5_item_templates;'),'40')
assert.equal(mysql('SELECT name FROM item3 WHERE id=0;'),'source untouched')
assert.equal(mysql('SELECT revision FROM h5_content_state WHERE id=1;'),'41')
db.close()
console.log('MySQL verified: 40 native-layout designs (all rigs/classes), Unicode/NO_BACKSLASH_ESCAPES, stored JSON/paths, duplicate/late failure rollback, part-only registration, original table unchanged. Revision 41.')
