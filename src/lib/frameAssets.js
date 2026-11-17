import {validCrop} from './export'
import {skillOneScene,paintSkillOne} from './clientSkillOne'
import {skillTwoScene,paintSkillTwo} from './clientSkillTwo'
import {skillThreeScene,paintSkillThree} from './clientSkillThree'
import {skillFourScene,paintSkillFour} from './clientSkillFour'
import {clientSkillEffectScene,paintClientSkillEffects} from './clientSkillEffects'

export function inspectedEffect(layers,clazz,skillId,direction,tick,{enabled=false,mounted=false}={}){
 if(!enabled)return null
 const weapon=layers.find(l=>l.clientWeapon)?.clientWeapon
 if(!weapon)return null
 const entries={1:[weapon.skillOne,skillOneScene,paintSkillOne],2:[weapon.skillTwo,skillTwoScene,paintSkillTwo],3:[weapon.skillThree,skillThreeScene,paintSkillThree],4:[weapon.skillFour,skillFourScene,paintSkillFour]}
 const entry=entries[skillId]
 if(entry?.[0])return {scene:entry[1](clazz,direction,tick,entry[0]),paint:entry[2]}
 if(skillId>4&&!mounted&&weapon.skillEffects)return {scene:clientSkillEffectScene(clazz,skillId,direction,tick,weapon.skillEffects),paint:paintClientSkillEffects}
 return null
}
export function frameAssetGroups(layers,effect=null){
 const groups=new Map(),hidden=[],invalid=[]
 function add(layer,index,kind){
  const entry={number:index+1,name:layer.name??`Hiệu ứng ${index+1}`,slot:layer.slot??kind,partId:layer.partId??null,kind,logical:{x:layer.sx,y:layer.sy,width:layer.w,height:layer.h},placement:{x:layer.x,y:layer.y,width:layer.w,height:layer.displayHeight??layer.h},flipX:Boolean(layer.flipX),transform:layer.transform??0,depth:layer.renderDepth??(layer.slot==='weapon'&&layer.clientWeapon?(layer.renderFront?layers.length+2:-2):index),provenance:layer.provenance??layer.asset?.source??'unspecified'}
  if(!layer.visible){hidden.push(entry);return}
  if(!validCrop(layer)){invalid.push(entry);return}
  const d=layer.asset.density||1
  entry.rectPx={x:layer.sx*d,y:layer.sy*d,width:layer.w*d,height:layer.h*d}
  let group=groups.get(layer.asset.image)
  if(!group){group={asset:layer.asset,entries:[]};groups.set(layer.asset.image,group)}
  group.entries.push(entry)
 }
 layers.forEach((l,i)=>add(l,i,'character'))
 effect?.scene.sprites.forEach((s,i)=>add({...s,name:`Hiệu ứng #${s.id??s.asset.id??i} · frame ${s.frame}`,slot:'effect',visible:true,sx:0,sy:s.frame*s.asset.frameHeight,w:s.asset.frameWidth,h:s.asset.frameHeight},layers.length+i,'effect'))
 return {groups:[...groups.values()],hidden,invalid}
}
export function frameBounds(layers,effect=null){
 const boxes=layers.filter(l=>l.visible&&validCrop(l)).map(l=>({x:l.x,y:l.y,w:l.w,h:l.displayHeight??l.h}))
 for(const s of effect?.scene.sprites??[]){const r=Math.max(s.asset.frameWidth,s.asset.frameHeight);boxes.push({x:s.x-r,y:s.y-r,w:r*2,h:r*2})}
 for(const line of effect?.scene.lines??[]){const points=line.points??[{x:line.x0,y:line.y0},{x:line.x1,y:line.y1}];for(const p of points)boxes.push({x:p.x-2,y:p.y-2,w:4,h:4})}
 const left=Math.floor(Math.min(0,...boxes.map(b=>b.x)))-3,top=Math.floor(Math.min(0,...boxes.map(b=>b.y)))-3
 const right=Math.ceil(Math.max(1,...boxes.map(b=>b.x+b.w)))+3,bottom=Math.ceil(Math.max(1,...boxes.map(b=>b.y+b.h)))+3
 return {x:-left,y:-top,width:right-left,height:bottom-top}
}
