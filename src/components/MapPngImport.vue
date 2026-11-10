<script setup>
import {ref,shallowRef,computed,watch,onBeforeUnmount} from 'vue'
import {readMapPNG,pngMapSize,buildPngMap,restorePngDraft} from '../lib/maps/mapPngImport.js'
import {loadMap} from '../lib/maps/mapData.js'
const props=defineProps({disabled:Boolean})
const emit=defineEmits(['import'])
const source=shallowRef(null),density=ref(4),pad=ref(false),name=ref(''),error=ref(''),busy=ref(false),canvas=ref(null)
let generation=0
const info=computed(()=>{if(!source.value)return null;try{return pngMapSize(source.value.width,source.value.height,density.value,pad.value)}catch(e){return {error:e.message}}})
function draw(){
 const c=canvas.value,s=source.value,i=info.value;if(!c||!s||!i||i.error)return
 const scale=Math.min(1,900/i.paddedWidth,360/i.paddedHeight);c.width=Math.ceil(i.paddedWidth*scale);c.height=Math.ceil(i.paddedHeight*scale)
 const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(s.image,0,0,s.width*scale,s.height*scale)
 ctx.strokeStyle='#b9e581aa';ctx.lineWidth=1;ctx.beginPath()
 for(let x=0;x<=i.cols;x++){ctx.moveTo(x*i.size*scale,0);ctx.lineTo(x*i.size*scale,c.height)}
 for(let y=0;y<=i.rows;y++){ctx.moveTo(0,y*i.size*scale);ctx.lineTo(c.width,y*i.size*scale)}ctx.stroke()
}
watch([source,density,pad,canvas],draw,{flush:'post'})
async function choose(event){
 const file=event.target.files?.[0];event.target.value='';if(!file)return
 const current=++generation;busy.value=true;error.value=''
 try{const next=await readMapPNG(file);if(current!==generation){next.image.close();return}source.value?.image.close();source.value=next;name.value=next.name}
 catch(e){error.value=e.message}
 finally{if(current===generation)busy.value=false}
}
async function create(){
 if(busy.value||!info.value?.ready)return
 busy.value=true;error.value=''
 try{const reference=await loadMap(0);const result=await buildPngMap(source.value,{density:density.value,pad:pad.value,name:name.value},reference);emit('import',result)}
 catch(e){error.value=e.message}finally{busy.value=false}
}
async function restore(event){
 const file=event.target.files?.[0];event.target.value='';if(!file)return
 busy.value=true;error.value=''
 try{if(file.size>32*1024*1024)throw new Error('Nháp PNG tối đa 32 MB');const doc=JSON.parse(await file.text());const result=await restorePngDraft(doc,await loadMap(0));emit('import',result,doc)}
 catch(e){error.value=e.message}finally{busy.value=false}
}
onBeforeUnmount(()=>{generation++;source.value?.image.close()})
</script>
<template>
 <details class="map-png-import"><summary>Nhập PNG lớn → tạo map nháp</summary>
  <p class="muted">Cắt theo ô 24 × 24 logical, gộp các ô có pixel giống hệt. Không tự nhận diện vật thể, vùng chặn hoặc animation.</p>
  <div class="map-png-fields"><label class="field">Ảnh nền PNG<input type="file" accept="image/png,.png" aria-label="Ảnh nền PNG" :disabled="busy||disabled" @change="choose"></label><label class="field">Tên map mới<input v-model="name" aria-label="Tên map PNG" maxlength="120" :disabled="busy||disabled"></label><label class="field">Mật độ ảnh<select v-model.number="density" aria-label="Mật độ PNG map" :disabled="busy||disabled"><option v-for="n in 4" :key="n" :value="n">x{{n}} · ô {{24*n}} × {{24*n}} px</option></select></label></div>
  <template v-if="source"><p class="muted" data-testid="png-map-size">Ảnh {{source.width}} × {{source.height}} px<template v-if="info&&!info.error"> → {{info.cols}} × {{info.rows}} ô · {{info.cols*24}} × {{info.rows*24}} logical</template></p>
   <label class="inline"><input v-model="pad" type="checkbox" aria-label="Thêm viền trong suốt" :disabled="busy||disabled">Cho phép thêm viền trong suốt bên phải/dưới, không co kéo ảnh</label>
   <p v-if="info?.needsPadding" class="muted">Cần canvas {{info.paddedWidth}} × {{info.paddedHeight}} px. {{pad?'Đã cho phép thêm viền.':'Bật thêm viền để tiếp tục.'}}</p>
   <p v-if="info?.error" class="invalid" role="alert">{{info.error}}</p>
   <canvas ref="canvas" class="map-png-preview checker" aria-label="Lưới cắt PNG map"></canvas>
  </template>
  <p v-if="error" class="invalid" role="alert">{{error}}</p>
  <div class="map-edit-tools"><button :disabled="busy||disabled||!info?.ready" @click="create">{{busy?'Đang xử lý…':'Tạo map nháp từ PNG'}}</button><label class="field">Mở lại nháp PNG đã tải<input type="file" accept="application/json,.json" aria-label="Mở nháp map PNG" :disabled="busy||disabled" @change="restore"></label></div>
  <p class="muted">Chỉ lưu trong tab. Dùng Tải nháp JSON để giữ cả atlas và chỉnh sửa; ZIP Phaser chứa ảnh cùng layout để đưa sang game. Giới hạn 16 MB/PNG, 16 triệu pixel, 127 × 127 ô.</p>
 </details>
</template>
