<script setup>
import {ref,shallowRef,computed,watch,onBeforeUnmount,onDeactivated} from 'vue'
import {readMapPNG,pngMapSize,buildPngMap,restorePngDraft} from '../lib/maps/mapPngImport.js'
import {loadMapReference} from '../lib/maps/mapData.js'
const props=defineProps({disabled:Boolean})
const emit=defineEmits(['import'])
const source=shallowRef(null),density=ref(4),pad=ref(false),crop=ref(false),name=ref(''),error=ref(''),busy=ref(false),canvas=ref(null)
const sizing=ref('auto'),cols=ref(1),rows=ref(1),mode=ref('original'),progress=ref(0),status=ref('')
let generation=0,controller
const settings=computed(()=>({density:density.value,pad:pad.value,crop:crop.value,...(sizing.value==='custom'?{cols:cols.value,rows:rows.value,mode:mode.value}:{})}))
const info=computed(()=>{if(!source.value)return null;try{return pngMapSize(source.value.width,source.value.height,density.value,pad.value,settings.value)}catch(e){return {error:e.message}}})
function draw(){
 const c=canvas.value,s=source.value,i=info.value;if(!c)return
 c.width=c.height=1
 if(!s||!i||i.error)return
 const scale=Math.min(1,900/i.paddedWidth,360/i.paddedHeight);c.width=Math.max(1,Math.ceil(i.paddedWidth*scale));c.height=Math.max(1,Math.ceil(i.paddedHeight*scale))
 const ctx=c.getContext('2d'),p=i.placement;ctx.imageSmoothingEnabled=false;ctx.drawImage(s.image,p.x*scale,p.y*scale,p.width*scale,p.height*scale)
 ctx.strokeStyle='#b9e581aa';ctx.lineWidth=1;ctx.beginPath()
 for(let x=0;x<=i.cols;x++){ctx.moveTo(x*i.size*scale,0);ctx.lineTo(x*i.size*scale,c.height)}
 for(let y=0;y<=i.rows;y++){ctx.moveTo(0,y*i.size*scale);ctx.lineTo(c.width,y*i.size*scale)}ctx.stroke()
}
watch([source,info,canvas],draw,{flush:'post'})
watch([source,density],()=>{if(source.value&&sizing.value==='auto'){cols.value=Math.min(127,Math.ceil(source.value.width/(24*density.value)));rows.value=Math.min(127,Math.ceil(source.value.height/(24*density.value)))}})
function cancel(){generation++;controller?.abort();controller=null;busy.value=false;status.value='Đã hủy xử lý; map đang mở giữ nguyên.';progress.value=0}
function begin(message){controller?.abort();controller=new AbortController();busy.value=true;error.value='';progress.value=0;status.value=message;return ++generation}
async function choose(event){
 const file=event.target.files?.[0];event.target.value='';if(!file)return
 const current=begin('Đang đọc preview thu nhỏ…')
 try{
  const next=await readMapPNG(file);if(current!==generation){next.image.close();return}
  source.value?.image.close();source.value=next;name.value=next.name
  status.value='Đã nạp preview; chọn kích thước map trước khi tạo.'
 }catch(e){if(current===generation)error.value=e.message}
 finally{if(current===generation)busy.value=false}
}
async function create(){
 if(busy.value||!info.value?.ready)return
 const current=begin('Đang chuẩn bị…'),signal=controller.signal,snapshot={...settings.value,name:name.value},input=source.value
 try{
  const reference=await loadMapReference();if(current!==generation)return
  const result=await buildPngMap(input,{...snapshot,signal,onProgress:data=>{if(current===generation){progress.value=data.percent;status.value=data.message}}},reference)
  if(current!==generation){for(const image of result.images.values())image.close?.();return}
  emit('import',result)
 }catch(e){if(current===generation&&e.name!=='AbortError')error.value=e.message}
 finally{if(current===generation)busy.value=false}
}
async function restore(event){
 const file=event.target.files?.[0];event.target.value='';if(!file)return
 const current=begin('Đang mở nháp PNG…')
 try{
  if(file.size>32*1024*1024)throw new Error('Nháp PNG tối đa 32 MB')
  const doc=JSON.parse(await file.text());if(current!==generation)return
  const result=await restorePngDraft(doc,await loadMapReference())
  if(current!==generation){for(const image of result.images.values())image.close?.();return}
  emit('import',result,doc);status.value='Đã mở nháp PNG.'
 }catch(e){if(current===generation)error.value=e.message}
 finally{if(current===generation)busy.value=false}
}
onDeactivated(()=>{if(busy.value)cancel()})
onBeforeUnmount(()=>{generation++;controller?.abort();source.value?.image.close()})
</script>
<template>
 <details class="map-png-import"><summary>Nhập PNG lớn → tạo map nháp</summary>
  <p class="muted">Ô 24 × 24 logical; chọn số ô ngang/dọc hoặc lấy kích thước theo ảnh. Preview dùng ảnh thu nhỏ; ảnh gốc được xử lý riêng khi tạo map.</p>
  <div class="map-png-fields"><label class="field">Ảnh nền PNG<input type="file" accept="image/png,.png" aria-label="Ảnh nền PNG" :disabled="busy||disabled" @change="choose"></label><label class="field">Tên map mới<input v-model="name" aria-label="Tên map PNG" maxlength="120" :disabled="busy||disabled"></label><label class="field">Mật độ ảnh<select v-model.number="density" aria-label="Mật độ PNG map" :disabled="busy||disabled"><option v-for="n in 4" :key="n" :value="n">x{{n}} · ô {{24*n}} × {{24*n}} px</option></select></label></div>
  <div class="map-png-fields"><label class="field">Kích thước map<select v-model="sizing" aria-label="Cách chọn kích thước map" :disabled="busy||disabled"><option value="auto">Theo kích thước ảnh</option><option value="custom">Tự chọn số ô</option></select></label><template v-if="sizing==='custom'"><label class="field">Số ô ngang<input v-model.number="cols" type="number" min="1" max="127" step="1" aria-label="Số ô ngang map PNG" :disabled="busy||disabled"></label><label class="field">Số ô dọc<input v-model.number="rows" type="number" min="1" max="127" step="1" aria-label="Số ô dọc map PNG" :disabled="busy||disabled"></label><label class="field">Đặt ảnh vào map<select v-model="mode" aria-label="Cách đặt PNG vào map" :disabled="busy||disabled"><option value="original">Giữ pixel gốc · góc trên trái</option><option value="contain">Vừa map · giữ tỷ lệ, căn giữa</option><option value="cover">Phủ kín map · giữ tỷ lệ, cắt mép</option></select></label></template></div>
  <template v-if="source"><p class="muted" data-testid="png-map-size">Ảnh {{source.width}} × {{source.height}} px<template v-if="info&&!info.error"> → {{info.cols}} × {{info.rows}} ô · {{info.cols*24}} × {{info.rows*24}} logical · canvas {{info.paddedWidth}} × {{info.paddedHeight}} px</template></p>
   <label class="inline"><input v-model="pad" type="checkbox" aria-label="Thêm viền trong suốt" :disabled="busy||disabled">Cho phép thêm vùng trong suốt khi ảnh chưa phủ hết map</label>
   <label v-if="info?.needsCrop" class="inline"><input v-model="crop" type="checkbox" aria-label="Cho phép cắt ảnh ngoài map" :disabled="busy||disabled">Cho phép cắt phần ảnh nằm ngoài map</label>
   <p v-if="info?.needsPadding" class="muted">{{pad?'Đã cho phép thêm vùng trong suốt.':'Bật thêm viền trong suốt để tiếp tục.'}}</p>
   <p v-if="info?.needsCrop" class="muted">{{crop?'Đã cho phép cắt mép ảnh.':'Map sẽ cắt một phần ảnh; cần cho phép trước khi tạo.'}}</p>
   <p v-if="info&&!info.error&&info.scale!==1" class="muted">Ảnh được đổi tỷ lệ ×{{info.scale.toFixed(3)}} theo chế độ đã chọn, giữ nguyên tỷ lệ ngang/dọc.</p>
   <p v-if="info?.error" class="invalid" role="alert">{{info.error}}</p>
   <canvas ref="canvas" class="map-png-preview checker" aria-label="Lưới cắt PNG map"></canvas>
  </template>
  <p v-if="error" class="invalid" role="alert">{{error}}</p>
  <div v-if="status" class="map-png-progress" role="status"><progress v-if="busy" :value="progress" max="100" aria-label="Tiến độ nhập PNG map"></progress><span>{{status}}<template v-if="busy"> {{progress}}%</template></span><button v-if="busy" @click="cancel">Hủy xử lý PNG</button></div>
  <div class="map-edit-tools"><button :disabled="busy||disabled||!info?.ready" @click="create">{{busy?'Đang xử lý…':'Tạo map nháp từ PNG'}}</button><label class="field">Mở lại nháp PNG đã tải<input type="file" accept="application/json,.json" aria-label="Mở nháp map PNG" :disabled="busy||disabled" @change="restore"></label></div>
  <p class="muted">Chỉ lưu trong tab. Tải nháp JSON để giữ atlas và chỉnh sửa; ZIP Phaser chứa ảnh và layout. Không tự nhận diện vật thể/collision/animation. Giới hạn 16 MB/PNG, 16 triệu pixel, 127 × 127 ô.</p>
 </details>
</template>
