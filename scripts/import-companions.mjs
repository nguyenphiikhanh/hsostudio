import fs from 'node:fs';import crypto from 'node:crypto';import initSqlJs from 'sql.js';
import {unzipSync} from 'fflate';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {validateCompanion} from '../src/lib/companionPose.js';
// Optional offline reference import. Never invoked by dev/build/runtime.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const [serverRoot,clientSource]=process.argv.slice(2).map(p=>resolve(p));
if(!serverRoot||!clientSource)throw Error('Usage: node scripts/import-companions.mjs /path/to/hso /path/to/decompiled-client403');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const jar=fs.readFileSync(root+'/KnightOnline_v403.jar');if(hash(jar)!=='f023b34e0ba0a3dcf44249ed5f90b78f0427deee4668562b8e3a0e9e349b18c6')throw Error('Wrong client');
const SQL=await initSqlJs({locateFile:()=>root+'/node_modules/sql.js/dist/sql-wasm.wasm'});const db=new SQL.Database(fs.readFileSync(root+'/public/game/catalog.sqlite'));
function query(sql,args=[]){const s=db.prepare(sql);s.bind(args);let a=[];while(s.step())a.push(s.getAsObject());s.free();return a}
const packet=fs.readFileSync(serverRoot+'/data/msg/msg_26');let p=0;
const u8=()=>packet.readUInt8(p++),i8=()=>packet.readInt8(p++),i16=()=>{let n=packet.readInt16BE(p);p+=2;return n};
for(let i=0,n=i16();i<n;i++){p+=2;const length=i16();p+=length+6}
const tables={};for(const name of ['front','stand','move','dx','dy','lr','down','up'])tables[name]=Array.from({length:u8()},()=>Array.from({length:u8()},i8));
let speedCount=u8();p+=speedCount;let equipCount=u8();p+=equipCount;const petMove=Array.from({length:u8()},i8);
function asset(id,cols,rows){const baseline=query('SELECT width,height FROM assets WHERE source=?',[`icon/x1/${id}.png`])[0];if(!baseline)return null;for(const d of [4,3,2,1]){const a=query('SELECT * FROM assets WHERE source=?',[`icon/x${d}/${id}.png`])[0];if(!a?.image||a.width!==baseline.width*d||a.height!==baseline.height*d||a.width%(cols*d)||a.height%(rows*d))continue;return {...a,density:d,sha256:hash(fs.readFileSync(root+'/public/game/'+a.image)),columns:cols,rows,frameWidth:a.width/cols/d,frameHeight:a.height/rows/d}}return null}
const mounts=[],inventory=[];const use=fs.readFileSync(serverRoot+'/src/main/java/client/UseItem.java','utf8').split('private static void use_item_mount')[1];const byItem=new Map();
for(const match of use.matchAll(/((?:case \d+:\s*)+)\{([\s\S]*?)break;\s*\}/g)){
 const type=match[2].match(/type_use_mount = \(byte\) (\d+)/)?.[1];
 for(const idmatch of match[1].matchAll(/case (\d+):/g)){const id=+idmatch[1];let typeId=type===undefined?(id>=62&&id<=66?id-62:null):+type;byItem.set(id,{typeId,effectRig:match[2].includes('id_horse =')})}
}
for(const item of query('SELECT id,name FROM item4 WHERE typepotion=44 ORDER BY id')){
 let mapped=byItem.get(item.id);if(item.id>=70&&item.id<=74)mapped={typeId:item.id-70,effectRig:false};
 const t=mapped?.typeId;let record={...item,typeId:t??null,status:'unmapped',reason:'Chưa xác minh liên kết với rig client.'};
 if(mapped?.effectRig){record.status='unsupported-rig';record.reason='Dùng id_horse và DataSkillEff, chưa port rig hiệu ứng.'}
 else if(t!==null&&t!==undefined&&tables.stand[t]){
  let a=asset(10700+t,3,5);if(a){record.status='ready';delete record.reason;if(!mounts.some(m=>m.id===String(t)))mounts.push({id:String(t),slot:'mount',label:item.name.replace(/99\s*(con)?\s*/i,''),typeId:t,status:'ready',asset:a,rig:Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,v[t]])),itemIds:[]})}
 }
 inventory.push({...record,kind:'mount',table:'item4'});if(record.status==='ready')mounts.find(m=>m.id===String(t)).itemIds.push(item.id);
}
const petSource=fs.readFileSync(clientSource+'/GameObjects/Pet.java','utf8');
function javaArray(name){let raw=petSource.match(new RegExp(`${name} = ([^;]+);`))[1];return JSON.parse(raw.replace(/new byte(?:\[\])+/g,'').replace(/\{/g,'[').replace(/\}/g,']'))}
const anims=[javaArray('mWoftAnimFrame'),javaArray('mBat'),javaArray('mOwl')];
const serverPet=fs.readFileSync(serverRoot+'/src/main/java/client/Pet.java','utf8');const names=serverPet.match(/name_template = new String\[\]\{([^}]+)/)[1].match(/"([^"]+)"/g).map(s=>s.slice(1,-1));const pets=[];
for(const m of serverPet.split('public static Pet get_pet')[1].matchAll(/((?:case \d+:\s*)+)\{([\s\S]*?)break;\s*\}/g)){
 const icon=Number(m[2].match(/temp.icon = (\d+)/)?.[1]);const type=Number(m[2].match(/temp.type = (\d+)/)?.[1]);if(!Number.isInteger(icon)||!Number.isInteger(type))continue;
 let a=asset(10200+icon,2,3);const mode=petMove[type];const status=a&&anims[mode]?'ready':'unsupported-rig';
 for(const v of m[1].matchAll(/case (\d+):/g))inventory.push({id:+v[1],kind:'pet',table:'item3',typeId:type,imageId:icon,name:names[type],status,...(status==='ready'?{}:{reason:'PetTool/rig chưa được port.'})});
 if(status==='ready'&&!pets.some(p=>p.id===String(icon)))pets.push({id:String(icon),slot:'pet',label:names[type],typeId:type,imageId:icon,status,asset:a,movement:mode,frames:anims[mode],itemIds:[...m[1].matchAll(/case (\d+):/g)].map(v=>+v[1])});
}
for(const d of mounts) {
 validateCompanion(d,'mount')
 d.mountedAttack=d.typeId===0?{status:'forbidden',reason:'Client Player kiểm tra typeMount == 0 và từ chối đánh trên Ngựa nâu.'}
 :d.typeId>0 && d.typeId<=13?{status:'ready',skillIds:[0,1,2,3,4,5,6,7,8,17,19,20],entryPose:'hold-at-attack-entry',reason:'Rig sheet thường đã kiểm tra: MainObject.updateMount giữ frame/seat khi Action == 2; thân và WPS theo SplashSkill. Player.setDelaySkill chỉ chặn typeMount 0.'}
 :{status:'unverified',reason:'Chưa mở đánh khi cưỡi cho rig này trong bản thử.'}
}
const bytecode=unzipSync(jar);
const clientClasses=Object.fromEntries(['GameObjects/MainObject','GameObjects/Player','GameObjects/Pet','GameObjects/PetFly','GameObjects/PetWalk','GameObjects/ObjectData','Model/FrameImage','netcommand/global/ReadMessenge'].map(c=>[c,hash(bytecode[c+'.class'])]));
const result={clientClasses,version:1,provenance:'official-client-4.0.3+server',jarSha256:hash(jar),packet:{source:'hso/data/msg/msg_26',sha256:hash(packet)},methods:['Player.setDelaySkill','MainObject.updateAction/paintWeapon','ReadMessenge.catalogyMonster','ObjectData.getImageMount/getImagePet','MainObject.updateMount/paintMount_Sau/paintMount_Truoc','FrameImage.drawFrameNew','Pet.setAnim','PetFly.update/paint','PetWalk.paint','UseItem.use_item_mount','Pet.get_pet'],mounts,pets,inventory};
fs.writeFileSync(root+'/src/data/companions.json',JSON.stringify(result,null,2)+'\n');console.log({mounts:mounts.length,pets:pets.length,inventory:inventory.length,owl:pets.find(p=>p.id==='3')?.label});
