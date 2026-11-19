import {test} from 'node:test'
import assert from 'node:assert/strict'
import {pngMapSize,splitPngTiles} from '../src/lib/maps/mapPngImport.js'
import {terrainRect,collisionGrid,validateMap} from '../src/lib/maps/mapGeometry.js'
import {createMapEditor,tileCount} from '../src/lib/maps/mapEditor.js'
test('PNG grid preserves density, explicit padding, pixel-exact deduplication and reconstruction',()=>{
 for(const density of [1,2,3,4]){
  const s=24*density,width=s*2+1,height=s+1,pixels=new Uint8ClampedArray(width*height*4)
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;pixels[i]=x%s;pixels[i+1]=y%s;pixels[i+2]=13;pixels[i+3]=255}
  assert.equal(pngMapSize(width,height,density).ready,false)
  assert.throws(()=>splitPngTiles(pixels,width,height,density),/viền/)
  const result=splitPngTiles(pixels,width,height,density,true)
  assert.equal(result.cols,3);assert.equal(result.rows,2);assert.equal(result.tiles[0],result.tiles[1]);assert.equal(result.unique.length,4)
  for(let y=0;y<result.paddedHeight;y++)for(let x=0;x<result.paddedWidth;x++){
   const tile=result.tiles[Math.floor(y/s)*result.cols+Math.floor(x/s)]-1,bytes=result.unique[tile],i=(y%s*s+x%s)*4
   for(let c=0;c<4;c++)assert.equal(bytes[i+c],x<width&&y<height?pixels[(y*width+x)*4+c]:0)
  }
 }
 assert.throws(()=>pngMapSize(128*24,24,1),/127/)
 assert.throws(()=>pngMapSize(10000,10000,4),/16 triệu/)
})
test('imported grid atlas has independent collision and round-trips tile/collision drafts',()=>{
 const a={width:96,height:48,density:2,columns:2,tileCount:2,image:'data:image/png;base64,test',sha256:'abc'}
 const map={version:1,id:-1,width:2,height:1,tileSize:24,tiles:[1,2],objects:[],tileset:{id:-1,kind:'imported-png',info:[3,3],terrain:a},source:{sha256:'source'}}
 validateMap(map,{});assert.equal(tileCount(map),2);assert.deepEqual(terrainRect(map.tileset,2),{x:24,y:0});assert.deepEqual(collisionGrid(map,{}),[0,0])
 const e=createMapEditor(map,{},'templates');e.begin('block');e.paintCollision([{col:1,row:0}],1);e.commit()
 const doc=e.draft();assert.deepEqual(doc.importedBase,{...map,collisionOverrides:{}});assert.equal(doc.edits.collisionOverrides[1],1)
 const restored=createMapEditor(doc.importedBase,{},'templates');restored.importEdits(restored.parseDraft(doc));assert.deepEqual(collisionGrid(restored.map,{}),[0,1])
 restored.undo();assert.deepEqual(collisionGrid(restored.map,{}),[0,0])
 assert.throws(()=>validateMap({...map,tiles:[1,3]},{}),/ngoài PNG/)
 assert.throws(()=>validateMap({...map,tileset:{...map.tileset,terrain:{...a,columns:3}}},{}),/Atlas/)
})

test('custom rows/columns require explicit padding/cropping and preserve aspect ratio',()=>{
 const original=pngMapSize(480,240,1,false,{cols:4,rows:4})
 assert.equal(original.ready,false);assert.equal(original.needsCrop,true);assert.deepEqual(original.placement,{x:0,y:0,width:480,height:240})
 assert.equal(pngMapSize(480,240,1,false,{cols:4,rows:4,crop:true}).ready,true)
 const contain=pngMapSize(480,240,1,true,{cols:4,rows:4,mode:'contain'})
 assert.equal(contain.ready,true);assert.equal(contain.scale,.2);assert.deepEqual(contain.placement,{x:0,y:24,width:96,height:48})
 const cover=pngMapSize(480,240,1,false,{cols:4,rows:4,mode:'cover'})
 assert.equal(cover.ready,false);assert.equal(cover.needsCrop,true);assert.deepEqual(cover.placement,{x:-48,y:0,width:192,height:96})
 assert.equal(pngMapSize(480,240,1,false,{cols:4,rows:4,mode:'cover',crop:true}).ready,true)
 assert.throws(()=>pngMapSize(24,24,1,true,{cols:0,rows:4}),/127/)
 assert.throws(()=>pngMapSize(24,24,1,true,{cols:4.5,rows:4}),/127/)
 assert.throws(()=>pngMapSize(24,24,4,true,{cols:127,rows:127}),/16 triệu/)
})
