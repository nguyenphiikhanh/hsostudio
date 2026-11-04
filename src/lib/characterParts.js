import { query } from './catalog'

export function characterParts() {
  return query(`SELECT a.*, p.slot, p.label, p.part_id, t.frames, t.offsets,
    p.provenance, t.density, t.note AS quality_note, p.asset_id AS base_asset
    FROM character_parts p JOIN character_textures t ON t.base_asset=p.asset_id
    JOIN assets a ON a.id=t.asset_id ORDER BY p.slot,p.part_id`)
}
