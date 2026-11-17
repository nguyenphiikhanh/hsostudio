<script setup>
import {computed,ref,watch,onUnmounted,onDeactivated,onActivated} from 'vue'
import {DIRECTIONS,paintLayers} from '../lib/characterPose'
import {frameAssetGroups,frameBounds} from '../lib/frameAssets'
import {loadImage} from '../lib/export'
const props=defineProps({layers:Array,effect:Object,direction:String,tick:Number,cycleLength:Number,fps:Number,motion:String,playing:Boolean})
const emit=defineEmits(['frame','direction','play','close'])
const groups=computed(()=>frameAssetGroups(props.layers,props.effect))
const character=ref(null),sheets=new Map(),error=ref(''),rendered=ref(null),fullSize=ref(false)
let version=0,active=true
const colors=['#ff3d86','#00c8ff','#ffb600','#54ed83','#d88cff','#ff7254']
async function draw(){
 if(!active)return
 const current=++version,layers=props.layers.map(l=>({...l})),effect=props.effect,details=groups.value,stamp={tick:props.tick,direction:props.direction}
 try{
  const [images,effects]=await Promise.all([Promise.all(layers.map(l=>loadImage(l.asset))),Promise.all((effect?.scene.sprites??[]).map(s=>loadImage(s.asset)))])
  if(current!==version||!active)return
  if(details.invalid.length)throw new Error('Có vùng cắt không hợp lệ; không thể đối chiếu frame này.')
  const bounds=frameBounds(layers,effect),canvas=character.value
  if(!canvas)return
  if(bounds.width*bounds.height*16>16000000)throw new Error('Frame vượt giới hạn preview 16 triệu pixel')
  canvas.width=bounds.width*4;canvas.height=bounds.height*4
  const ctx=canvas.getContext('2d');ctx.scale(4,4);ctx.imageSmoothingEnabled=false
  paintLayers(ctx,layers,images,bounds.x,bounds.y)
  if(effect)effect.paint(ctx,effect.scene,effects,bounds.x,bounds.y)
  for(const group of details.groups){
   const c=sheets.get(group.asset.image);if(!c)continue
   if(group.asset.width*group.asset.height>16000000)throw new Error('Sheet vượt giới hạn preview 16 triệu pixel')
   const image=await loadImage(group.asset)
   if(current!==version||!active)return
   if(image.naturalWidth!==group.asset.width||image.naturalHeight!==group.asset.height)throw new Error('Kích thước sheet không khớp metadata')
   c.width=image.naturalWidth;c.height=image.naturalHeight
   const context=c.getContext('2d');context.imageSmoothingEnabled=false;context.drawImage(image,0,0)
   const marks=new Map()
   for(const e of group.entries){const key=JSON.stringify(e.rectPx);if(!marks.has(key))marks.set(key,{...e,numbers:[]});marks.get(key).numbers.push(e.number)}
   for(const entry of marks.values()){const r=entry.rectPx,color=colors[(entry.number-1)%colors.length],line=Math.min(2,r.width/4,r.height/4)
    context.strokeStyle=color;context.lineWidth=line;context.strokeRect(r.x+line/2,r.y+line/2,r.width-line,r.height-line)
    const font=Math.max(3,Math.min(c.height-3,16,Math.round(10*(group.asset.density||1)/2)))
    context.font=`bold ${font}px monospace`;context.fillStyle='#131619';context.fillRect(r.x,r.y,context.measureText(entry.numbers.join('/')).width+4,font+3)
    context.fillStyle=color;context.fillText(entry.numbers.join('/'),r.x+2,r.y+font)
   }
  }
  if(current===version){rendered.value=stamp;error.value=''}
 }catch(e){if(current===version){error.value=e.message;rendered.value=null;if(character.value)character.value.width=character.value.width;for(const c of sheets.values())c.width=c.width}}
}
watch([()=>props.layers,()=>props.effect,()=>props.tick,()=>props.direction,character],draw,{deep:true,flush:'post',immediate:true})
onActivated(()=>{active=true;draw()})
onDeactivated(()=>{active=false;version++})
onUnmounted(()=>{active=false;version++})
</script>
<template>
 <section class="frame-asset-inspector" aria-label="Soi asset theo frame" :data-rendered-frame="rendered?.tick" :data-rendered-direction="rendered?.direction">
  <div class="section-heading"><h2>Soi asset theo frame</h2><button @click="emit('close')">Đóng soi asset</button></div>
  <div class="frame-inspector-controls"><label class="field">Hướng<select :value="direction" aria-label="Hướng soi asset" @change="emit('direction',$event.target.value)"><option v-for="d in DIRECTIONS" :key="d.key" :value="d.key">{{d.label}}</option></select></label><label class="field">Frame {{tick+1}} / {{cycleLength}}<input type="range" min="0" :max="cycleLength-1" :value="tick" step="1" aria-label="Frame soi asset" @input="emit('frame',Number($event.target.value))"></label><button :disabled="tick<=0" @click="emit('frame',tick-1)">Frame trước</button><button @click="emit('play')">{{playing?'Dừng soi frame':'Phát khi soi frame'}}</button><button @click="emit('frame',(tick+1)%cycleLength)">Frame sau</button></div>
  <p class="muted">{{motion}} · {{fps}} FPS · {{Math.round(tick*1000/fps)}} ms. Khung màu đánh dấu vùng cắt trên bản sao sheet; số khung khớp chú giải. Tọa độ ghép dùng đơn vị x1.</p>
  <p v-if="error" role="alert" class="invalid">{{error}}</p>
  <div class="frame-assembled"><h3>Hình ghép của frame</h3><canvas ref="character" class="checker" aria-label="Nhân vật ghép theo frame"></canvas></div>
  <p v-if="effect?.scene.lines?.length" class="muted">Frame có {{effect.scene.lines.length}} nét vẽ bằng code từ preview, không có sheet PNG tương ứng; đây không phải asset ảnh gốc.</p>
  <label class="inline"><input v-model="fullSize" type="checkbox" aria-label="Sheet đúng kích thước pixel">Xem sheet đúng kích thước pixel (cuộn nếu lớn)</label>
  <div class="frame-source-sheets"><article v-for="(group,index) in groups.groups" :key="group.asset.image" class="frame-source-sheet"><h3>Sheet {{index+1}} · {{group.asset.width}} × {{group.asset.height}} px · x{{group.asset.density||1}}</h3><p class="path">{{group.asset.source||group.asset.image}}</p><div class="frame-sheet-scroll"><canvas :ref="el=>el?sheets.set(group.asset.image,el):sheets.delete(group.asset.image)" :class="['checker',{ 'frame-sheet-native':fullSize }]" :aria-label="`Sheet asset ${index+1} có đánh dấu`" :data-crops="JSON.stringify(group.entries.map(e=>e.rectPx))"></canvas></div><ol><li v-for="entry in group.entries" :key="entry.number" :value="entry.number" :style="{'--frame-marker':colors[(entry.number-1)%colors.length]}"><strong>{{entry.name}}</strong><span>{{entry.slot}}{{entry.partId!==null?' #'+entry.partId:''}} · crop px: {{entry.rectPx.x}}, {{entry.rectPx.y}}, {{entry.rectPx.width}} × {{entry.rectPx.height}}</span><span>Crop logical: {{entry.logical.x}}, {{entry.logical.y}}, {{entry.logical.width}} × {{entry.logical.height}}</span><span>Ghép: {{entry.placement.x}}, {{entry.placement.y}} · {{entry.placement.width}} × {{entry.placement.height}} logical · lớp {{entry.depth}} · {{entry.flipX?'lật ngang':'không lật'}}<template v-if="entry.kind==='effect'"> · transform {{entry.transform}}</template></span></li></ol></article></div>
  <details v-if="groups.hidden.length"><summary>{{groups.hidden.length}} lớp không vẽ trong frame này</summary><p v-for="entry in groups.hidden" :key="entry.number" class="muted">{{entry.name}} · {{entry.slot}}</p></details>
  <p v-if="!groups.groups.length" class="muted">Frame không có asset đang hiển thị.</p>
 </section>
</template>
