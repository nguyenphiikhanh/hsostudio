<script setup>
import {ref,computed} from 'vue'
import {gameUrl} from '../lib/catalog'
const props=defineProps({data:Object,tool:String,brush:Number,templateId:Number,count:Number,template:Object,templateReady:Boolean,assetLoading:Boolean,assetError:String,stats:Object,history:Object,active:Boolean,busy:Boolean,modified:Boolean,selectedObject:Object})
const emit=defineEmits(['tool','tile','template','undo','redo','duplicate','delete','reset','save','import','retry-asset'])
const search=ref('')
const templates=computed(()=>Object.values(props.data?.templates??{}).filter(t=>`${t.id} ${t.image}`.includes(search.value.trim())))
const tools=[['pan','Chọn / Pan'],['paint','Bút tile'],['erase','Tẩy tile'],['fill','Tô vùng'],['eyedrop','Hút tile'],['block','Thêm vùng chặn'],['unblock','Xóa vùng chặn'],['place','Đặt vật thể'],['move','Kéo vật thể']]
function tileStyle(id){const a=props.data.map.tileset.terrain;return id?{backgroundImage:`url("${gameUrl(a.image)}")`,backgroundSize:`${a.width/a.density*2}px ${a.height/a.density*2}px`,backgroundPosition:`0 -${(id-1)*48}px`}:{}}
</script>
<template>
 <section class="map-editor-panel" aria-label="Chỉnh sửa map">
  <div class="section-heading"><div><h2>Bản nháp map</h2><p v-if="data" class="map-size-summary">{{data.map.width}} × {{data.map.height}} ô · {{data.map.width*data.map.tileSize}} × {{data.map.height*data.map.tileSize}} đơn vị</p></div><span data-testid="map-draft-status">{{modified?'Đã sửa bản nháp · map gốc giữ nguyên':'Đang xem dữ liệu gốc'}}</span></div>
  <div class="map-edit-tools"><button v-for="[key,label] in tools" :key="key" :aria-pressed="tool===key" :class="{active:tool===key}" :disabled="!data||busy" @click="emit('tool',key)">{{label}}</button></div>
  <div class="map-edit-tools"><button :disabled="!data||busy||(!history.undo&&!active)" :title="history.undoLabel" @click="emit('undo')">Undo</button><button :disabled="!data||busy||!history.redo||active" :title="history.redoLabel" @click="emit('redo')">Redo</button><span class="muted">{{history.undo}} bước · {{history.redo}} làm lại · tối đa 100 bước/map</span><button :disabled="!selectedObject||busy" @click="emit('duplicate')">Nhân bản vật thể</button><button :disabled="!selectedObject||busy" @click="emit('delete')">Xóa vật thể</button><button :disabled="!modified||busy" @click="emit('reset')">Khôi phục map gốc</button></div>
  <div class="map-edit-tools"><button :disabled="!data||busy" @click="emit('save')">Tải nháp JSON</button><button :disabled="!data||busy" @click="emit('import')">Nhập nháp JSON</button><span v-if="stats" class="muted" data-testid="map-edit-count">Tile đổi: {{stats.tiles}} · Vùng chặn đổi: {{stats.collision}} ô · Vật thể thêm: {{stats.added}}, đổi: {{stats.changed}}, xóa: {{stats.removed}}{{stats.order?' · đổi thứ tự':''}}</span></div>
  <details class="map-edit-help"><summary>Cách dùng và lưu nháp</summary><p class="muted">Nháp giữ riêng theo từng map trong tab; tải lại trang sẽ mất nháp chưa tải JSON. Mỗi nét/kéo là một bước Undo. Xóa tile đặt ID0: ô trống và bị chặn theo client. Thêm vùng chặn ép ô thành chặn; Xóa vùng chặn ép ô thành đi được, kể cả tile/vật thể gốc. Nhân bản đặt cùng ô, sau đó dùng Kéo vật thể.</p></details>
  <template v-if="data">
   <details :open="['paint','fill','erase','eyedrop'].includes(tool)"><summary>Tileset #{{data.map.tileset.id}} · {{count}} tile · đang chọn #{{brush}}</summary>
    <div class="map-tile-palette" aria-label="Bảng tile"><button v-for="id in count+1" :key="id-1" class="map-tile-choice" :disabled="busy" :aria-label="`Chọn tile ${id-1}`" :aria-pressed="brush===id-1" :class="{active:brush===id-1}" @click="emit('tile',id-1)"><span class="map-tile-swatch checker" :style="tileStyle(id-1)"></span><small>#{{id-1}}{{id===1?' trống':''}}</small></button></div>
   </details>
   <details :open="['place','move'].includes(tool)"><summary>Vật thể gốc · template #{{templateId}}</summary>
    <div class="map-template-picker"><label class="field">Tìm template / PNG ID<input v-model="search" :disabled="busy" aria-label="Tìm template vật thể" placeholder="Template hoặc PNG ID"></label><label class="field">Template vật thể<select :value="templateId" :disabled="busy" aria-label="Template vật thể" @change="emit('template',Number($event.target.value))"><option v-if="template&&!templates.some(t=>t.id===templateId)" :value="templateId">Đang chọn #{{templateId}}</option><option v-for="t in templates" :key="t.id" :value="t.id" :disabled="!t.asset">#{{t.id}} · PNG #{{t.image}}{{!t.asset?' · chưa có ảnh':''}}</option></select></label></div>
    <div v-if="template?.asset" class="map-template-info"><img :src="gameUrl(template.asset.image)" alt="Mẫu vật thể gốc" :width="template.asset.width" :height="template.asset.height" class="checker"><div><p class="path">{{template.asset.source}}</p><p class="muted">Offset {{template.dx}}, {{template.dy}} · Ô chặn {{JSON.stringify(template.blocks)}}</p><p v-if="assetLoading" class="muted">Đang nạp PNG…</p><p v-else-if="templateReady" class="muted">Sẵn sàng đặt. Chọn Đặt vật thể rồi click ô neo trên map.</p><p v-if="assetError" class="invalid">{{assetError}} <button @click="emit('retry-asset')">Thử nạp PNG</button></p></div></div>
   </details>
  </template>
 </section>
</template>
