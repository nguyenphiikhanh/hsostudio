import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import initSqlJs from 'sql.js'
import {resolvePose,clientWalkPhase,clientWalkClip,WALK_FPS,WALK_CYCLE} from '../src/lib/characterPose.js'
const evidence=JSON.parse(await readFile(new URL('../reference/hso403/walk.json',import.meta.url)))
const eyes=JSON.parse(await readFile(new URL('../reference/hso403/eyes.json',import.meta.url)))
const SQL=await initSqlJs(),db=new SQL.Database(await readFile(new URL('../public/game/catalog.sqlite',import.meta.url)))
const query=sql=>{const r=db.exec(sql)[0];return r.values.map(v=>Object.fromEntries(r.columns.map((k,i)=>[k,v[i]])))}
const parts=query(`SELECT a.id,a.width,a.height,p.slot,t.frames,t.offsets,t.density FROM character_parts p JOIN character_textures t ON t.base_asset=p.asset_id JOIN assets a ON a.id=t.asset_id WHERE p.slot!='eyes'`)
parts.push(...eyes.parts)
const weapons=query('SELECT definition FROM hso_weapon_sheets WHERE part=0').map(r=>JSON.parse(r.definition))
db.close()
const layer=p=>({slot:p.slot,provenance:p.provenance,...JSON.parse(p.frames)[0],x:JSON.parse(p.offsets)[0][0]+7,y:JSON.parse(p.offsets)[0][1]-3,visible:true,poseFrames:JSON.parse(p.frames),poseOffsets:JSON.parse(p.offsets),asset:{width:p.width,height:p.height,density:p.density}})

test('walking uses the 10 MainObject body frames, correct crop mapping and 40ms client clock',()=>{
 const clip=clientWalkClip()
 assert.equal(clip.clientSha256,evidence.jarSha256);assert.equal(clip.fps,1000/evidence.tickMs);assert.equal(WALK_FPS,25)
 assert.deepEqual(clip.frames.map(f=>f.clientBodyFrame),evidence.bodyFrames)
 assert.deepEqual(WALK_CYCLE,evidence.bodyFrames.map(f=>evidence.clothingCropByBodyFrame[f]))
 for(let i=0;i<30;i++)assert.deepEqual(clientWalkPhase(i),clip.frames[i%10])
 assert.equal(clip.repeat,-1)
})
test('every original part and custom inherited part uses body-frame anchors independently of weapon/class in all directions',()=>{
 assert.equal(parts.length,430)
 for(const p of parts)for(const custom of [false,true]){
  const original=layer(p),l=custom?{...original,provenance:'custom-design',customDesign:{id:122}}:original
  for(const [direction,group,anchor]of [['down',0,0],['up',1,6],['left',2,12],['right',2,12]])for(const body of [0,2,3]){
   const pose=evidence.clothingCropByBodyFrame[body],crop=l.poseFrames[l.poseFrames.length===15?group*5+pose:group]
   const offset=l.poseOffsets[anchor+body],options={clientBodyFrame:body}
   const actual=resolvePose([l],direction,pose,0,options)[0]
   assert.deepEqual([actual.sx,actual.sy,actual.w,actual.h],[crop.sx,crop.sy,crop.w,crop.h],p.id)
   assert.deepEqual([actual.x,actual.y],[(direction==='right'?-offset[0]-crop.w:offset[0])+7,offset[1]-3],`${p.id}/${direction}/body${body}`)
   for(const w of weapons){
    const weapon={slot:'weapon',clazz:w.clazz,clientWeapon:w,visible:true,asset:w}
    const withWeapon=resolvePose([l,weapon],direction,pose,0,options)[0]
    assert.deepEqual(withWeapon,actual)
    // Public crop-pose API must also use the same anchors without a weapon.
    assert.deepEqual(resolvePose([l],direction,pose)[0],resolvePose([l,weapon],direction,pose)[0])
   }
  }
 }
})
