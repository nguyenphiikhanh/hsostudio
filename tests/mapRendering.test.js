import {test} from 'node:test'
import assert from 'node:assert/strict'
import {drawTerrain,drawObjects} from '../src/lib/maps/mapCanvas.js'
import {sortObjects,hitObject,objectPlacement} from '../src/lib/maps/mapGeometry.js'

test('terrain viewport culling draws only intersecting cells while export still draws all cells',()=>{
 const image={},map={width:100,height:100,tileSize:24,tiles:Array(10000).fill(1),tileset:{id:0,info:[2,2],terrain:{image:'terrain',density:4,width:96,height:96}}},images=new Map([['terrain',image]]),calls=[]
 const ctx={drawImage(...args){calls.push(args)}}
 drawTerrain(ctx,map,images,{viewport:{x:240,y:240,width:48,height:48}})
 assert.equal(calls.length,4);assert.deepEqual(calls.map(a=>a.slice(5,7)),[[240,240],[264,240],[240,264],[264,264]])
 calls.length=0;drawTerrain(ctx,map,images);assert.equal(calls.length,10000)
})
test('culling keeps native object order and includes sprites whose anchors lie outside the viewport',()=>{
 const template={dx:-12,dy:-20,asset:{image:'object',width:188,height:272,density:4}},templates={0:template},images=new Map([['object',{}]])
 const map={tileSize:24,objects:[{index:0,templateId:0,cellX:2,cellY:1},{index:1,templateId:0,cellX:0,cellY:0},{index:2,templateId:0,cellX:20,cellY:10}]},ordered=sortObjects(map.objects),calls=[]
 drawObjects({drawImage(...args){calls.push(args)}},map,templates,images,{viewport:{x:0,y:0,width:40,height:40},sortedObjects:ordered})
 assert.equal(calls.length,2);assert.deepEqual(calls.map(a=>a.slice(1,3)),[[-12,-20],[36,4]])
 for(const x of [0,38,50])assert.deepEqual(hitObject(map,templates,x,20,ordered),hitObject(map,templates,x,20))
 assert.equal(objectPlacement(map.objects[0],template).x,36)
})
