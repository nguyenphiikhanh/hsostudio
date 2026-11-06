import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {unzipSync} from 'fflate'
import catalog from '../src/data/titles.json' with {type:'json'}
import companions from '../src/data/companions.json' with {type:'json'}
import {titleFrame,titleCycleLength,validateTitle,compileTitle} from '../src/lib/titlePose.js'
import {resolvePose} from '../src/lib/characterPose.js'
import {companionFrame,companionViewport} from '../src/lib/companionPose.js'
const hash=b=>createHash('sha256').update(b).digest('hex')
const layer=d=>({slot:'title',title:d,asset:d.asset,visible:true,x:0,y:0})
test('11 server titles retain original x4 PNGs, raw frame geometry and client provenance',()=>{
 const jar=unzipSync(fs.readFileSync(new URL('../KnightOnline_v403.jar',import.meta.url)))
 assert.equal(catalog.titles.length,11)
 for(const [name,digest] of Object.entries(catalog.classes))assert.equal(hash(jar[name+'.class']),digest)
 for(const d of catalog.titles){
  validateTitle(d)
  assert.equal(d.effectId,d.partId+41)
  const png=fs.readFileSync(new URL('../public/game/'+d.asset.image,import.meta.url))
  assert.equal(hash(png),d.asset.sha256);assert.equal(hash(Buffer.from(d.rig.rawHex,'hex')),d.rig.rawSha256)
  assert.equal(png.readUInt32BE(16),d.asset.width);assert.equal(png.readUInt32BE(20),d.asset.height)
  assert.equal(compileTitle(d,'test').part.frameEntries.length,d.rig.rects.length)
  for(let tick=0;tick<titleCycleLength(d);tick++)assert.equal(titleFrame(d,tick).frame,Math.floor(tick/5))
 }
 const bad=structuredClone(catalog.titles[0]);bad.rig.frames[0][0].image=999
 assert.throws(()=>compileTitle(bad,'test'),/piece/)
})
test('title directions, breathing and mounted seats preserve native coordinates and draw order',()=>{
 const mount=companions.mounts.find(d=>d.id==='effect-106')
 for(const d of catalog.titles)for(const dir of ['down','up','left','right'])for(const motion of ['idle','walk','attack'])for(let tick=0;tick<titleCycleLength(d);tick+=5){
  const p=resolvePose([layer(d)],dir,2,-1,{motion,tick})
  const reference=titleFrame(d,tick)
  assert.deepEqual(p.map(({sx,sy,w,h,x,y,flipX})=>({sx,sy,w,h,x,y,flipX})),reference.pieces.map(({sx,sy,w,h,x,y,flipX})=>({sx,sy,w,h,x,y,flipX})))
  const mounted=resolvePose([{slot:'mount',companion:mount,asset:mount.asset,visible:true},layer(d)],dir,0,0,{motion:'walk',tick,titleTick:tick})
  const pieces=mounted.filter(p=>p.title),seat=companionFrame(mount,dir,'walk',tick).seat
  for(let i=0;i<pieces.length;i++){assert.equal(pieces[i].y,reference.pieces[i].y-seat);assert.ok(pieces[i].renderDepth>mounted.find(p=>p.companion).renderDepth)}
  const viewport=companionViewport([layer(d)])
  for(const piece of reference.pieces){assert.ok((piece.x+viewport.x)*viewport.scale>=0);assert.ok((piece.y+viewport.y)*viewport.scale>=0);assert.ok((piece.x+piece.w+viewport.x)*viewport.scale<=624);assert.ok((piece.y+piece.h+viewport.y)*viewport.scale<=624)}
 }
})
