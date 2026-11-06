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
