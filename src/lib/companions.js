import catalog from '../data/companions.json'
import { validateCompanion, companionBaseCrop } from './companionPose.js'
export const companionCatalog = catalog
export function companionLayer(slot,id) {
  const d=catalog[slot==='mount'?'mounts':'pets'].find(d=>d.id===String(id))
  validateCompanion(d,slot)
  return { slot,name:d.label,partId:d.id,provenance:catalog.provenance,companion:d,asset:{...d.asset},
    ...companionBaseCrop(d),x:0,y:0,visible:true }
}
