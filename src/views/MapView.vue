<script setup>
import {ref,computed} from 'vue'
import MapCanvas from '../components/MapCanvas.vue'
import MapInspector from '../components/MapInspector.vue'
import {useMapViewer} from '../composables/useMapViewer'
import {exportMapJSON,exportMapPNG,exportMapZIP} from '../lib/maps/mapExport'
const {index,query,selectedId,data,loading,error,selectedCell,selectedObject,hoverCell,layers,options,collision,reload}=useMapViewer()
const currentEntry=computed(()=>index.value?.maps.find(m=>String(m.id)===selectedId.value))
const busy=ref(false),notice=ref(''),density=ref(1)
function select(result){selectedCell.value=result.cell;selectedObject.value=result.object}
async function run(action){if(!data.value||busy.value)return;busy.value=true;error.value='';notice.value='';try{await action(data.value);notice.value='Đã xuất map đang chọn.'}catch(e){error.value=e.message}finally{busy.value=false}}
</script>
<template>
 <div class="map-page">
  <div class="section-heading"><div><p class="eyebrow">MAP · HSO 4.0.3 · VIEWER</p><h1>Bản đồ</h1></div><span v-if="index">{{index.readyCount}} layout · {{index.maps.length-index.readyCount}} mục chỉ có tên</span></div>
  <p class="muted">Nền/vật thể dùng PNG x4 và tọa độ nguồn. Bản này chỉ xem, chưa sửa tile hoặc ghi server. Nước, thác và background chưa phát hiệu ứng động.</p>
  <div class="map-picker"><label class="field">Tìm bản đồ<input v-model="query" aria-label="Tìm map theo tên hoặc ID" placeholder="Tên hoặc ID map…"></label><label class="field">Bản đồ HSO<select v-model="selectedId" aria-label="Bản đồ HSO" :disabled="!index||busy"><option v-if="currentEntry && !options.some(m=>String(m.id)===selectedId)" :value="selectedId">Đang xem: #{{currentEntry.id}} · {{currentEntry.name}}</option><option v-for="m in options" :key="m.id" :value="String(m.id)" :disabled="m.status!=='ready'">#{{m.id}} · {{m.name}} · {{m.status==='ready'?`${m.width}×${m.height} ô`:'chỉ có tên · thiếu layout'}}</option></select></label><span class="muted">{{options.length}} kết quả</span></div>
  <p v-if="error" class="alert" role="alert">{{error}} <button @click="reload">Thử tải lại</button></p><p v-if="notice" class="notice" role="status">{{notice}}</p>
  <div class="map-export-tools"><label class="field">PNG tổng quan<select v-model.number="density" aria-label="Độ phân giải PNG map"><option :value="1">x1 · logical</option><option :value="4">x4 · ảnh gốc</option></select></label><button :disabled="!data||loading||busy" title="PNG nền và vật thể gốc, không kèm lớp đánh dấu" @click="run(d=>exportMapPNG(d,density))">Tải PNG map</button><button :disabled="!data||loading||busy" @click="run(exportMapJSON)">Tải JSON map</button><button :disabled="!data||loading||busy" @click="run(exportMapZIP)">{{busy?'Đang xuất…':'Xuất map cho Phaser'}}</button></div>
  <div class="map-workspace">
   <section class="map-viewer" aria-label="Map viewport">
    <fieldset class="map-layer-controls"><legend>Lớp hiển thị</legend><label v-for="[key,label] in [['terrain','Nền'],['objects','Vật thể'],['grid','Lưới 24×24'],['collision','Vùng chặn'],['warps','Cổng chuyển map'],['spawns','Điểm spawn quái']]" :key="key" class="inline"><input v-model="layers[key]" type="checkbox" :aria-label="`Lớp map ${label}`">{{label}}</label></fieldset>
    <p v-if="loading" class="muted" role="status">Đang tải layout và ảnh map…</p>
    <MapCanvas :data="data" :layers="layers" :collision="collision" :selected-cell="selectedCell" :selected-object="selectedObject" @hover="hoverCell=$event" @select="select"/>
    <p class="map-coordinates" data-testid="map-coordinate">{{hoverCell?`World ${hoverCell.x}, ${hoverCell.y} · Ô ${hoverCell.col}, ${hoverCell.row} · Tile ${hoverCell.tile} · Collision ${hoverCell.type}`:'Trỏ vào map để xem tọa độ world/ô.'}}</p>
    <p class="muted">Overlay: đỏ = chặn, xanh = chậm (type2 client); xanh lá = cổng, cam = điểm spawn. Chưa gồm vùng chặn NPC/logic server; marker không phải sprite quái gốc. PNG tải về luôn gồm nền + vật thể, không kèm overlay.</p>
   </section>
   <MapInspector :data="data" :cell="selectedCell" :object="selectedObject"/>
  </div>
 </div>
</template>
