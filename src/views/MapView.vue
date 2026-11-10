<script setup>
import {ref,computed,watch} from 'vue'
import MapEditorPanel from '../components/MapEditorPanel.vue'
import {useMapEditor} from '../composables/useMapEditor'
import {download,exportFileName} from '../lib/export'
import MapCanvas from '../components/MapCanvas.vue'
import MapInspector from '../components/MapInspector.vue'
import {useMapViewer} from '../composables/useMapViewer'
import {exportMapJSON,exportMapPNG,exportMapZIP} from '../lib/maps/mapExport'
const viewer=useMapViewer()
const {index,query,selectedId,loading,error,selectedCell,selectedObject,hoverCell,layers,options,reload}=viewer
const editor=useMapEditor(viewer.data,{selectedCell,selectedObject,hoverCell})
const {data,collision,tool,brush,templateId,template,templateReady,assetLoading,assetError,stats,modified,history,active,count}=editor
const animation=ref({water:false,waterfall:false})
const draftInput=ref(null)
const currentEntry=computed(()=>index.value?.maps.find(m=>String(m.id)===selectedId.value))
const busy=ref(false),notice=ref(''),density=ref(1),editError=ref('')
watch(selectedId,()=>{editError.value=''})
function select(result){selectedCell.value=result.cell;selectedObject.value=result.object}
function act(action){if(busy.value||!data.value)return;try{editError.value='';action()}catch(e){editor.cancel();editError.value=e.message}}
function setTool(value){act(()=>{editor.selectTool(value);if(['paint','erase','fill','eyedrop'].includes(value))layers.value.terrain=true;if(['block','unblock'].includes(value))layers.value.collision=true;if(['place','move'].includes(value))layers.value.objects=true})}
async function run(action){if(!data.value||busy.value)return;editor.end();busy.value=true;editError.value='';notice.value='';try{await action({...data.value,animation:{...animation.value}});notice.value='Đã xuất map đang chọn.'}catch(e){editError.value=e.message}finally{busy.value=false}}
function saveDraft(){return run(()=>{const doc=editor.draft();download(`${exportFileName(`map-${doc.base.mapId}-${data.value.map.name}`)}.map-draft.json`,new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}))})}
async function importDraft(event){
 const file=event.target.files?.[0];event.target.value=''
 if(!file||busy.value||!data.value)return
 const id=selectedId.value;editor.cancel();busy.value=true;editError.value='';notice.value=''
 try{if(file.size>8*1024*1024)throw new Error('File nháp vượt giới hạn 8 MB');const doc=JSON.parse(await file.text());if(id!==selectedId.value)throw new Error('Đã đổi map, hãy nhập lại nháp');await editor.importDraft(doc);notice.value='Đã nhập nháp thành một bước Undo; map gốc giữ nguyên.'}
 catch(e){editError.value=e.message}
 finally{busy.value=false}
}
</script>
<template>
 <div class="map-page">
  <div class="section-heading"><div><p class="eyebrow">MAP · HSO 4.0.3 · EDITOR</p><h1>Bản đồ</h1></div><span v-if="index">{{index.readyCount}} layout · {{index.maps.length-index.readyCount}} mục chỉ có tên</span></div>

  <div class="map-picker"><label class="field">Tìm bản đồ<input v-model="query" aria-label="Tìm map theo tên hoặc ID" placeholder="Tên hoặc ID map…"></label><label class="field">Bản đồ HSO<select v-model="selectedId" aria-label="Bản đồ HSO" :disabled="!index||busy"><option v-if="currentEntry && !options.some(m=>String(m.id)===selectedId)" :value="selectedId">Đang xem: #{{currentEntry.id}} · {{currentEntry.name}}</option><option v-for="m in options" :key="m.id" :value="String(m.id)" :disabled="m.status!=='ready'">#{{m.id}} · {{m.name}} · {{m.status==='ready'?`${m.width}×${m.height} ô`:'chỉ có tên · thiếu layout'}}</option></select></label><span class="muted">{{options.length}} kết quả</span></div>
  <p v-if="error" class="alert" role="alert">{{error}} <button @click="reload">Thử tải lại</button></p><p v-if="editError" class="alert" role="alert">{{editError}} <button @click="editError=''">Đóng</button></p><p v-if="notice" class="notice" role="status">{{notice}}</p>
  <MapEditorPanel :data="data" :tool="tool" :brush="brush" :template-id="templateId" :count="count" :template="template" :template-ready="templateReady" :asset-loading="assetLoading" :asset-error="assetError" :stats="stats" :history="history" :active="active" :busy="busy||loading" :modified="modified" :selected-object="selectedObject" @tool="setTool" @tile="act(()=>editor.chooseTile($event))" @template="templateId=$event" @undo="act(editor.undo)" @redo="act(editor.redo)" @duplicate="act(editor.duplicate)" @delete="act(editor.remove)" @reset="act(editor.reset)" @save="saveDraft" @import="draftInput.click()" @retry-asset="editor.ensureTemplate"/>
  <input ref="draftInput" type="file" accept="application/json,.json" aria-label="File nháp map" hidden @change="importDraft">
  <div class="map-export-tools"><label class="field">PNG tổng quan<select v-model.number="density" aria-label="Độ phân giải PNG map"><option :value="1">x1 · logical</option><option :value="4">x4 · ảnh gốc</option></select></label><button :disabled="!data||loading||busy" title="PNG nền và vật thể của layout đang xem, không kèm lớp đánh dấu" @click="run(d=>exportMapPNG(d,density))">Tải PNG map</button><button :disabled="!data||loading||busy" @click="run(exportMapJSON)">Tải JSON map</button><button :disabled="!data||loading||busy" @click="run(exportMapZIP)">{{busy?'Đang xuất…':'Xuất map cho Phaser'}}</button></div>
  <div class="map-workspace">
   <section class="map-viewer" aria-label="Map viewport">
    <fieldset class="map-layer-controls"><legend>Lớp hiển thị</legend><label v-for="[key,label] in [['terrain','Nền'],['objects','Vật thể'],['grid','Lưới 24×24'],['collision','Vùng chặn'],['warps','Cổng chuyển map'],['spawns','Điểm spawn quái']]" :key="key" class="inline"><input v-model="layers[key]" type="checkbox" :aria-label="`Lớp map ${label}`">{{label}}</label></fieldset>
    <fieldset class="map-layer-controls"><legend>Animation gốc HSO</legend><label class="inline"><input v-model="animation.water" type="checkbox" aria-label="Nước động">Nước động</label><label class="inline"><input v-model="animation.waterfall" type="checkbox" aria-label="Thác động">Thác động</label><span class="muted">Thác dùng PNG gốc x1; nước tileset 9/11/12 dùng fallback x1. Tắt để xem nền tĩnh.</span></fieldset>
    <p v-if="loading" class="muted" role="status">Đang tải layout và ảnh map…</p>
    <MapCanvas :data="data" :layers="layers" :animation="animation" :collision="collision" :selected-cell="selectedCell" :selected-object="selectedObject" @hover="hoverCell=$event" @select="select" :tool="tool" :editing-disabled="busy||loading||(tool==='place'&&!templateReady)" @edit-start="act(()=>editor.start($event))" @edit-move="act(()=>editor.move($event))" @edit-end="editor.end" @edit-cancel="editor.cancel" @undo="act(editor.undo)" @redo="act(editor.redo)" @delete-object="act(editor.remove)" @save-draft="saveDraft"/>
    <p class="map-coordinates" data-testid="map-coordinate">{{hoverCell?`World ${hoverCell.x}, ${hoverCell.y} · Ô ${hoverCell.col}, ${hoverCell.row} · Tile ${hoverCell.tile} · Collision ${hoverCell.type}`:'Trỏ vào map để xem tọa độ world/ô.'}}</p>
    <p class="muted">Overlay: đỏ = chặn, xanh = chậm (type2 client); xanh lá = cổng, cam = điểm spawn. Chưa gồm vùng chặn NPC/logic server; marker không phải sprite quái gốc. PNG tải về luôn gồm nền + vật thể, không kèm overlay.</p>
   </section>
   <MapInspector :data="data" :cell="selectedCell" :object="selectedObject"/>
  </div>
 </div>
</template>
