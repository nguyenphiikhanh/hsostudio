import { query } from './catalog'
import eyes from '../../reference/hso403/eyes.json'

export function characterParts() {
  const rows = query(`SELECT a.*, p.slot, p.label, p.part_id, t.frames, t.offsets,
    p.provenance, t.density, t.note AS quality_note, p.asset_id AS base_asset
    FROM character_parts p JOIN character_textures t ON t.base_asset=p.asset_id
    JOIN assets a ON a.id=t.asset_id ORDER BY p.slot,p.part_id`)
  return [...rows.filter(row=>row.slot!=='eyes'),...eyes.parts.map(row=>({...row,base_asset:row.id}))]
}
