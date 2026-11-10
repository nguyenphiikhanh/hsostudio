import {terrainRect} from './mapGeometry.js'
// HSO 4.0.3 LoadMap.paint/loadmap and ThacNuoc.update/paint.
const waterRanges={9:[19,26],10:[4,25],11:[20,37],12:[35,44]}
const falls={9:[27,31,0],10:[18,19,5],11:[38,39,7]}
export function waterRange(map){if(map.tileset.kind==='imported-png')return [0,-1];return map.tileset.id<9?[map.tileset.info[0],map.tileset.info[1]-1]:(waterRanges[map.tileset.id]??[0,-1])}
export function waterfallId(map,tile){const r=falls[map.tileset.id];return r&&tile>=r[0]&&tile<=r[1]?tile-r[0]+r[2]:null}
export function attachEffects(map,manifest){
 const [start,end]=waterRange(map),native=map.tileset.water
 let water=native
 // These x4 sheets cannot represent the complete verified native water range.
 if([9,11,12].includes(map.tileset.id))water=manifest.assets[`tilewater${map.tileset.id}`]
 if(start<=0||end<start)water=null
 const group=falls[map.tileset.id],waterfalls={}
 if(group)for(let id=group[2];id<=group[2]+group[1]-group[0];id++)waterfalls[id]=manifest.assets[`tilethac${id}`]
 return {...map,limitations:(map.limitations??[]).filter(note=>!note.includes('chưa phát nước/thác')).concat('Nước/thác theo client 4.0.3; thác x1, nước tileset 9/11/12 fallback x1. Background và hiệu ứng bổ sung chưa khôi phục.'),effects:{version:1,tickMs:40,water,waterfalls,provenance:'hso-java-4.0.3',jarSha256:manifest.jarSha256}}
}
export function effectAssets(map){return [map.effects?.water,...Object.values(map.effects?.waterfalls??{})].filter(Boolean)}
export function terrainFrame(map,tile,col,tick=7,animate=false){
 const [start,end]=waterRange(map),phase=((tick%14)+14)%14
 const water=map.effects?.water
 if(animate&&water&&tile>=start&&tile<=end&&((phase<7&&col%2===0)||(phase>7&&col%2!==0))){
  const k=tile-start,x=Math.floor(k/10)*24,y=k%10*24
  if((x+24)*water.density>water.width||(y+24)*water.density>water.height)throw new Error('Crop nước vượt PNG gốc')
  return {asset:water,x,y}
 }
 return {asset:map.tileset.terrain,...terrainRect(map.tileset,tile)}
}
export function waterfallFrames(map,tick=0,animate=false){
 const result=[]
 for(let i=0;i<map.tiles.length;i++){
  const id=waterfallId(map,map.tiles[i]),asset=map.effects?.waterfalls?.[id]
  if(asset)result.push({asset,x:i%map.width*24,y:Math.floor(i/map.width)*24,frame:animate?Math.floor(tick/4)%4:0})
 }
 return result
}
