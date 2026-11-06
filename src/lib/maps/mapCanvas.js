import {sortObjects,objectPlacement} from './mapGeometry.js'

// LoadMap.paint at gameTick % 14 == 7 uses the terrain sheet for every tile.
export function drawTerrain(ctx,map,images) {
  const a=map.tileset.terrain,image=images.get(a.image),s=map.tileSize,d=a.density
  for(let i=0;i<map.tiles.length;i++)if(map.tiles[i]>0)ctx.drawImage(image,0,(map.tiles[i]-1)*s*d,s*d,s*d,(i%map.width)*s,Math.floor(i/map.width)*s,s,s)
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
  if(options.terrain)drawTerrain(ctx,map,images)
  if(options.objects)drawObjects(ctx,map,templates,images)
  ctx.restore()
}
