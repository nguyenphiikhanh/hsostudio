import { gameUrl, query } from './catalog'
import { downloadZip, exportFileName } from './export'
import { DIRECTIONS, IDLE_CYCLE, WALK_CYCLE, IDLE_FPS, WALK_FPS, clientBasicClip, clientSkillClip } from './characterPose'
import poseSource from './characterPose.js?raw'
import runtimeSource from './library/runtime.js?raw'
import schemaSource from './library/partSchema.js?raw'
import reindexSource from './library/reindex-library.mjs?raw'
import { compilePart } from './library/partSchema'
import { characterParts } from './characterParts'
import { combatCatalog } from './combat'
import { createAttackTrial } from './attackTrial'

const SLOT_ORDER = ['pants', 'shirt', 'head', 'eyes', 'hair', 'helmet']
const cropKeys = ['sx', 'sy', 'w', 'h']

export async function exportPartLibrary(requestedName, layers, drafts, progress = () => {}, requestedTrial = {}) {
  const name = `${exportFileName(requestedName).slice(0, 72)}-library`
  const rows = characterParts()
  const combat = combatCatalog()
  const trial = requestedTrial.clientSkill ? clientSkillClip(requestedTrial.clazz, requestedTrial.skillId) : requestedTrial.clientBasic ? clientBasicClip(requestedTrial.clazz) : createAttackTrial(requestedTrial)
  if (!combat.classes.some(profile => profile.id === trial.clazz && profile.skills.some(skill => skill.id === trial.skillId))) throw new Error('Attack trial references an unknown server skill')
  if (!rows.length) throw new Error('Catalog chưa có part đã giải mã.')
  const manifest = { version: 1, name, resolution: 'x4', coordinateUnits: 'x1', qualityNotes: rows.filter(row => row.quality_note).map(row => ({ slot: row.slot, partId: row.part_id, source: row.source, density: row.density, reason: row.quality_note })), layout: 'per-part-folders', slotOrder: SLOT_ORDER, directions: DIRECTIONS.map(d => d.key), atlases: [], parts: {}, limitations: ['Đứng yên là hiệu ứng thở của Studio.', 'Di chuyển suy ra từ sprite, chưa đối chiếu client gốc.', 'Chưa gắn vũ khí, pet hoặc thú cưỡi; hiệu ứng kỹ năng chỉ có trong preview.', trial.experimental ? 'Tấn công đang là chuỗi thử nghiệm.' : `Timeline thân kỹ năng #${trial.skillId} đã đối chiếu client 4.0.3; xem giới hạn trong animations.json.`, 'Mắt preview thay thế dữ liệu mắt gốc bị rỗng.', 'Ưu tiên PNG/metadata x4; vị trí và frame trong part.json dùng đơn vị x1; không xuất vùng cắt thủ công.'] }
  const files = {}, assetKeys = new Map()
  for (const [index, row] of rows.entries()) {
    const definition = { version: 1, slot: row.slot, partId: row.part_id, label: row.label, source: row.source, provenance: row.provenance, density: row.density, resolution: row.zoom, qualityNote: row.quality_note, width: row.width, height: row.height, frames: JSON.parse(row.frames), offsets: JSON.parse(row.offsets) }
    const compiled = compilePart(definition, name)
    const response = await fetch(gameUrl(row.image))
    if (!response.ok || response.headers.get('content-type')?.includes('text/html')) throw new Error(`Không tải được ảnh part: ${row.source}. Chạy npm run prepare:game rồi tải lại Studio.`)
    files[compiled.paths.image] = new Uint8Array(await response.arrayBuffer())
    files[compiled.paths.data] = compiled.atlas
    files[compiled.paths.definition] = definition
    manifest.parts[compiled.key] = compiled.part
    manifest.atlases.push(compiled.atlasEntry)
    assetKeys.set(row.id, compiled.key)
    assetKeys.set(row.base_asset, compiled.key)
    if (index % 10 === 0) {
      progress(`Đóng gói thư mục part ${index + 1}/${rows.length}…`)
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }
  const slotByType = { 0: 'shirt', 1: 'pants', 2: 'helmet' }
  const equipment = { version: 1, mapping: 'studio-item-type-and-part-id', items: {}, unsupportedCount: 0 }
  for (const row of query('SELECT * FROM item3')) {
    const item = { ...row, ...(drafts[`item3:${row.id}`] || {}) }
    const slot = slotByType[item.type], partKey = `${slot}-${item.part}`
    if (slot && manifest.parts[partKey]) equipment.items[String(row.id)] = { id: row.id, name: item.name, slot, partKey, clazz: item.clazz, level: item.level, iconId: item.iconid }
    else equipment.unsupportedCount++
  }
  const character = { version: 1, equipment: {}, omittedLayers: [] }
  for (const layer of layers) {
    const key = assetKeys.get(layer.asset.id)
    if (!key || manifest.parts[key].slot !== layer.slot) { character.omittedLayers.push({ name: layer.name, reason: 'Lớp không thuộc thư viện part đã giải mã.' }); continue }
    const part = manifest.parts[key]
    const x = layer.x - part.offsets[0][0], y = layer.y - part.offsets[0][1]
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Vị trí lớp ${layer.name} không hợp lệ.`)
    character.equipment[layer.slot] = { partKey: key, x, y, visible: layer.visible }
    if (cropKeys.some(k => layer[k] !== part.frames[0].crop[k])) character.omittedLayers.push({ name: layer.name, reason: 'Vùng cắt tùy chỉnh được thay bằng frame gốc để đồng bộ animation.' })
  }
  files['library.json'] = manifest
  files['equipment.json'] = equipment
  files['combat.json'] = combat
  files['animations.json'] = { version: 1, provenance: 'studio-preview', states: {
    attack: trial,
    idle: { fps: IDLE_FPS, repeat: -1, frames: IDLE_CYCLE.map(idleOffset => ({ pose: 0, idleOffset })) },
    walk: { fps: WALK_FPS, repeat: -1, frames: WALK_CYCLE.map(pose => ({ pose, idleOffset: 0 })) },
  } }
  files['character.json'] = character
  files['drafts.json'] = drafts
  files['runtime.js'] = runtimeSource
  files['characterPose.js'] = poseSource
  files['partSchema.js'] = schemaSource
  files['package.json'] = { private: true, type: 'module' }
  files['reindex-library.mjs'] = reindexSource
  files['example.js'] = `import { preloadLibrary, EquipmentCharacter } from './runtime.js';
// Fetch JSON before creating the Phaser scene, or use a boot scene first.
export async function createLibraryScene(Phaser, baseUrl = '.') {
  const [library, equipment, animations, outfit] = await Promise.all(
    ['library.json', 'equipment.json', 'animations.json', 'character.json'].map(async path => {
      const response = await fetch(baseUrl + '/' + path);
      if (!response.ok) throw new Error('Cannot load ' + path);
      return response.json();
    })
  );
  return class extends Phaser.Scene {
    preload() { preloadLibrary(this, baseUrl, library); }
    create() {
      this.character = new EquipmentCharacter(this, library, equipment, animations, outfit, 400, 300);
      this.character.container.setScale(3);
      this.character.setState('walk', 'right');
      // Change parts without rebuilding an atlas:
      // this.character.equip('shirt', 1);
      // this.character.equip('helmet', null); // remove helmet
      // this.character.equipItem(80); // supported Studio item ID
      // this.character.setState('idle', 'down');
      // this.character.setState('attack', 'left'); // experimental one-shot, call again to replay
    }
  };
}
`
  files['README.md'] = `# ${name}\n\nGiải nén toàn bộ ZIP vào cùng một thư mục được phục vụ qua HTTP(S).\n\n- library.json: danh mục part ưu tiên x4, có density và báo cáo qualityNotes, mỗi part có thư mục và atlas riêng.\n- equipment.json: các item áo/quần/mũ có part tương ứng trong Studio; không phải danh sách mọi loại vật phẩm. Kiểm tra clazz/level trong game trước khi mặc.\n- animations.json: đứng yên, di chuyển và tấn công thử nghiệm, đủ 4 hướng. Attack có provenance studio-trial; không có hit event.\n- combat.json: 84 kỹ năng từ 4 packet server, kèm nguồn và SHA-256; typePaint/subEff chưa map sang sprite.\n- character.json: bộ part đang chọn, độ lệch vị trí và trạng thái hiển thị.\n- runtime.js + characterPose.js: ghép lớp, thay part/item và đồng bộ nhịp animation.\n- example.js: hàm tạo Phaser Scene.\n- parts/<slot>/<id>/sheet.png: ảnh riêng của part.\n- parts/<slot>/<id>/part.json: file nguồn để chỉnh ID, frame và điểm neo.\n- parts/<slot>/<id>/atlas.json: file atlas tự sinh từ part.json.\n- reindex-library.mjs: cập nhật atlas và danh mục sau khi thêm/sửa part.\n\nDùng:\n\n\`\`\`js\nimport Phaser from 'phaser';\nimport { createLibraryScene } from './example.js';\nconst Scene = await createLibraryScene(Phaser, '/assets/${name}');\nnew Phaser.Game({ type: Phaser.AUTO, width: 800, height: 600, pixelArt: true, scene: Scene });\n\`\`\`\n\nThêm thiết kế mới:\n\n1. Copy thư mục parts/shirt/0 thành parts/shirt/9000.\n2. Sửa partId thành 9000, label và provenance thành custom-design trong part.json.\n3. Thay sheet.png. width/height là pixel PNG; frames và offsets dùng đơn vị x1; density=4 chuyển crop sang pixel x4 khi tạo atlas. Nếu đổi bố cục, cập nhật các trường tương ứng. ZIP cũ thiếu density được hiểu là 1.\n4. Chạy \`node reindex-library.mjs\` trong thư mục giải nén (cần Node.js). Script kiểm tra tất cả part trước khi ghi atlas.json và library.json.\n5. Tải lại game rồi gọi character.equip('shirt', 9000). Nếu cần ID vật phẩm, thêm entry vào equipment.json tham chiếu shirt-9000.\n\nKhông cần sửa atlas chung hoặc chạy lại Studio. Chỉ sửa part.json; atlas.json và library.json là file sinh tự động. Ví dụ mẫu nạp toàn bộ part; preloadLibrary nhận danh sách partKey tùy chọn nếu cần nạp một tập nhỏ.\n\nAttack: character.setState('attack', 'left') phát một lần rồi giữ pose cuối; gọi lại để phát lại. Gọi setState('idle') để trở về thở. Với chuỗi thử nghiệm, đổi preparePose/strikePose/anchor trong Studio. Với chiêu #0/#1 đã đối chiếu, timeline dùng client 4.0.3; kiểm tra provenance và limitations trong animations.json. Cooldown server không được dùng làm FPS hoặc thời điểm hit.\n\nThay part: character.equip('shirt', 1). Thay bằng item: character.equipItem(80). Đổi hướng/trạng thái: character.setState('walk', 'left'). Runtime tự cập nhật theo Scene; gọi character.destroy() khi bỏ nhân vật.\n\nLưu ý:\n${manifest.limitations.map(line => '- ' + line).join('\n')}\n- Thứ tự lớp dùng slot chuẩn; lớp ghép tay không nằm trong thư viện. Xem character.omittedLayers.\n- Dữ liệu trang bị map theo type/part trong Studio, không xác nhận tương thích client HSO gốc.\n`
  progress(`Nén ${rows.length} thư mục part…`)
  await downloadZip(name, files)
  return { parts: rows.length, atlases: manifest.atlases.length, items: Object.keys(equipment.items).length, omitted: character.omittedLayers.length }
}
