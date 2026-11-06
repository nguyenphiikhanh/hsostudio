<script setup>
import {computed} from 'vue'
import {gameUrl} from '../lib/catalog'
import {objectPlacement} from '../lib/maps/mapGeometry.js'
const props=defineProps({data:Object,cell:Object,object:Object})
const template=computed(()=>props.object&&props.data?props.data.templates[props.object.templateId]:null)
const placement=computed(()=>template.value?objectPlacement(props.object,template.value,props.data.map.tileSize):null)
const spawns=computed(()=>props.cell&&props.data?props.data.map.spawns.filter(p=>Math.floor(p.x/24)===props.cell.col&&Math.floor(p.y/24)===props.cell.row):[])
</script>
<template>
 <aside class="map-inspector" aria-label="Chi tiết map">
  <p class="eyebrow">MAP INSPECTOR · LAYOUT ĐANG XEM</p>
  <template v-if="data">
   <h2>#{{data.map.id}} · {{data.map.name}}</h2>
   <dl><dt>Kích thước</dt><dd>{{data.map.width}} × {{data.map.height}} ô</dd><dt>Thế giới</dt><dd>{{data.map.width*24}} × {{data.map.height*24}} đơn vị</dd><dt>Tileset</dt><dd>#{{data.map.tileset.id}} · PNG x4</dd><dt>Vật thể tĩnh</dt><dd>{{data.map.objects.length}}</dd><dt>Điểm spawn quái</dt><dd>{{data.map.spawns.length}}</dd><dt>Cổng chuyển map</dt><dd>{{data.map.warps.length}}</dd><dt>NPC tham chiếu</dt><dd>{{data.map.npcReferences.length}} · chưa đặt marker</dd></dl>
   <p class="path">Gốc: {{data.map.source.path}}</p><p v-if="data.editInfo?.modified" class="muted">Đây là bản nháp Studio. Checksum/raw bên dưới là nguồn gốc tham chiếu, không phải layout đã sửa.</p>
   <template v-if="cell"><hr><h2>Ô {{cell.col}}, {{cell.row}}</h2><dl><dt>Tile ID</dt><dd>{{cell.tile}}</dd><dt>World X / Y</dt><dd>{{cell.x}} / {{cell.y}}</dd><dt>Loại nền</dt><dd>{{cell.terrainType}}</dd><dt>Collision tổng</dt><dd>{{cell.type}} · {{['Bình thường','Chặn','Chậm'][cell.type]}}</dd></dl></template>
   <template v-if="template"><hr><h2>Vật thể #{{object.index}}</h2><dl><dt>Template / PNG</dt><dd>{{template.id}} / {{template.image}}</dd><dt>Ô neo</dt><dd>{{object.cellX}}, {{object.cellY}}</dd><dt>Offset X / Y</dt><dd>{{template.dx}}, {{template.dy}}</dd><dt>Vị trí ảnh</dt><dd>{{placement.x}}, {{placement.y}}</dd><dt>Ô chặn tương đối</dt><dd>{{JSON.stringify(template.blocks)}}</dd></dl><img class="map-object-preview checker" :src="gameUrl(template.asset.image)" alt="PNG vật thể gốc"><a :href="gameUrl(template.asset.image)" :download="`${template.image}.png`">Tải PNG vật thể x4</a><p class="path">{{template.asset.source}}</p></template>
   <p v-for="spawn in spawns" :key="spawn.index" class="muted">Spawn #{{spawn.index}} · {{spawn.name}} (mob #{{spawn.mobId}}) · {{spawn.x}}, {{spawn.y}}</p>
   <details><summary>Cổng chuyển map</summary><p v-for="(gate,i) in data.map.warps" :key="i" class="muted">{{gate.name}} · {{gate.x}}, {{gate.y}}<br>{{gate.destination ? `Đích #${gate.destination.mapId}: ${gate.destination.x}, ${gate.destination.y}` : 'Đích chưa khớp cấu hình; không tự suy ra.'}}</p></details>
   <details><summary>Nguồn và giới hạn</summary><p v-for="note in data.map.limitations" :key="note" class="muted">{{note}}</p><p class="path">SHA256: {{data.map.source.sha256}}</p><p class="muted">Vật thể và collision dùng bảng server msg_1, không dùng table_item mặc định của JAR.</p></details>
  </template>
  <p v-else class="muted">Chọn một map có layout để xem. Không tạo bản đồ thay thế cho mục chỉ có tên.</p>
 </aside>
</template>
