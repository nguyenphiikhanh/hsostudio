<script setup>
import { computed, defineAsyncComponent, onMounted, ref, watch, nextTick } from 'vue'
import { gameUrl, imageAsset, loadCatalog, query } from './lib/catalog'
import { downloadZip, exportFileName, exportAtlas, loadImage, validCrop } from './lib/export'
import CharacterPreset from './components/CharacterPreset.vue'
import CharacterAnimation from './components/CharacterAnimation.vue'
import { paintLayers, resolvePose } from './lib/characterPose'
import { exportPartLibrary } from './lib/libraryExport'

const GamePreview = defineAsyncComponent(() => import('./components/GamePreview.vue'))
const gameLayers = ref(null)
function openGame() { gameLayers.value = JSON.parse(JSON.stringify(layers.value)) }

const tables = [ ['assets', 'Tài nguyên'], ['mobs', 'Quái vật'], ['item3', 'Trang bị'], ['item4', 'Vật phẩm 4'], ['item5', 'Vật phẩm 5'], ['item7', 'Vật phẩm 7'], ['fashiontemplate', 'Thời trang'], ['skills', 'Kỹ năng'], ['maps', 'Bản đồ'], ['pet', 'Thú cưng'] ]
const ready = ref(false), error = ref(''), busy = ref(false), table = ref('assets'), search = ref(''), category = ref('part_char'), zoom = ref('x1'), decoded = ref(true), page = ref(0)
const rows = ref([]), total = ref(0), selected = ref(null), draft = ref({}), drafts = ref({}), asset = ref(null), report = ref(null)
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
    const images = await Promise.all(snapshot.map(l => loadImage(l.asset)))
    if (id !== renderId) return
    paintLayers(ctx, resolvePose(snapshot, preview.value.direction, preview.value.pose, preview.value.breath ?? 0), images, 320, 240)
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
    const result = await exportPartLibrary(name, snapshot, draftSnapshot, message => { notice.value = message })
    notice.value = `Đã tải ${exportFileName(name).slice(0, 72)}-library.zip: ${result.parts} thư mục part ưu tiên x4 (PNG + metadata + atlas riêng), ${result.items} trang bị có ánh xạ. Hỗ trợ đứng/đi 4 hướng; chưa có vũ khí, pet, thú cưỡi và tấn công.${result.omitted ? ' Xem character.omittedLayers cho các lớp/vùng cắt không được giữ lại.' : ''}`
  } catch (e) { error.value = e.message; notice.value = '' }
  finally { busy.value = false }
}
async function exportCharacter() {
  busy.value = true; error.value = ''
  try { await exportAtlas(resolvePose(JSON.parse(JSON.stringify(layers.value)), preview.value.direction, preview.value.pose, preview.value.breath ?? 0), JSON.parse(JSON.stringify(drafts.value)), { ...preview.value }, exportName.value); notice.value = `Đã tải ${archiveName.value}.zip gồm PNG, atlas JSON, composition và mã mẫu Phaser. Bản xuất là tư thế đang xem.` }
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
</script>

<template>
  <div class="workbench">
    <GamePreview v-if="gameLayers" :layers="gameLayers" @close="gameLayers = null"/>
    <header><div class="brand"><span class="mark">H</span><div><strong>HSO STUDIO</strong><small>Asset workbench / Hiệp Sĩ Ong Đất</small></div></div><button :disabled="!ready || !layers.length || busy" @click="openGame">Chơi thử H5</button><span class="badge">CHỈNH NHÁP · KHÔNG LƯU NGUỒN</span><label class="export-name">Tên bản xuất<input v-model="exportName" aria-label="Tên bản xuất" :disabled="busy" maxlength="100" placeholder="character"><small>{{ archiveName }}.zip</small></label><button :disabled="!ready || busy" @click="exportDrafts">Xuất nháp ({{ draftCount }})</button><button :disabled="!ready || busy" @click="exportLibrary">Xuất thư viện part</button><button class="primary" :disabled="busy || !layers.length" @click="exportCharacter">{{ busy ? 'Đang đóng gói…' : 'Xuất cho Phaser ↗' }}</button></header>
    <p v-if="error" class="alert" role="alert">{{ error }} <button @click="error = ''">Đóng</button></p>
    <p v-if="notice" class="notice" role="status">{{ notice }} <button @click="notice = ''">Đóng</button></p>
    <div v-if="!ready" class="loading">{{ error ? 'Chưa thể mở catalog.' : 'Đang mở SQLite và lập chỉ mục tài nguyên…' }}</div>
    <template v-else>
      <div class="workspace">
        <aside class="sidebar"><p class="eyebrow">DỮ LIỆU GAME</p><nav aria-label="Danh mục"><button v-for="[key, label] in tables" :key="key" :class="{ active: table === key }" @click="changeTable(key)">{{ label }}<small>{{ key === 'assets' ? report.assets : report.tables[key] }}</small></button></nav><div class="source-info"><span class="dot"></span> SQLite · chỉ đọc<p>{{ report.decoded.toLocaleString() }} ảnh giải mã</p><p>{{ report.assets - report.decoded }} mục chưa giải mã</p><a :href="gameUrl('catalog.sqlite')" download>Tải catalog.sqlite ↓</a></div></aside>
        <main>
          <div class="section-heading"><div><p class="eyebrow">THƯ VIỆN / {{ table }}</p><h1>{{ title }}</h1></div><span>{{ total.toLocaleString() }} kết quả</span></div>
          <section class="composer"><div class="section-heading"><div><p class="eyebrow">CHARACTER LAB</p><h2>Nhân vật hoàn chỉnh</h2></div><label>Zoom <select v-model="scale"><option :value="1">1×</option><option :value="2">2×</option><option :value="3">3×</option><option :value="4">4×</option><option :value="6">6×</option><option :value="8">8×</option></select></label></div><div class="character-workspace"><CharacterPreset :layers="layers" @update="updateCharacter" @focus="activeLayer = $event"/><div class="character-preview"><div class="composer-actions"><span class="muted">Gốc tọa độ tại bàn chân. Có thể tinh chỉnh từng lớp trong Inspector.</span><button @click="clearCharacter">Xóa các lớp</button></div><div ref="stage" class="stage checker"><canvas ref="canvas" width="2560" height="1920" :style="{ width: `${640 * scale}px`, height: `${480 * scale}px` }" aria-label="Bản xem trước các lớp nhân vật"></canvas><span v-if="!layers.length" class="stage-empty">Thêm part từ thư viện để bắt đầu</span></div></div></div><CharacterAnimation :layers="layers" @update="preview = $event" @error="error = $event"/></section>
          <div class="filters"><input v-model="search" aria-label="Tìm theo tên hoặc ID" placeholder="Tìm tên, đường dẫn hoặc ID…"><template v-if="table === 'assets'"><select v-model="category" aria-label="Loại asset"><option value="">Mọi loại</option><option v-for="c in categories" :key="c">{{ c }}</option></select><select v-model="zoom" aria-label="Độ phân giải"><option value="">Mọi độ phân giải</option><option v-for="z in ['x1','x2','x3','x4']" :key="z">{{ z }}</option></select><label class="inline"><input v-model="decoded" type="checkbox"> Có ảnh</label></template></div>
          <div class="gallery"><button v-for="row in rows" :key="row.id" class="asset-card" :class="{ chosen: selected?.id === row.id }" @click="select(row)"><div class="thumbnail checker"><img v-if="imageAsset(row, table)?.image" :src="gameUrl(imageAsset(row, table).image)" alt="" loading="lazy"><span v-else>{{ table === 'mobs' ? 'MOB' : 'DATA' }}</span></div><strong :title="row.name || row.source">{{ row.name || row.source }}</strong><small>{{ table === 'assets' ? `${row.width} × ${row.height} · ${row.status}` : `#${row.id}${row.level != null ? ' · Lv.' + row.level : ''}` }}</small></button></div>
          <p v-if="!rows.length" class="empty">Không có kết quả phù hợp bộ lọc.</p>
          <div class="pagination"><button :disabled="page === 0" @click="page--">← Trước</button><span>{{ page + 1 }} / {{ Math.max(1, Math.ceil(total / pageSize)) }}</span><button :disabled="(page + 1) * pageSize >= total" @click="page++">Sau →</button></div>

        </main>
        <aside class="inspector"><p class="eyebrow">INSPECTOR</p><template v-if="selected"><h2>{{ draft.name || 'Chi tiết asset' }}</h2><p class="path">{{ selected.source || `ID ${selected.id}` }}</p><div v-if="asset" class="preview checker"><img :src="gameUrl(asset.image)" alt="Asset đang chọn"></div><a v-if="asset" class="asset-download" :href="gameUrl(asset.image)" :download="asset.image.split('/').pop()">Tải PNG: {{ asset.image.split('/').pop() }} ↓</a><p v-else class="muted">Chưa có ánh xạ ảnh cho mục này. Có thể tìm và chọn asset thủ công trong thư viện.</p><div class="actions"><button :disabled="!asset" @click="addLayer">+ Thêm lớp</button><button :disabled="!asset || !layer" @click="replaceLayer">Thay lớp chọn</button></div><template v-if="table !== 'assets'"><label v-for="field in fields" :key="field" class="field">{{ field }}<textarea v-if="String(draft[field] ?? '').length > 80" v-model="draft[field]" rows="3"></textarea><input v-else-if="typeof selected[field] === 'number'" v-model.number="draft[field]" type="number" :disabled="field === 'id'"><input v-else v-model="draft[field]" :disabled="field === 'id'"></label><div class="actions"><button class="primary" @click="applyDraft">Áp dụng nháp</button><button @click="resetDraft">Reset mục</button></div></template></template><p v-else class="muted">Chọn một asset, vật phẩm hoặc quái để xem thông tin.</p>
          <hr><div class="section-heading"><h2>Các lớp</h2><span>{{ layers.length }}</span></div><div v-for="(l, i) in layers" :key="i" class="layer-row" :class="{ active: activeLayer === i }"><button @click="activeLayer = i">{{ i + 1 }}. {{ l.name }}</button><button aria-label="Đưa lớp xuống" :disabled="i === 0" @click="moveLayer(i, -1)">↑</button><button aria-label="Đưa lớp lên" :disabled="i === layers.length - 1" @click="moveLayer(i, 1)">↓</button><button aria-label="Xóa lớp" @click="removeLayer(i)">×</button></div>
          <template v-if="layer"><label class="field">Tên lớp<input v-model="layer.name"></label><label class="inline"><input v-model="layer.visible" type="checkbox"> Hiển thị lớp</label><div class="field-grid"><label v-for="[key, label] in [['sx','Cắt X'],['sy','Cắt Y'],['w','Rộng'],['h','Cao'],['x','Vị trí X'],['y','Vị trí Y']]" :key="key" class="field">{{ label }}<input v-model.number="layer[key]" type="number" :step="key === 'x' || key === 'y' ? 0.5 : 1"></label></div><p v-if="!validCrop(layer)" class="invalid">Vùng cắt phải nằm trong ảnh và dùng số nguyên; vị trí phải là số hữu hạn. Part x4 dùng đơn vị x1.</p><p class="path">{{ layer.asset.source }}</p></template>
          <p class="muted footnote">Thay đổi chỉ tồn tại trong tab này. Xuất nháp trước khi tải lại trang. Atlas xuất giữ từng lớp riêng để Phaser có thể thay bộ phận.</p>
        </aside>
      </div>
    </template>
  </div>
</template>
