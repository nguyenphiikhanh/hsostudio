import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {attachEffects,terrainFrame,waterfallFrames,waterRange,effectAssets} from '../src/lib/maps/mapEffects.js'
const root=new URL('../public/game/',import.meta.url)
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root)))
const manifest=read('maps/effects/manifest.json')
test('native water parity and tick 7 boundary match LoadMap.paint for every bundled crop',()=>{
 let cells=0,falls=0
 for(const entry of read('maps/index.json').maps.filter(m=>m.status==='ready')){
  const map=attachEffects(read(entry.path),manifest),[start,end]=waterRange(map)
  for(let i=0;i<map.tiles.length;i++){
   const tile=map.tiles[i];if(tile<=0)continue
   for(let tick=0;tick<14;tick++){
    const f=terrainFrame(map,tile,i%map.width,tick,true)
    const expected=start>0&&tile>=start&&tile<=end&&((tick<7&&i%map.width%2===0)||(tick>7&&i%map.width%2!==0))
    assert.equal(f.asset===map.effects.water,!!expected)
    assert.ok((f.x+24)*f.asset.density<=f.asset.width)
    assert.ok((f.y+24)*f.asset.density<=f.asset.height)
    assert.equal(terrainFrame(map,tile,i%map.width,tick,false).asset,map.tileset.terrain)
   }cells++
  }
  const frames=waterfallFrames(map,0,true);falls+=frames.length
  for(let tick=0;tick<32;tick++)for(const f of waterfallFrames(map,tick,true)){assert.equal(f.frame,Math.floor(tick/4)%4);assert.equal(f.asset.height,96)}
  for(const a of effectAssets(map)){
   const b=fs.readFileSync(new URL(a.image,root));assert.equal(createHash('sha256').update(b).digest('hex'),a.sha256)
   assert.equal(b.readUInt32BE(16),a.width);assert.equal(b.readUInt32BE(20),a.height)
  }
 }
 assert.ok(cells>10000);assert.equal(falls,414)
})
test('waterfall mapping preserves native tiles and logical coordinates, with x1 provenance',()=>{
 const m=attachEffects(read('maps/66.json'),manifest)
 assert.equal(m.effects.water.density,1)
 const frames=waterfallFrames(m,4,true);assert.equal(frames.length,16)
 for(const f of frames){assert.equal(f.x%24,0);assert.equal(f.y%24,0);assert.equal(f.frame,1);assert.equal(f.asset.density,1);assert.match(f.asset.source,/KnightOnline/)}
})
