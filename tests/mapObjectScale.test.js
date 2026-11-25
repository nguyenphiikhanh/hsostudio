import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createMapEditor} from '../src/lib/maps/mapEditor.js'
import {objectPlacement,objectScale,collisionGrid,hitObject,validateMap} from '../src/lib/maps/mapGeometry.js'
const map=JSON.parse(fs.readFileSync(new URL('../public/game/maps/0.json',import.meta.url))),table=JSON.parse(fs.readFileSync(new URL('../public/game/maps/objects.json',import.meta.url))),templates=Object.fromEntries(table.templates.map(t=>[t.id,t]))
test('scaling preserves the authored anchor, hit bounds, native source and independent collision',()=>{
 const object={index:0,templateId:0,cellX:8,cellY:9},d=templates[0],source={...map,objects:[object]},original=JSON.stringify(source),e=createMapEditor(source,templates,'table'),before=collisionGrid(e.map,templates)
 e.resize(0,2,3);const o=e.map.objects[0],p=objectPlacement(o,d)
 assert.equal(p.x,8*24+d.dx*2);assert.equal(p.y,9*24+d.dy*3);assert.equal(p.width,d.asset.width/d.asset.density*2);assert.equal(p.height,d.asset.height/d.asset.density*3)
 assert.deepEqual(collisionGrid(e.map,templates),before);assert.equal(e.stats.changed,1);assert.equal(e.history.undo,1)
 assert.equal(hitObject(e.map,templates,p.x+p.width-1,p.y+p.height-1).index,0)
 assert.equal(JSON.stringify(source),original)
 e.undo();assert.deepEqual(e.map.objects,[object]);e.redo();assert.equal(e.map.objects[0].scaleY,3)
 const copy=e.duplicate(0);assert.equal(e.map.objects.find(o=>o.index===copy).scaleX,2)
 e.resize(0,1,1);assert.equal(e.map.objects[0].scaleX,undefined);assert.equal(e.map.objects[0].scaleY,undefined)
})
test('scaled drafts round-trip optional fields and reject invalid scale atomically',()=>{
 const e=createMapEditor(map,templates,'table'),o=map.objects[0];e.resize(o.index,.5,2)
 const doc=e.draft(),fresh=createMapEditor(map,templates,'table');fresh.importEdits(fresh.parseDraft(doc));assert.deepEqual(fresh.map.objects,e.map.objects)
 for(const value of [0,-1,.01,9,NaN,Infinity,'2',null]){
  assert.throws(()=>objectScale({scaleX:value}),/Scale/)
  const bad=structuredClone(doc);bad.edits.objects[0].scaleY=value
  const previous=JSON.stringify(fresh.map);assert.throws(()=>fresh.importEdits(bad.edits),/Scale/);assert.equal(JSON.stringify(fresh.map),previous)
 }
 assert.deepEqual(objectScale({}),{scaleX:1,scaleY:1});assert.equal(validateMap(map,templates),map)
 const off={...map,objects:[{index:0,templateId:0,cellX:-1,cellY:0}]},edge=createMapEditor(off,templates,'table');edge.resize(0,2,2);edge.parseDraft(edge.draft())
})
