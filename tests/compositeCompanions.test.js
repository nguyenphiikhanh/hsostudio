import{test}from'node:test'
import assert from'node:assert/strict'
import fs from'node:fs'
import{createHash}from'node:crypto'
import{unzipSync}from'fflate'
import data from'../src/data/companions.json' with {type:'json'}
import{companionFrame,companionCycleLength,validateCompanion,compileCompanion}from'../src/lib/companionPose.js'
import{resolvePose,paintLayers}from'../src/lib/characterPose.js'
const composite=[...data.mounts,...data.pets].filter(d=>d.rig?.kind)
const hash=b=>createHash('sha256').update(b).digest('hex')
test('composite source provenance and all idle/walk crops/frames validate without external files',()=>{
 assert.equal(composite.length,14)
 const z=unzipSync(fs.readFileSync(new URL('../KnightOnline_v403.jar',import.meta.url)))
 for(const [name,digest]of Object.entries(data.effectRigReference.classes))assert.equal(hash(z[name+'.class']),digest)
 for(const d of composite){
  assert.equal(hash(Buffer.from(d.rig.rawHex,'hex')),d.rig.rawSha256)
  validateCompanion(d,d.slot)
  const compiled=compileCompanion(d,'test');assert.equal(compiled.part.frameEntries.length,d.rig.rects.length)
  for(const direction of ['down','up','left','right'])for(const state of ['idle','walk'])for(let tick=0;tick<companionCycleLength(d,state);tick++){
   const pose=companionFrame(d,direction,state,tick)
   for(const piece of pose.pieces){assert.ok(piece.sx>=0 && piece.sy>=0);assert.ok((piece.sx+piece.w)*4<=d.asset.width && (piece.sy+piece.h)*4<=d.asset.height)}
  }
 }
})
test('DataSkillEff uses 21-pose groups, native horseMove, per-piece mirror and top/bottom layering',()=>{
 const cloud=data.mounts.find(d=>d.id==='effect-111')
 assert.equal(companionFrame(cloud,'down','idle',0).frame,0)
 assert.equal(companionFrame(cloud,'up','idle',0).frame,7)
 assert.equal(companionFrame(cloud,'left','idle',0).frame,14)
 assert.equal(companionFrame(cloud,'down','idle',5).frame,21)
 assert.equal(companionFrame(cloud,'down','walk',5).frame,25)
 const left=companionFrame(cloud,'left','walk',8),right=companionFrame(cloud,'right','walk',8)
 assert.equal(left.frame,right.frame)
 for(let i=0;i<left.pieces.length;i++){
  const a=left.pieces[i],b=right.pieces[i],source=cloud.rig.frames[left.frame][i]
  assert.equal(b.x,cloud.rig.dx[3]-source.x-a.w);assert.equal(b.flipX,!a.flipX)
 }
 const layer={slot:'mount',visible:true,companion:cloud,asset:cloud.asset}
 const posed=resolvePose([{slot:'pants',visible:true,x:0,y:-10},{slot:'head',visible:true,x:0,y:-40},layer],'down',0,0,{motion:'walk',tick:8})
 assert.equal(posed[0].visible,false);assert.equal(posed[1].y,-40-companionFrame(cloud,'down','walk',8).seat)
 for(const p of posed.filter(p=>p.companion))assert.equal(Math.floor(p.renderDepth),p.front?7:-3)
})
test('PetTool original timelines are used and source attack defect remains declared, never guessed',()=>{
 for(const d of data.pets.filter(d=>d.rig?.kind))for(const [dir,index]of [['down',0],['up',4]]){
  for(const [state,offset]of [['idle',0],['walk',1]])for(let tick=0;tick<30;tick++){
   assert.equal(companionFrame(d,dir,state,tick).frame,d.rig.animations[index+offset][tick%d.rig.animations[index+offset].length])
  }
 }
 const phoenix=data.pets.find(d=>d.id==='21')
 assert.deepEqual(phoenix.rig.invalidReferences,[{animation:2,tick:8,frame:64}])
 assert.ok(phoenix.warnings.length);assert.deepEqual(phoenix.supportedStates,['idle','walk'])
 assert.deepEqual(data.inventory.filter(i=>i.status!=='ready').map(i=>i.id),[271,272,283])
 for(const [id,target]of [[125,'5'],[223,'11'],[247,'12'],[276,'effect-111'],[300,'effect-117']])assert.equal(data.inventory.find(i=>i.kind==='mount'&&i.id===id).companionId,target)
 const invalid=structuredClone(phoenix);invalid.rig.animations[0][0]=64
 assert.throws(()=>compileCompanion(invalid,'invalid'),/timeline/)
})

test('effect mount draw passes match captured Java client commands throughout every idle/walk cycle', () => {
 const reference=JSON.parse(fs.readFileSync(new URL('./fixtures/horse-client-draws.json',import.meta.url)))
 const jar=unzipSync(fs.readFileSync(new URL('../KnightOnline_v403.jar',import.meta.url)))
 for(const [name,digest]of Object.entries(reference.classes))assert.equal(hash(jar[name+'.class']),digest)
 for(const d of data.mounts.filter(d=>d.rig.kind==='effect-mount')) {
  const expected=reference.mounts[d.id]
  assert.equal(d.rig.rawSha256,expected.rawSha256)
  for(const dir of ['down','up','left','right'])for(const motion of ['idle','walk'])for(let tick=0;tick<companionCycleLength(d,motion);tick++) {
   const frame=companionFrame(d,dir,motion,tick)
   const directionIndex={down:0,up:1,left:2,right:3}[dir]
   const anchorIndex=[3,2,0,1][directionIndex]*2+Number(motion==='walk')
   const draw=p=>[p.sx,p.sy,p.w,p.h,p.flipX?2:0,p.x-d.rig.dx[anchorIndex],p.y-d.rig.dy[anchorIndex]]
   const commands=[...frame.pieces.filter(p=>!p.front).map(draw),null,...frame.pieces.filter(p=>p.front).map(draw)]
   assert.equal(hash(JSON.stringify(commands)),expected.frames[frame.frame][Number(dir==='right')],`${d.id} ${dir} ${motion} tick ${tick}: client draw order/geometry`)
  }
 }
})


test('Canvas keeps mount bottom, rear weapon, body, front weapon, mount top in native order after expansion', () => {
 const crop={sx:0,sy:0,w:1,h:1}, asset={width:1,height:1,density:1}
 const weapon={slot:'weapon',clazz:0,visible:true,asset,...crop,x:0,y:0,
  clientWeapon:{frames:Array(4).fill({...crop,x:0,y:0}),offsets:Array(4).fill(Array(3).fill([0,0]))}}
 const head={slot:'head',visible:true,asset,...crop,x:0,y:0}
 for(const d of data.mounts.filter(d=>d.rig.kind==='effect-mount'))for(const dir of ['down','up','left','right'])for(const tick of [0,5,8,12,20,29]) {
  // Put the mount before body/weapon to exercise index shifts from expanded pieces.
  const posed=resolvePose([{slot:'mount',visible:true,companion:d,asset:d.asset},head,weapon],dir,0,0,{motion:'walk',tick})
  const frame=companionFrame(d,dir,'walk',tick), source=d.rig.frames[frame.frame]
  const bottom=source.flatMap((p,i)=>p.top!==0?['mount:'+i]:[])
  const top=source.flatMap((p,i)=>p.top===0?['mount:'+i]:[])
  const expected=[...bottom,...(dir==='up'?['head','weapon']:['weapon','head']),...top]
  const draws=[],ctx={save(){},restore(){},translate(){},scale(){},drawImage(image){draws.push(image)}}
  paintLayers(ctx,posed,posed.map(p=>p.companion?'mount:'+p.pieceIndex:p.slot),0,0)
  assert.deepEqual(draws,expected,`${d.id} ${dir} tick ${tick}`)
 }
})

test('mouse/mammoth preserve captured source rider coordinates while declaring saddle alignment unverified', () => {
 const reference=JSON.parse(fs.readFileSync(new URL('./fixtures/horse-rider-source-clocks.json',import.meta.url)))
 const jar=unzipSync(fs.readFileSync(new URL('../KnightOnline_v403.jar',import.meta.url)))
 assert.equal(hash(jar['GameObjects/MainObject.class']),reference.mainObjectSha256)
 assert.equal(data.effectRigReference.packetSha256,reference.packetSha256)
 for(const id of ['effect-69','effect-106']) {
  const d=data.mounts.find(m=>m.id===id),records=[]
  assert.equal(d.riderBinding.status,'unverified')
  assert.equal(d.riderBinding.policy,'preserve-original')
  assert.equal(d.riderBinding.typeId,d.typeId)
  assert.match(d.warnings.join(' '),/Ghế ngồi chưa xác minh/)
  assert.equal(compileCompanion(d,'test').part.riderBinding.status,'unverified')
  for(const [dir,direction]of ['down','up','left','right'].entries())for(const [action,state]of ['idle','walk'].entries())for(let tick=1;tick<=360;tick++) {
   const p=companionFrame(d,direction,state,tick),raw=d.rig.frames[p.frame][0],piece=p.pieces[0]
   const xMount=piece.x-(dir===3?-raw.x-piece.w:raw.x),yMount=piece.y-raw.y
   records.push([dir,action,tick,p.frame,p.seat,p.bodyFrame,xMount,yMount])
  }
  assert.equal(records.length,reference.mounts[id].samples)
  assert.equal(hash(JSON.stringify(records)),reference.mounts[id].sha256)
 }
})
