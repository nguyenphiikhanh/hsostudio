import {effectAssets,terrainFrame,waterfallFrames} from './mapEffects.js'
import {sortObjects,objectPlacement,collisionGrid,cellAt,validateMap} from './mapGeometry.js'
export function preloadMap(scene,baseUrl,map,prefix=`hso-map-${map.id}`) {
  const base=baseUrl.replace(/\/$/,'')
  scene.load.spritesheet(`${prefix}-terrain`,`${base}/${map.tileset.terrain.image}`,{frameWidth:map.tileSize*4,frameHeight:map.tileSize*4})
  for(const a of effectAssets(map))scene.load.spritesheet(`${prefix}-effect-${a.sha256}`,`${base}/${a.image}`,{frameWidth:24*a.density,frameHeight:24*a.density})
  const loaded=new Set()
  for(const o of map.objects){const d=map.objectTemplates[o.templateId];if(loaded.has(d.image))continue;loaded.add(d.image);scene.load.image(`${prefix}-object-${d.image}`,`${base}/${d.asset.image}`)}
}
export function createMap(scene,map,prefix=`hso-map-${map.id}`) {
  validateMap(map,map.objectTemplates)
  const container=scene.add.container(0,0),terrainLayer=scene.add.container(0,0),objectLayer=scene.add.container(0,0),s=map.tileSize
  const effectLayer=scene.add.container(0,0)
  container.add([terrainLayer,effectLayer,objectLayer])
  const tiles=[]
  for(let i=0;i<map.tiles.length;i++)if(map.tiles[i]>0)tiles.push(terrainLayer.add(scene.add.image(i%map.width*s,Math.floor(i/map.width)*s,`${prefix}-terrain`,map.tiles[i]-1).setOrigin(0,0).setScale(1/4)).last)
  for(const o of sortObjects(map.objects)){const d=map.objectTemplates[o.templateId],p=objectPlacement(o,d,s);objectLayer.add(scene.add.image(p.x,p.y,`${prefix}-object-${d.image}`).setOrigin(0,0).setScale(1/d.asset.density).setDepth(o.cellY*s))}
  objectLayer.sort('depth')
  const waterfallSprites=waterfallFrames(map).map(f=>({f,sprite:effectLayer.add(scene.add.image(f.x,f.y,`${prefix}-effect-${f.asset.sha256}`,0).setOrigin(0,0).setScale(1/f.asset.density)).last}))
  let animations={water:false,waterfall:false,...map.rendering?.animation},elapsed=0,lastTick=-1,destroyed=false
  function render(tick){
    let j=0
    for(let i=0;i<map.tiles.length;i++)if(map.tiles[i]>0){
      const f=terrainFrame(map,map.tiles[i],i%map.width,tick,animations.water)
      const water=f.asset!==map.tileset.terrain,key=water?`${prefix}-effect-${f.asset.sha256}`:`${prefix}-terrain`
      tiles[j++].setTexture(key,water?f.x/24+f.y/24*(f.asset.width/f.asset.density/24):map.tiles[i]-1).setScale(1/f.asset.density)
    }
    effectLayer.setVisible(animations.waterfall)
    for(const {sprite} of waterfallSprites)sprite.setFrame(Math.floor(tick/4)%4)
  }
  function update(time,delta){if(destroyed||!(animations.water||animations.waterfall))return;elapsed+=delta;const tick=Math.floor(elapsed/40);if(tick!==lastTick){lastTick=tick;render(tick)}}
  function setAnimations(value){animations={...animations,...value};render(Math.floor(elapsed/40))}
  function destroy(){if(destroyed)return;destroyed=true;scene.events.off('update',update);scene.events.off('shutdown',destroy);container.destroy(true)}
  scene.events.on('update',update);scene.events.once('shutdown',destroy);render(0)
  const collision=collisionGrid(map,map.objectTemplates)
  return {container,terrainLayer,objectLayer,effectLayer,setAnimations,width:map.width*s,height:map.height*s,collision,
    collisionAt(x,y){return cellAt(map,collision,x,y)?.type??1},destroy}
}
