import { query } from './catalog'
import { getSkillTwoReference } from './clientSkillTwo'

export function clientWeaponLayer(item) {
  if (!item || ![8, 9, 10, 11].includes(item.type)) return null
  const ready = query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('hso_weapon_sheets','hso_client_reference')")
  if (ready.length !== 2) return null
  const row = query('SELECT definition FROM hso_weapon_sheets WHERE clazz=? AND part=?', [item.clazz, item.part])[0]
  if (!row) return null
  const source = JSON.parse(row.definition)
  const reference = JSON.parse(query('SELECT definition FROM hso_client_reference WHERE id=1')[0].definition)
  const profile = reference.classes.find(profile => profile.clazz === item.clazz)
  const splash = profile.splash
  const [x, y] = source.offsets[0][0]
  const asset = { id: source.source, source: source.source, image: source.image, width: source.width, height: source.height, density: source.density }
  return { slot: 'weapon', name: `${item.name} · #${item.id}`, itemId: item.id, clazz: item.clazz, partId: item.part, provenance: 'official-client-4.0.3', asset,
    ...source.frames[0], x, y, visible: true, clientWeapon: { ...source, skillOne: reference.skillOne, skillTwo: getSkillTwoReference(), splash: { ...splash, source: `jar:x1/wps/${profile.folder}/0.png` } } }
}
