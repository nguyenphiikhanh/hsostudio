import {terrainFrame,waterfallFrames} from './mapEffects.js'
import {sortObjects,objectPlacement} from './mapGeometry.js'

// LoadMap.paint at gameTick % 14 == 7 uses the terrain sheet for every tile.
export function drawTerrain(ctx,map,images,options={}) {
  const s=map.tileSize
  for(let i=0;i<map.tiles.length;i++)if(map.tiles[i]>0){
    const f=terrainFrame(map,map.tiles[i],i%map.width,options.tick??7,options.water),d=f.asset.density
    ctx.drawImage(images.get(f.asset.image),f.x*d,f.y*d,s*d,s*d,i%map.width*s,Math.floor(i/map.width)*s,s,s)
  }
}
export function drawObjects(ctx,map,templates,images) {
  for(const o of sortObjects(map.objects)) {
    const d=templates[o.templateId],p=objectPlacement(o,d,map.tileSize)
    ctx.drawImage(images.get(d.asset.image),p.x,p.y,p.width,p.height)
  }
}
export function drawMap(ctx,map,templates,images,options={terrain:true,objects:true}) {
  ctx.imageSmoothingEnabled=false
  ctx.save();ctx.beginPath();ctx.rect(0,0,map.width*map.tileSize,map.height*map.tileSize);ctx.clip()
  if(options.terrain)drawTerrain(ctx,map,images,options)
  if(options.terrain&&options.waterfall)for(const f of waterfallFrames(map,options.tick??0,true)){const d=f.asset.density;ctx.drawImage(images.get(f.asset.image),0,f.frame*24*d,24*d,24*d,f.x,f.y,24,24)}
  if(options.objects)drawObjects(ctx,map,templates,images)
  ctx.restore()
}
