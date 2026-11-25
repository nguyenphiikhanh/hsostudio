<script setup>
import {computed,ref,watch,nextTick} from 'vue'
import {gameUrl} from '../lib/catalog'
import {objectPlacement,objectScale} from '../lib/maps/mapGeometry.js'
const props=defineProps({data:Object,cell:Object,object:Object,disabled:Boolean})
const emit=defineEmits(['scale','collision'])
const locked=ref(true),scaleX=ref(1),scaleY=ref(1)
function syncScale(){const s=props.object?objectScale(props.object):{scaleX:1,scaleY:1};scaleX.value=s.scaleX;scaleY.value=s.scaleY}
watch(()=>props.object?.index,()=>{locked.value=true;syncScale()})
watch(()=>[props.data,props.object?.scaleX,props.object?.scaleY],syncScale,{immediate:true})
function applyScale(axis){
 const current=objectScale(props.object),x=Number(scaleX.value),y=Number(scaleY.value)
 const next=axis==='x'?{scaleX:x,scaleY:locked.value?Number((current.scaleY*x/current.scaleX).toFixed(6)):y}:{scaleX:locked.value?Number((current.scaleX*y/current.scaleY).toFixed(6)):x,scaleY:y}
 emit('scale',next);nextTick(syncScale)
}
const template=computed(()=>props.object&&props.data?props.data.templates[props.object.templateId]:null)
const placement=computed(()=>template.value?objectPlacement(props.object,template.value,props.data.map.tileSize):null)
const spawns=computed(()=>props.cell&&props.data?props.data.map.spawns.filter(p=>Math.floor(p.x/24)===props.cell.col&&Math.floor(p.y/24)===props.cell.row):[])
</script>
<template>
 <aside class="map-inspector" aria-label="Chi tiết map">
  <p class="eyebrow">MAP INSPECTOR · LAYOUT ĐANG XEM</p>
  <template v-if="data">
   <h2>{{data.map.tileset.kind==='imported-png'?'PNG':'#'+data.map.id}} · {{data.map.name}}</h2>
   <dl><dt>Kích thước</dt><dd>{{data.map.width}} × {{data.map.height}} ô</dd><dt>Thế giới</dt><dd>{{data.map.width*data.map.tileSize}} × {{data.map.height*data.map.tileSize}} đơn vị</dd><dt>Tileset</dt><dd>#{{data.map.tileset.id}} · PNG x{{data.map.tileset.terrain.density}}{{data.map.tileset.kind==='imported-png'?' · nhập PNG':''}}</dd><dt>Vật thể tĩnh</dt><dd>{{data.map.objects.length}}</dd><dt>Điểm spawn quái</dt><dd>{{data.map.spawns.length}}</dd><dt>Cổng chuyển map</dt><dd>{{data.map.warps.length}}</dd><dt>NPC tham chiếu</dt><dd>{{data.map.npcReferences.length}} · chưa đặt marker</dd></dl>
   <p class="path">Gốc: {{data.map.source.path}}</p><p v-if="data.editInfo?.modified" class="muted">Đây là bản nháp Studio. Checksum bên dưới tham chiếu nguồn ban đầu, không phải layout đã sửa.</p>
   <template v-if="cell"><hr><h2>Ô {{cell.col}}, {{cell.row}}</h2><dl><dt>Tile ID</dt><dd>{{cell.tile}}</dd><dt>World X / Y</dt><dd>{{cell.x}} / {{cell.y}}</dd><dt>Loại nền</dt><dd>{{cell.terrainType}}</dd><dt>Collision tổng</dt><dd>{{cell.type}} · {{['Bình thường','Chặn','Chậm'][cell.type]}}</dd></dl></template>
   <template v-if="template"><hr><h2>Vật thể #{{object.index}}</h2><dl><dt>Template / PNG</dt><dd>{{template.id}} / {{template.image}}</dd><dt>Ô neo</dt><dd>{{object.cellX}}, {{object.cellY}}</dd><dt>Offset X / Y</dt><dd>{{template.dx}}, {{template.dy}}</dd><dt>Vị trí ảnh</dt><dd>{{placement.x}}, {{placement.y}}</dd><dt>Kích thước ảnh logical</dt><dd>{{placement.width}} × {{placement.height}}</dd><dt>Ô chặn tương đối</dt><dd>{{JSON.stringify(template.blocks)}}</dd></dl><fieldset class="map-object-scale"><legend>Kích thước vật thể</legend><label class="inline"><input v-model="locked" type="checkbox" aria-label="Khóa tỷ lệ vật thể" :disabled="disabled">Khóa tỷ lệ</label><label class="field">Scale X<input v-model.number="scaleX" type="number" min="0.1" max="8" step="0.1" aria-label="Scale X vật thể" :disabled="disabled" @change="applyScale('x')" @keydown.enter="$event.target.blur()"></label><label class="field">Scale Y<input v-model.number="scaleY" type="number" min="0.1" max="8" step="0.1" aria-label="Scale Y vật thể" :disabled="disabled" @change="applyScale('y')" @keydown.enter="$event.target.blur()"></label><button :disabled="disabled" @click="emit('scale',{scaleX:1,scaleY:1})">Kích thước gốc ×1</button><p class="muted">Giữ ô neo; scale 0.1–8. Vùng chặn không tự đổi theo ảnh.</p><button :disabled="disabled" @click="emit('collision')">Chỉnh vùng chặn trên map</button></fieldset><img class="map-object-preview checker" :src="gameUrl(template.asset.image)" alt="PNG vật thể gốc"><a :href="gameUrl(template.asset.image)" :download="`${template.image}.png`">Tải PNG vật thể x4</a><p class="path">{{template.asset.source}}</p></template>
   <p v-for="spawn in spawns" :key="spawn.index" class="muted">Spawn #{{spawn.index}} · {{spawn.name}} (mob #{{spawn.mobId}}) · {{spawn.x}}, {{spawn.y}}</p>
   <details><summary>Cổng chuyển map</summary><p v-for="(gate,i) in data.map.warps" :key="i" class="muted">{{gate.name}} · {{gate.x}}, {{gate.y}}<br>{{gate.destination ? `Đích #${gate.destination.mapId}: ${gate.destination.x}, ${gate.destination.y}` : 'Đích chưa khớp cấu hình; không tự suy ra.'}}</p></details>
   <details><summary>Nguồn và giới hạn</summary><p v-for="note in data.map.limitations" :key="note" class="muted">{{note}}</p><p class="path">SHA256: {{data.map.source.sha256}}</p><p class="muted">Vật thể và collision dùng bảng server msg_1, không dùng table_item mặc định của JAR.</p></details>
  </template>
  <p v-else class="muted">Chọn một map có layout để xem. Không tạo bản đồ thay thế cho mục chỉ có tên.</p>
 </aside>
</template>
