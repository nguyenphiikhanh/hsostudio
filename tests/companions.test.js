import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import catalog from '../src/data/companions.json' with {type:'json'}
import {companionFrame,compileCompanion,validateCompanion} from '../src/lib/companionPose.js'
import {resolvePose} from '../src/lib/characterPose.js'
const horse=catalog.mounts.find(d=>d.id==='0'), owl=catalog.pets.find(d=>d.id==='3')
const layer=d=>({slot:d.slot,companion:d,asset:d.asset,visible:true,x:0,y:0})

test('all ready companion textures have exact hashes, crop bounds and x4 geometry in bundle',()=>{
  assert.equal(catalog.mounts.length,14);assert.equal(catalog.pets.length,6)
  for(const d of [...catalog.mounts,...catalog.pets]){
    validateCompanion(d,d.slot)
    const png=fs.readFileSync(new URL(`../public/game/${d.asset.image}`,import.meta.url))
    assert.equal(createHash('sha256').update(png).digest('hex'),d.asset.sha256)
    assert.equal(png.readUInt32BE(16),d.asset.width);assert.equal(png.readUInt32BE(20),d.asset.height)
    const compiled=compileCompanion(d,'test')
    assert.equal(Object.keys(compiled.atlas.frames).length,d.asset.columns*d.asset.rows)
    for(const direction of ['down','up','left','right'])for(const motion of ['idle','walk'])for(let tick=0;tick<36;tick++){
      const p=companionFrame(d,direction,motion,tick)
      assert.ok(p.sx+p.w<=d.asset.width/d.asset.density)
      assert.ok(p.sy+p.h<=d.asset.height/d.asset.density)
    }
  }
})
test('brown horse restores packet seat, column-major frame, mirroring, hidden legs and draw order',()=>{
  assert.deepEqual(horse.itemIds,[62,70])
  assert.equal(horse.asset.source,'icon/x4/10700.png')
  const down=companionFrame(horse,'down','walk',0)
  assert.equal(down.frame,7);assert.equal(down.seat,19);assert.equal(down.front,true)
  assert.equal(down.sx,39);assert.equal(down.sy,76)
  const side=companionFrame(horse,'right','walk',0)
  assert.equal(side.frame,2);assert.equal(side.seat,12);assert.equal(side.flipX,true)
  const head={slot:'head',visible:true,x:0,y:-40}
  const pants={slot:'pants',visible:true,x:0,y:-10}
  const posed=resolvePose([pants,head,layer(horse)],'down',0,-1,{motion:'walk',tick:0})
  assert.equal(posed[0].visible,false)
  assert.equal(posed[1].y,-59)
  assert.ok(posed[2].renderDepth>2)
})
test('owl maps item2944 -> image3, lands for idle and uses mOwl frames during flight',()=>{
  assert.equal(owl.typeId,0);assert.deepEqual(owl.itemIds,[2944]);assert.equal(owl.movement,2)
  assert.equal(owl.asset.source,'icon/x4/10203.png')
  const idle=companionFrame(owl,'up','idle',0)
  assert.equal(idle.frame,0);assert.equal(idle.y,-owl.asset.frameHeight)
  const move=companionFrame(owl,'right','walk',3)
  assert.equal(move.frame,3);assert.equal(move.flipX,true)
  assert.equal(move.y,-50-owl.asset.frameHeight)
  assert.ok(catalog.inventory.some(i=>i.kind==='mount'&&i.id===275&&i.status==='unsupported-rig'))
  assert.throws(()=>validateCompanion({...owl,status:'unmapped'},'pet'))
})

test('quality upgrades preserve world geometry and invalid seat metadata fails before equip/build',()=>{
 const x1={...horse,asset:{...horse.asset,density:1,width:horse.asset.width/4,height:horse.asset.height/4}}
 for(const direction of ['down','up','left','right'])for(let tick=0;tick<12;tick++)assert.deepEqual(companionFrame(horse,direction,'walk',tick),companionFrame(x1,direction,'walk',tick))
 assert.throws(()=>compileCompanion({...horse,rig:{...horse.rig,stand:[]}},'bad'),/anchor/)
 assert.throws(()=>compileCompanion({...owl,asset:{...owl.asset,frameWidth:0}},'bad'),/geometry/)
})

test('all permitted sheet mounts preserve native body/WPS while freezing the entry mount frame and seat',async()=>{
 const {clientBasicPhase,clientBasicClip}=await import('../src/lib/characterPose.js')
 const {mountedAttackAllowed}=await import('../src/lib/companionPose.js')
 const allowed=catalog.mounts.filter(d=>d.typeId!==0)
 assert.equal(allowed.length,13)
 for(const white of allowed)assert.equal(mountedAttackAllowed(white,clientBasicClip(0)),true)
 const white=allowed[0]
 assert.equal(mountedAttackAllowed(white,clientBasicClip(0)),true)
 assert.equal(mountedAttackAllowed(horse,clientBasicClip(0)),false)
 assert.equal(mountedAttackAllowed(white,{clientBasic:false,skillId:1,experimental:false}),false)
 const initSqlJs=(await import('sql.js')).default,SQL=await initSqlJs()
 const db=new SQL.Database(fs.readFileSync(new URL('../public/game/catalog.sqlite',import.meta.url)))
 const ref=JSON.parse(db.exec('SELECT definition FROM hso_client_reference')[0].values[0][0])
 const weapons=db.exec('SELECT definition FROM hso_weapon_sheets WHERE part=0')[0].values.map(([v])=>JSON.parse(v))
 const [{columns,values}]=db.exec("SELECT frames,offsets FROM character_parts WHERE slot='shirt' LIMIT 1")
 const shirtRow=Object.fromEntries(columns.map((k,i)=>[k,values[0][i]]))
 const frames=JSON.parse(shirtRow.frames),offsets=JSON.parse(shirtRow.offsets)
 const shirt={slot:'shirt',visible:true,...frames[0],x:offsets[0][0],y:offsets[0][1],poseFrames:frames,poseOffsets:offsets}
 for(const white of allowed)for(const entryTick of [0,4,8,11])for(const w of weapons)for(const [dir,direction]of ['down','up','left','right'].entries())for(const entryMotion of ['idle','walk']) {
   const entry={motion:entryMotion,tick:entryTick}, held=companionFrame(white,direction,entry.motion,entry.tick)
   const weapon={slot:'weapon',clazz:w.clazz,asset:w,visible:true,clientWeapon:{...w,splash:{...ref.classes[w.clazz].splash,source:'wps'}}}
   for(let tick=0;tick<9;tick++) {
     const phase=clientBasicPhase(tick),options={clientAttack:true,clientBodyFrame:phase.bodyFrame,clientWeaponFrame:phase.weaponFrame,motion:'attack',tick,mountEntry:entry}
     const expected=resolvePose([shirt,weapon],direction,0,0,options)
     const posed=resolvePose([shirt,weapon,layer(white)],direction,0,0,options)
     for(let i=0;i<2;i++)for(const key of ['sx','sy','w','h','x','flipX'])assert.equal(posed[i][key],expected[i][key])
     assert.equal(posed[0].y,expected[0].y-held.seat)
     assert.equal(posed[1].y,expected[1].y-held.seat)
     assert.equal(posed[2].frame,held.frame)
     assert.equal(posed[2].seat,held.seat)
     assert.equal(posed[2].front,held.front)
     if(tick<8)assert.equal(posed[1].sx,ref.classes[w.clazz].splash.frames[dir][phase.weaponFrame].sx)
   }
 }
 db.close()
})

test('all offensive mounted clips retain their native phases, including extended WPS and plash0',async()=>{
 const {clientSkillClip,clientSkillPhase}=await import('../src/lib/characterPose.js')
 const {mountedAttackAllowed}=await import('../src/lib/companionPose.js')
 const allowed=catalog.mounts.filter(d=>d.typeId!==0),skills=[0,1,2,3,4,5,6,7,8,17,19,20]
 const frames=Array.from({length:15},(_,i)=>({sx:i*10,sy:0,w:10,h:10}))
 const offsets=Array.from({length:24},(_,i)=>[i,-i])
 const shirt={slot:'shirt',visible:true,...frames[0],x:0,y:0,poseFrames:frames,poseOffsets:offsets}
 for(const mount of allowed)for(let clazz=0;clazz<4;clazz++)for(const skillId of skills){
  const clip=clientSkillClip(clazz,skillId)
  assert.equal(mountedAttackAllowed(mount,clip),true)
  assert.equal(mountedAttackAllowed(horse,clip),false)
  for(const direction of ['down','up','left','right'])for(const motion of ['idle','walk']){
   const entry={motion,tick:8},held=companionFrame(mount,direction,motion,8)
   for(let tick=0;tick<clip.frames.length;tick++){
    const phase=clientSkillPhase(clazz,skillId,tick),options={clientAttack:true,clientSkillId:skillId,clientBodyFrame:phase.bodyFrame,clientWeaponFrame:phase.weaponFrame,motion:'attack',tick,mountEntry:entry}
    const [body]=resolvePose([shirt],direction,0,0,options)
    const [mounted,renderedMount]=resolvePose([shirt,layer(mount)],direction,0,0,options)
    assert.equal(mounted.sx,body.sx);assert.equal(mounted.y,body.y-held.seat)
    assert.equal(renderedMount.frame,held.frame);assert.equal(renderedMount.seat,held.seat)
   }
  }
 }
 for(let clazz=0;clazz<4;clazz++)for(const skillId of [17,19,20]){
  const clip=clientSkillClip(clazz,skillId)
  assert.equal(clip.frames.length,9)
  assert.equal(clip.frames[0].clientBodyFrame,4)
  assert.equal(clip.frames[5].clientBodyFrame,5)
 }
 assert.deepEqual(clientSkillPhase(1,5,8),{bodyFrame:5,weaponFrame:8})
 assert.deepEqual(clientSkillPhase(1,5,9),{bodyFrame:5,weaponFrame:9})
 for(const skillId of [9,10,11,12,13,14,15,16,18])assert.equal(mountedAttackAllowed(allowed[0],clientSkillClip(0,skillId)),false)
})
