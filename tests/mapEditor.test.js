import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createMapEditor,lineCells,validateEdits} from '../src/lib/maps/mapEditor.js'
import {collisionGrid} from '../src/lib/maps/mapGeometry.js'
const source=()=>({version:1,id:0,name:'Native',width:3,height:3,tileSize:24,tiles:Array(9).fill(1),objects:[{index:0,templateId:0,cellX:1,cellY:1}],tileset:{id:0,info:[26,36],terrain:{image:'terrain.png',density:4,width:96,height:3840,sha256:'terrain'}},source:{sha256:'base',rawHex:'deadbeef'},spawns:[{mobId:1,x:0,y:0}],warps:[]})
const templates={0:{id:0,dx:0,dy:0,blocks:[[0,0]],asset:{image:'tree.png',width:96,height:96,density:4}},1:{id:1,dx:0,dy:0,blocks:[[0,0],[1,0]],asset:{image:'house.png',width:192,height:96,density:4}}}
const editor=()=>createMapEditor(source(),templates,'table')
test('one interpolated stroke is one reversible command and never changes native data',()=>{
 const original=source(),before=JSON.stringify(original),e=createMapEditor(original,templates,'table')
 e.begin('stroke');e.paint(lineCells({col:0,row:0},{col:2,row:0}),2);e.paint([{col:1,row:0}],2)
 assert.equal(e.history.undo,0);assert.equal(e.commit(),true);assert.equal(e.history.undo,1)
 assert.deepEqual(e.map.tiles.slice(0,3),[2,2,2]);assert.equal(e.stats.tiles,3)
 e.undo();assert.deepEqual(e.map.tiles,original.tiles);assert.equal(e.history.redo,1)
 e.begin('no op');e.paint([{col:0,row:0}],1);assert.equal(e.commit(),false);assert.equal(e.history.redo,1)
 e.begin('cancel');e.paint([{col:0,row:0}],3);e.cancel();assert.equal(e.map.tiles[0],1);assert.equal(e.history.redo,1)
 e.redo();assert.deepEqual(e.map.tiles.slice(0,3),[2,2,2]);assert.equal(JSON.stringify(original),before)
 assert.deepEqual(e.map.source,original.source);assert.deepEqual(e.map.spawns,original.spawns)
})
test('flood fill obeys tile boundaries, clears to zero and remains reversible',()=>{
 const s=source();s.tiles=[1,2,1,1,2,1,2,2,1];const e=createMapEditor(s,templates,'table')
 e.fill(0,0,0);assert.deepEqual(e.map.tiles,[0,2,1,0,2,1,2,2,1]);assert.equal(e.history.undo,1)
 assert.equal(collisionGrid(e.map,templates)[0],1);e.undo();assert.deepEqual(e.map.tiles,s.tiles)
 e.fill(0,0,1);assert.equal(e.history.undo,0)
})
test('object move/add/duplicate/delete preserve identities and derived collision, including overlap',()=>{
 const e=editor();assert.equal(collisionGrid(e.map,templates)[4],1)
 e.begin('move');e.move(0,2,2);e.commit()
 assert.equal(collisionGrid(e.map,templates)[4],0);assert.equal(collisionGrid(e.map,templates)[8],1)
 const copy=e.duplicate(0);assert.notEqual(copy,0);assert.equal(e.map.objects.length,2)
 e.remove(0);assert.equal(collisionGrid(e.map,templates)[8],1)
 e.undo();assert.equal(e.map.objects.length,2);e.undo();assert.equal(e.map.objects.length,1);e.undo();assert.equal(e.map.objects[0].cellX,1)
 const id=e.add(1,0,0);assert.equal(e.map.objects.find(o=>o.index===id).templateId,1)
 assert.equal(collisionGrid(e.map,templates)[0],1);assert.equal(collisionGrid(e.map,templates)[1],1)
 e.reset();assert.deepEqual(e.map.objects,source().objects);assert.ok(Object.values(e.stats).every(n=>n===0));e.undo();assert.equal(e.map.objects.length,2)
})
test('draft JSON round trip checks source identity, validates all edits atomically and imports as one undo command',()=>{
 const a=editor();a.begin('paint');a.paint([{col:0,row:0}],3);a.commit();a.add(1,0,2)
 const doc=JSON.parse(JSON.stringify(a.draft())),b=editor();b.importEdits(b.parseDraft(doc))
 assert.deepEqual(b.map.tiles,a.map.tiles);assert.deepEqual(b.map.objects,a.map.objects);assert.equal(b.history.undo,1)
 b.undo();assert.deepEqual(b.map.tiles,source().tiles)
 for(const key of ['mapId','sourceSha256','objectTableSha256','terrainSha256','width','height','tilesetId']){
  const bad=structuredClone(doc);bad.base[key]='wrong';assert.throws(()=>b.parseDraft(bad),/không khớp/)
 }
 const before=JSON.stringify(b.map)
 for(const mutate of [d=>d.tiles.pop(),d=>d.tiles[0]=999,d=>d.objects.push({...d.objects[0]}),d=>d.objects[0].templateId=999,d=>d.objects[0].cellX=-1,d=>d.objects[0].rotation=90,d=>d.spawns=[]]){
  const bad=structuredClone(doc.edits);mutate(bad);assert.throws(()=>b.importEdits(bad));assert.equal(JSON.stringify(b.map),before)
 }
 assert.throws(()=>b.parseDraft({version:1,tiles:[]}),/không phải nháp/)
})
test('native off-map anchors can round trip unchanged, while new invalid anchors fail; history is bounded',()=>{
 const s=source();s.objects[0].cellX=-1
 const e=createMapEditor(s,templates,'table');assert.deepEqual(e.parseDraft(e.draft()).objects,s.objects)
 const bad=e.draft();bad.edits.objects[0].cellX=-2;assert.throws(()=>e.parseDraft(bad),/ô neo/)
 const b=editor();for(let i=0;i<120;i++){b.begin('paint');b.paint([{col:0,row:0}],i%2?2:3);b.commit()}
 assert.equal(b.history.undo,100);for(let i=0;i<100;i++)b.undo();assert.equal(b.history.redo,100)
 b.begin('branch');b.paint([{col:1,row:0}],4);b.commit();assert.equal(b.history.redo,0)
})
