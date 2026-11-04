// Rules verified in UseItem.ProcessItem3, Player.player_wear and Service.send_wear.
export const NORMAL_WEAPON_TYPES = [8, 9, 10, 11]
export function weaponEquipmentFacts(item, clazz, level) {
  if (!item || (!NORMAL_WEAPON_TYPES.includes(item.type) && item.type !== 24)) throw new Error('Not an HSO weapon equipment template')
  if (!Number.isInteger(clazz) || clazz < 0 || clazz > 3 || !Number.isInteger(level) || level < 1) throw new Error('Invalid class or level')
  const classAllowed = item.clazz === 4 || item.clazz === clazz
  const levelAllowed = item.level <= level
  return {
    id: item.id, name: item.name, clazz: item.clazz, type: item.type, part: item.part, level: item.level, color: item.color,
    wearSlot: item.type === 24 ? 17 : 0,
    cosmeticWeaponId: item.type === 24 ? item.part + 41 : null,
    classAllowed, levelAllowed, eligible: classAllowed && levelAllowed,
    provenance: 'server-equipment-rules', visualStatus: item.type === 24 ? 'unverified' : 'client403-mapping',
    visualReason: 'Vũ khí thường dùng ánh xạ client 4.0.3 qua hso_weapon_sheets; thời trang chưa có renderer được đối chiếu.',
  }
}
