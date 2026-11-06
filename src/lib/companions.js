import catalog from '../data/companions.json'
import { validateCompanion } from './companionPose.js'
export const companionCatalog = catalog
export function companionLayer(slot,id) {
  const d=catalog[slot==='mount'?'mounts':'pets'].find(d=>d.id===String(id))
  validateCompanion(d,slot)
  return { slot,name:d.label,partId:d.id,provenance:catalog.provenance,companion:d,asset:{...d.asset},
    sx:0,sy:0,w:d.asset.frameWidth,h:d.asset.frameHeight,x:0,y:0,visible:true }
}
