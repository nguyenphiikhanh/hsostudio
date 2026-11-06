import catalog from '../data/titles.json'
import { validateTitle } from './titlePose.js'
export const titleCatalog = catalog
export function titleLayer(id) {
  const d = validateTitle(catalog.titles.find(d=>d.id===String(id)))
  return {slot:'title',name:d.label,partId:d.id,title:d,provenance:d.provenance,
    asset:{...d.asset},...d.rig.rects[0],x:0,y:0,visible:true}
}
