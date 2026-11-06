import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {unzipSync} from 'fflate'
import reference from '../reference/hso403/eyes.json' with {type:'json'}
import {resolvePose} from '../src/lib/characterPose.js'
import {compilePart} from '../src/lib/library/partSchema.js'
const hash=b=>createHash('sha256').update(b).digest('hex')
test('all original eye PNGs/metadata match pinned client byte for byte',()=>{
 const jar=fs.readFileSync(new URL('../KnightOnline_v403.jar',import.meta.url)),z=unzipSync(jar)
 assert.equal(hash(jar),reference.jarSha256);assert.equal(reference.parts.length,16);assert.equal(reference.defaultPart,8)
 for(const [name,digest]of Object.entries(reference.classes))assert.equal(hash(z[name+'.class']),digest)
 for(const p of reference.parts){
  const png=fs.readFileSync(new URL(`../public/game/${p.image}`,import.meta.url))
  assert.equal(hash(png),p.sha256);assert.deepEqual(png,Buffer.from(z[p.source.slice(4)]))
  assert.equal(Buffer.from(z[`c/eye/b${p.part_id}_eye_data`]).toString('hex'),p.metadataHex)
  assert.equal(p.density,1)
 }
})
test('original eye directions and all body anchors use actual metadata and native side mirroring',()=>{
 for(const p of reference.parts){
  const frames=JSON.parse(p.frames),offsets=JSON.parse(p.offsets)
  const layer={slot:'eyes',partId:p.part_id,provenance:p.provenance,asset:p,...frames[0],x:offsets[0][0],y:offsets[0][1],visible:true,poseFrames:frames,poseOffsets:offsets}
  const d={slot:'eyes',partId:p.part_id,provenance:p.provenance,width:p.width,height:p.height,density:1,frames,offsets}
  assert.equal(compilePart(d,'eyes').part.frames.length,3)
  for(const [dir,direction]of ['down','up','left','right'].entries())for(let body=0;body<6;body++){
   const [actual]=resolvePose([layer],direction,0,0,{clientBodyFrame:body})
   const frame=frames[Math.min(dir,2)],offset=offsets[(dir===3?2:dir)*6+body]
   assert.equal(actual.sx,frame.sx);assert.equal(actual.sy,frame.sy)
   assert.equal(actual.x,dir===3?-offset[0]-frame.w:offset[0]);assert.equal(actual.y,offset[1])
   assert.equal(actual.visible,dir!==1);assert.equal(actual.flipX,dir===3)
  }
 }
})
