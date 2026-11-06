import {sortObjects,objectPlacement,collisionGrid,cellAt,validateMap} from './mapGeometry.js'
export function preloadMap(scene,baseUrl,map,prefix=`hso-map-${map.id}`) {
  const base=baseUrl.replace(/\/$/,'')
  scene.load.spritesheet(`${prefix}-terrain`,`${base}/${map.tileset.terrain.image}`,{frameWidth:map.tileSize*4,frameHeight:map.tileSize*4})
  const loaded=new Set()
  for(const o of map.objects){const d=map.objectTemplates[o.templateId];if(loaded.has(d.image))continue;loaded.add(d.image);scene.load.image(`${prefix}-object-${d.image}`,`${base}/${d.asset.image}`)}
}
export function createMap(scene,map,prefix=`hso-map-${map.id}`) {
  validateMap(map,map.objectTemplates)
  const container=scene.add.container(0,0),terrainLayer=scene.add.container(0,0),objectLayer=scene.add.container(0,0),s=map.tileSize
  container.add([terrainLayer,objectLayer])
  for(let i=0;i<map.tiles.length;i++)if(map.tiles[i]>0)terrainLayer.add(scene.add.image(i%map.width*s,Math.floor(i/map.width)*s,`${prefix}-terrain`,map.tiles[i]-1).setOrigin(0,0).setScale(1/4))
  for(const o of sortObjects(map.objects)){const d=map.objectTemplates[o.templateId],p=objectPlacement(o,d,s);objectLayer.add(scene.add.image(p.x,p.y,`${prefix}-object-${d.image}`).setOrigin(0,0).setScale(1/d.asset.density).setDepth(o.cellY*s))}
  objectLayer.sort('depth')
  const collision=collisionGrid(map,map.objectTemplates)
  return {container,terrainLayer,objectLayer,width:map.width*s,height:map.height*s,collision,
    collisionAt(x,y){return cellAt(map,collision,x,y)?.type??1},destroy(){container.destroy(true)}}
}
