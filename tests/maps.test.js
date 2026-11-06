import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {validateMap,collisionGrid,terrainType,sortObjects,cellAt,mapAssets} from '../src/lib/maps/mapGeometry.js'
const json=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)))
const index=json('../public/game/maps/index.json'),table=json('../public/game/maps/objects.json'),templates=Object.fromEntries(table.templates.map(t=>[t.id,t]))
const hash=b=>createHash('sha256').update(b).digest('hex')

test('91 bundled maps preserve native tile/object/warp packets and every required x4 PNG without HSO or scripts',()=>{
 assert.equal(index.maps.length,124);assert.equal(index.readyCount,91);assert.equal(table.templates.length,307)
 assert.equal(index.maps.filter(m=>m.status==='name-only').length,33)
 assert.equal(hash(Buffer.from(table.source.rawHex,'hex')),table.source.sha256)
 const pngs=new Set()
 for(const m of index.maps.filter(m=>m.status==='ready')) {
  const d=validateMap(json('../public/game/'+m.path),templates),b=Buffer.from(d.source.rawHex,'hex')
  assert.equal(hash(b),d.source.sha256)
  let p=2;const nameLength=b.readUInt16BE(p);p+=2
  assert.equal(b.subarray(p,p+nameLength).toString('utf8'),d.name);p+=nameLength
  const payloadLength=b.readUInt16BE(p);p+=2
  assert.equal(payloadLength,3+d.width*d.height)
  assert.equal(b.readInt8(p),d.width);assert.equal(b.readInt8(p+1),d.height);assert.equal(b.readInt8(p+2),d.tileset.id)
  assert.deepEqual(Array.from(b.subarray(p+3,p+payloadLength)),d.tiles);p+=payloadLength
  const bg=b.readInt8(p++);if(bg>=0)p+=2
  const objectsLength=b.readUInt16BE(p);p+=2;const start=p
  assert.equal(b.readInt16BE(p),d.objects.length);p+=2
  for(const o of d.objects){assert.equal(b.readInt16BE(p),o.templateId);assert.equal(b.readInt16BE(p+2),o.cellX);assert.equal(b.readInt16BE(p+4),o.cellY);p+=6}
  assert.equal(b.subarray(p,start+objectsLength).toString('hex'),d.source.extraObjectHex)
  p=start+objectsLength;assert.equal(b.readInt8(p++),d.warps.length)
  for(const gate of d.warps){assert.equal(b.readInt16BE(p),gate.x);assert.equal(b.readInt16BE(p+2),gate.y);const length=b.readUInt16BE(p+4);p+=6;assert.equal(b.subarray(p,p+length).toString('utf8'),gate.name);p+=length}
  assert.equal(b.readInt8(p++),d.transitionFlag);assert.equal(p,b.length)
  for(const a of mapAssets(d,templates))if(!pngs.has(a.image)){
   const png=fs.readFileSync(new URL('../public/game/'+a.image,import.meta.url));assert.equal(hash(png),a.sha256);assert.equal(png.readUInt32BE(16),a.width);assert.equal(png.readUInt32BE(20),a.height);pngs.add(a.image)
  }
  assert.equal(collisionGrid(d,templates).length,d.width*d.height)
 }
})
test('native collision includes object blocks, preserves slow cells and rejects out-of-bounds queries',()=>{
 const tileset={id:0,info:[26,36]}
 assert.deepEqual([0,1,25,26,35,36].map(t=>terrainType(t,tileset)),[1,0,0,2,2,1])
 assert.equal(terrainType(19,{id:9,info:[1,99]}),1)
 const m={width:2,height:2,tileSize:24,tiles:[1,26,1,36],tileset,objects:[{templateId:0,cellX:0,cellY:0}]}
 const collision=collisionGrid(m,{0:{blocks:[[-1,0],[0,1],[2,0]]}})
 assert.deepEqual(collision,[0,2,1,1]);assert.equal(cellAt(m,collision,25,1).type,2)
 for(const [x,y]of [[-1,0],[0,-1],[48,0],[0,48]])assert.equal(cellAt(m,collision,x,y),null)
 const bad=json('../public/game/maps/0.json');bad.tiles[0]=999;assert.throws(()=>validateMap(bad,templates),/Tile/)
})
test('object order matches original Java quickSort1 for every map, including equal-row objects',()=>{
 const fixture=json('./fixtures/map-native-order.json')
 assert.equal(fixture.classSha256,index.source.classes['Model/CRes'])
 for(const m of index.maps.filter(m=>m.status==='ready')) {
  const d=json('../public/game/'+m.path),order=sortObjects(d.objects).map(o=>o.index)
  assert.equal(hash(JSON.stringify(order)),fixture.orders[d.id],d.name)
 }
})
