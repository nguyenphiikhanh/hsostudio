import { query } from './catalog'

export function combatCatalog() {
  const tables = query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('combat_classes','combat_skills')")
  if (tables.length !== 2) throw new Error('Catalog chưa có dữ liệu kỹ năng server. Chạy npm run prepare:game rồi tải lại Studio.')
  const classes = query('SELECT * FROM combat_classes ORDER BY id')
  const skills = query('SELECT clazz,definition FROM combat_skills ORDER BY clazz,skill_id')
  return {
    provenance: 'server-message-29',
    sources: ['hso/src/main/java/client/Player.java:load_skill', 'hso/src/main/java/core/Service.java:send_skill', 'hso/src/main/java/map/MapService.java:use_skill'],
    limitations: ['performDur bằng 0 trong cả bốn gói; không suy ra FPS từ cooldown.', 'typePaint/subEff được giữ nguyên; chưa xác minh liên kết sang sprite hiệu ứng.', 'Liên kết item.part sang ảnh vũ khí và điểm cầm chưa xác minh.'],
    classes: classes.map(row => ({ ...row, skills: skills.filter(skill => skill.clazz === row.id).map(skill => JSON.parse(skill.definition)) })),
  }
}
