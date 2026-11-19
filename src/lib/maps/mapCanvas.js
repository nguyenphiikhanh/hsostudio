import {terrainFrame,waterfallFrames} from './mapEffects.js'
import {sortObjects,objectPlacement} from './mapGeometry.js'

// LoadMap.paint at gameTick % 14 == 7 uses the terrain sheet for every tile.
export function drawTerrain(ctx,map,images,options={}) {
  const s=map.tileSize
  const v=options.viewport??{x:0,y:0,width:map.width*s,height:map.height*s}
  const x0=Math.max(0,Math.floor(v.x/s)),y0=Math.max(0,Math.floor(v.y/s)),x1=Math.min(map.width,Math.ceil((v.x+v.width)/s)),y1=Math.min(map.height,Math.ceil((v.y+v.height)/s))
  for(let row=y0;row<y1;row++)for(let col=x0;col<x1;col++){const i=row*map.width+col;if(map.tiles[i]<=0)continue
    const f=terrainFrame(map,map.tiles[i],i%map.width,options.tick??7,options.water),d=f.asset.density
    ctx.drawImage(images.get(f.asset.image),f.x*d,f.y*d,s*d,s*d,i%map.width*s,Math.floor(i/map.width)*s,s,s)
  }
}
export function drawObjects(ctx,map,templates,images,options={}) {
  for(const o of options.sortedObjects??sortObjects(map.objects)) {
    const d=templates[o.templateId],p=objectPlacement(o,d,map.tileSize)
    const v=options.viewport;if(v&&(p.x+p.width<v.x||p.y+p.height<v.y||p.x>v.x+v.width||p.y>v.y+v.height))continue
    ctx.drawImage(images.get(d.asset.image),p.x,p.y,p.width,p.height)
  }
}
export function drawMap(ctx,map,templates,images,options={terrain:true,objects:true}) {
  ctx.imageSmoothingEnabled=false
  ctx.save();ctx.beginPath();ctx.rect(0,0,map.width*map.tileSize,map.height*map.tileSize);ctx.clip()
  if(options.terrain)drawTerrain(ctx,map,images,options)
  if(options.terrain&&options.waterfall)for(const f of waterfallFrames(map,options.tick??0,true)){const d=f.asset.density;ctx.drawImage(images.get(f.asset.image),0,f.frame*24*d,24*d,24*d,f.x,f.y,24,24)}
  if(options.objects)drawObjects(ctx,map,templates,images,options)
  ctx.restore()
}
