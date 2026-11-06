import { computed, onMounted, ref, watch, nextTick, provide, inject } from 'vue'
import { gameUrl, imageAsset, loadCatalog, query } from '../lib/catalog'
import { downloadZip, exportFileName, exportAtlas, loadImage } from '../lib/export'
import { paintLayers, resolvePose } from '../lib/characterPose'
import { exportPartLibrary } from '../lib/libraryExport'

const WorkbenchKey = Symbol('HSO workbench')

function createWorkbench() {

  const gameLayers = ref(null)
  function openGame() { gameLayers.value = JSON.parse(JSON.stringify(layers.value)) }

  const tables = [ ['assets', 'Tài nguyên'], ['mobs', 'Quái vật'], ['item3', 'Trang bị'], ['item4', 'Vật phẩm 4'], ['item5', 'Vật phẩm 5'], ['item7', 'Vật phẩm 7'], ['fashiontemplate', 'Thời trang'], ['skills', 'Kỹ năng'], ['maps', 'Bản đồ'], ['pet', 'Thú cưng'] ]
  const ready = ref(false), error = ref(''), busy = ref(false), table = ref('assets'), search = ref(''), category = ref('part_char'), zoom = ref('x1'), decoded = ref(true), page = ref(0)
  const rows = ref([]), total = ref(0), selected = ref(null), draft = ref({}), drafts = ref({}), asset = ref(null), report = ref(null)
  const characterClass = ref(0)
  const layers = ref([]), activeLayer = ref(-1), canvas = ref(null), stage = ref(null), scale = ref(6), notice = ref(''), categories = ref([])
  const preview = ref({ direction: 'down', motion: 'idle', pose: 0 })
  const exportName = ref('character')
  const archiveName = computed(() => exportFileName(exportName.value))
  const pageSize = 60
  const title = computed(() => tables.find(t => t[0] === table.value)?.[1])
  const fields = computed(() => Object.keys(draft.value))
  const layer = computed(() => layers.value[activeLayer.value])
  const draftCount = computed(() => Object.keys(drafts.value).length)
  const rowKey = row => `${table.value}:${row.id ?? row.name}`
  function refresh() {
    if (!ready.value) return
    let where = ' WHERE 1=1', params = []
    if (search.value) {
      const field = table.value === 'assets' ? 'source' : 'name'
      where += ` AND (CAST(id AS TEXT) LIKE ? OR "${field}" LIKE ?)`
      params.push(`%${search.value}%`, `%${search.value}%`)
    }
    if (table.value === 'assets') {
      if (category.value) { where += ' AND category = ?'; params.push(category.value) }
      if (zoom.value) { where += ' AND zoom = ?'; params.push(zoom.value) }
      if (decoded.value) { where += " AND status = 'decoded'" }
    }
    total.value = query(`SELECT COUNT(*) AS n FROM "${table.value}"${where}`, params)[0].n
    rows.value = query(`SELECT * FROM "${table.value}"${where} ORDER BY id LIMIT ? OFFSET ?`, [...params, pageSize, page.value * pageSize])
  }
  function select(row) {
    selected.value = row
    draft.value = JSON.parse(JSON.stringify(drafts.value[rowKey(row)] || row))
    asset.value = imageAsset(row, table.value)
  }
  function changeTable(value) { table.value = value; selected.value = null; asset.value = null; search.value = ''; page.value = 0; refresh() }
  function applyDraft() {
    drafts.value[rowKey(selected.value)] = JSON.parse(JSON.stringify(draft.value))
    asset.value = imageAsset(draft.value, table.value)
    notice.value = 'Đã áp dụng nháp trong bộ nhớ. Tải lại trang sẽ bỏ thay đổi.'
  }
  function resetDraft() { delete drafts.value[rowKey(selected.value)]; select(selected.value) }
  function addLayer() {
    if (!asset.value) return
    layers.value.push({ name: `Lớp ${layers.value.length + 1}`, asset: { ...asset.value }, sx: 0, sy: 0, w: asset.value.width, h: asset.value.height, x: 0, y: 0, visible: true })
    activeLayer.value = layers.value.length - 1
  }
  function replaceLayer() {
    if (!layer.value || !asset.value) return
    Object.assign(layer.value, { slot: null, partId: null, provenance: 'manual-crop', poseFrames: null, poseOffsets: null, asset: { ...asset.value }, sx: 0, sy: 0, w: asset.value.width, h: asset.value.height })
  }
  function updateCharacter(next) {
    layers.value = next
    centerStage()
  }
  function clearCharacter() { layers.value = []; activeLayer.value = -1 }
  function removeLayer(index) { layers.value.splice(index, 1); activeLayer.value = Math.min(index, layers.value.length - 1) }
  function moveLayer(index, offset) {
    const other = index + offset
    if (other < 0 || other >= layers.value.length) return
    const item = layers.value.splice(index, 1)[0]
    layers.value.splice(other, 0, item)
    activeLayer.value = other
  }
  let renderId = 0
  async function centerStage() {
    await nextTick()
    if (stage.value) {
      stage.value.scrollLeft = Math.max(0, (stage.value.scrollWidth - stage.value.clientWidth) / 2)
      stage.value.scrollTop = Math.max(0, 220 * scale.value - stage.value.clientHeight / 2)
    }
  }
  async function draw() {
    const id = ++renderId
    await nextTick()
    if (!canvas.value) return
    const ctx = canvas.value.getContext('2d')
    ctx.setTransform(4, 0, 0, 4, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, 640, 480)
    ctx.strokeStyle = '#839177'
    ctx.beginPath()
    ctx.moveTo(310, 240); ctx.lineTo(330, 240)
    ctx.moveTo(320, 230); ctx.lineTo(320, 250)
    ctx.stroke()
    const snapshot = layers.value.map(l => ({ ...l, asset: { ...l.asset } }))
    try {
      const posed = resolvePose(snapshot, preview.value.direction, preview.value.pose, preview.value.breath ?? 0, preview.value.attackOptions)
      const images = await Promise.all(posed.map(l => loadImage(l.asset)))
      if (id !== renderId) return
      paintLayers(ctx, posed, images, 320, 240)
    } catch (e) { error.value = e.message }
  }
  async function exportDrafts() {
    busy.value = true; error.value = ''
    try {
      await downloadZip(`${archiveName.value}-drafts`, { [`${archiveName.value}-drafts.json`]: JSON.parse(JSON.stringify(drafts.value)) })
      notice.value = `Đã tải ${archiveName.value}-drafts.zip.`
    } catch (e) { error.value = e.message }
    finally { busy.value = false }
  }
  async function exportLibrary() {
    busy.value = true; error.value = ''
    const name = exportName.value
    const snapshot = JSON.parse(JSON.stringify(layers.value))
    const draftSnapshot = JSON.parse(JSON.stringify(drafts.value))
    try {
      const result = await exportPartLibrary(name, snapshot, draftSnapshot, message => { notice.value = message }, preview.value.attackTrial)
      notice.value = `Đã tải ${exportFileName(name).slice(0, 72)}-library.zip: ${result.parts} thư mục part ưu tiên x4 và ${result.companions} rig thú và ${result.titles} danh hiệu (PNG + metadata + atlas riêng), ${result.items} trang bị có ánh xạ. Hỗ trợ đứng/đi 4 hướng; có clip tấn công kèm provenance trong animations.json. Runtime hỗ trợ part cơ thể, danh hiệu và rig mount/pet đã xác minh; vũ khí vẫn là preview.${result.omitted ? ' Xem character.omittedLayers cho các lớp/vùng cắt không được giữ lại.' : ''}`
    } catch (e) { error.value = e.message; notice.value = '' }
    finally { busy.value = false }
  }
  async function exportCharacter() {
    busy.value = true; error.value = ''
    try { await exportAtlas(resolvePose(JSON.parse(JSON.stringify(layers.value)), preview.value.direction, preview.value.pose, preview.value.breath ?? 0, preview.value.attackOptions), JSON.parse(JSON.stringify(drafts.value)), { ...preview.value }, exportName.value); notice.value = `Đã tải ${archiveName.value}.zip gồm PNG, atlas JSON, composition và mã mẫu Phaser. Bản xuất là tư thế đang xem.` }
    catch (e) { error.value = e.message }
    finally { busy.value = false }
  }
  watch([search, category, zoom, decoded], () => { page.value = 0; refresh() })
  watch(page, refresh)
  watch([layers, preview], draw, { deep: true })
  watch(scale, centerStage)
  onMounted(async () => {
    try {
      await loadCatalog()
      const response = await fetch(gameUrl('report.json'))
      if (!response.ok) throw new Error('Không tải được báo cáo tài nguyên.')
      report.value = await response.json()
      categories.value = query('SELECT DISTINCT category FROM assets ORDER BY category').map(r => r.category)
      ready.value = true; refresh(); draw(); centerStage()
    } catch (e) { error.value = e.message }
  })
  return { gameLayers, openGame, tables, ready, error, busy, table, search, category, zoom, decoded, page, rows, total, selected, draft, drafts, asset, report, characterClass, layers, activeLayer, canvas, stage, scale, notice, categories, preview, exportName, archiveName, pageSize, title, fields, layer, draftCount, refresh, select, changeTable, applyDraft, resetDraft, addLayer, replaceLayer, updateCharacter, clearCharacter, removeLayer, moveLayer, centerStage, draw, exportDrafts, exportLibrary, exportCharacter }
}

export function provideWorkbench() {
  const state = createWorkbench()
  provide(WorkbenchKey, state)
  return state
}

export function useWorkbench() {
  const state = inject(WorkbenchKey)
  if (!state) throw new Error('Workbench context is missing')
  return state
}
