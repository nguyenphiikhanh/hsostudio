<script setup>
import {ref,watch,onMounted,onUnmounted,onActivated,onDeactivated} from 'vue'
import {drawMap} from '../lib/maps/mapCanvas.js'
import {cellAt,hitObject,objectPlacement} from '../lib/maps/mapGeometry.js'
const props=defineProps({data:Object,layers:Object,collision:Array,selectedCell:Object,selectedObject:Object})
const emit=defineEmits(['hover','select'])
const canvas=ref(null),zoom=ref(1),pan=ref({x:0,y:0})
let width=0,height=0,observer,frame=0,active=true,fitPending=true,drag=null
function schedule(){if(!active||frame)return;frame=requestAnimationFrame(()=>{frame=0;draw()})}
function fit(){
 if(!props.data||!width||!height)return
 const m=props.data.map;zoom.value=Math.max(.1,Math.min(4,(width-24)/(m.width*m.tileSize),(height-24)/(m.height*m.tileSize)))
 pan.value={x:(width-m.width*m.tileSize*zoom.value)/2,y:(height-m.height*m.tileSize*zoom.value)/2};fitPending=false;schedule()
}
function resize(){const rect=canvas.value?.getBoundingClientRect();if(!rect?.width||!rect.height)return;const changed=width!==rect.width||height!==rect.height;width=rect.width;height=rect.height;if(changed||fitPending)fit();schedule()}
function draw(){
 if(!canvas.value)return
 const ratio=Math.min(devicePixelRatio||1,2),ctx=canvas.value.getContext('2d')
 canvas.value.width=Math.round(width*ratio);canvas.value.height=Math.round(height*ratio)
 ctx.setTransform(ratio,0,0,ratio,0,0);ctx.fillStyle='#17191b';ctx.fillRect(0,0,width,height)
 if(!props.data){canvas.value.dataset.renderedMapId='';return}
 const {map,templates,images}=props.data,s=map.tileSize
 ctx.save();ctx.translate(pan.value.x,pan.value.y);ctx.scale(zoom.value,zoom.value)
 drawMap(ctx,map,templates,images,props.layers)
 ctx.save();ctx.beginPath();ctx.rect(0,0,map.width*s,map.height*s);ctx.clip()
 if(props.layers.collision){for(let i=0;i<props.collision.length;i++)if(props.collision[i]){ctx.fillStyle=props.collision[i]===1?'#ff655b66':'#54b8ef66';ctx.fillRect(i%map.width*s,Math.floor(i/map.width)*s,s,s)}}
 if(props.layers.grid){ctx.strokeStyle='#dbead84d';ctx.lineWidth=1/zoom.value;ctx.beginPath();for(let x=0;x<=map.width;x++){ctx.moveTo(x*s,0);ctx.lineTo(x*s,map.height*s)}for(let y=0;y<=map.height;y++){ctx.moveTo(0,y*s);ctx.lineTo(map.width*s,y*s)}ctx.stroke()}
 const marker=(point,color,label)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(point.x,point.y,5/zoom.value,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#17191b';ctx.lineWidth=1/zoom.value;ctx.stroke();if(label){ctx.font=`${11/zoom.value}px system-ui`;ctx.fillText(label,point.x+8/zoom.value,point.y-7/zoom.value)}}
 if(props.layers.warps)for(const p of map.warps)marker(p,'#b9e581',p.name)
 if(props.layers.spawns)for(const p of map.spawns)marker(p,'#efb45f',null)
 if(props.selectedCell){ctx.strokeStyle='#e8ece5';ctx.lineWidth=2/zoom.value;ctx.strokeRect(props.selectedCell.col*s,props.selectedCell.row*s,s,s)}
 if(props.layers.objects&&props.selectedObject){const p=objectPlacement(props.selectedObject,templates[props.selectedObject.templateId],s);ctx.strokeStyle='#eeb0f2';ctx.lineWidth=2/zoom.value;ctx.strokeRect(p.x,p.y,p.width,p.height)}
 ctx.restore();ctx.restore()
 canvas.value.dataset.renderedMapId=String(map.id)
}
function point(event){const rect=canvas.value.getBoundingClientRect();return{x:event.clientX-rect.left,y:event.clientY-rect.top}}
function world(p){return{x:(p.x-pan.value.x)/zoom.value,y:(p.y-pan.value.y)/zoom.value}}
function zoomAt(factor,p={x:width/2,y:height/2}){const w=world(p),next=Math.max(.1,Math.min(8,zoom.value*factor));zoom.value=next;pan.value={x:p.x-w.x*next,y:p.y-w.y*next};schedule()}
function down(event){if(!props.data||![0,1].includes(event.button))return;const p=point(event);drag={start:p,last:p,moved:false};canvas.value.focus({preventScroll:true});canvas.value.setPointerCapture(event.pointerId)}
function move(event){
 const p=point(event)
 if(drag){if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>4)drag.moved=true;if(drag.moved){pan.value={x:pan.value.x+p.x-drag.last.x,y:pan.value.y+p.y-drag.last.y};schedule()}drag.last=p}
 const w=world(p);emit('hover',props.data?cellAt(props.data.map,props.collision,w.x,w.y):null)
}
function up(event){
 if(!drag)return
 if(!drag.moved&&props.data){const w=world(point(event));emit('select',{cell:cellAt(props.data.map,props.collision,w.x,w.y),object:props.layers.objects?hitObject(props.data.map,props.data.templates,w.x,w.y):null})}
 drag=null;if(canvas.value.hasPointerCapture(event.pointerId))canvas.value.releasePointerCapture(event.pointerId)
}
function key(event){
 if(event.key==='0'){event.preventDefault();fit()}
 else if(['+','=','-'].includes(event.key)){event.preventDefault();zoomAt(event.key === '-' ? .8 : 1.25)}
 else {const step=24*zoom.value,delta={ArrowLeft:[step,0],ArrowRight:[-step,0],ArrowUp:[0,step],ArrowDown:[0,-step]}[event.key];if(delta){event.preventDefault();pan.value={x:pan.value.x+delta[0],y:pan.value.y+delta[1]};schedule()}}
}
watch(()=>props.data,()=>{fitPending=true;if(props.data)fit();schedule()})
watch([()=>props.layers,()=>props.selectedCell,()=>props.selectedObject],schedule,{deep:true})
onMounted(()=>{observer=new ResizeObserver(resize);observer.observe(canvas.value);resize()})
onActivated(()=>{active=true;resize()})
onDeactivated(()=>{active=false;cancelAnimationFrame(frame);frame=0;drag=null})
onUnmounted(()=>{observer?.disconnect();cancelAnimationFrame(frame)})
</script>
<template>
 <div class="map-canvas-panel">
  <div class="map-camera-tools"><button :disabled="!data" @click="zoomAt(.8)" aria-label="Thu nhỏ map">−</button><span data-testid="map-zoom">{{Math.round(zoom*100)}}%</span><button :disabled="!data" @click="zoomAt(1.25)" aria-label="Phóng to map">+</button><button :disabled="!data" @click="fit">Vừa khung</button></div>
  <div class="map-canvas-shell"><canvas ref="canvas" aria-label="Khung xem bản đồ" role="img" tabindex="0" aria-describedby="map-pan-help" :data-map-id="data?.map.id ?? ''" :data-zoom="zoom" :data-pan-x="pan.x" :data-pan-y="pan.y" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="drag=null" @pointerleave="!drag && emit('hover',null)" @wheel.prevent="zoomAt($event.deltaY<0?1.15:1/1.15,point($event))" @keydown="key"></canvas></div>
  <p id="map-pan-help" class="muted">Kéo để pan · Cuộn để zoom · Phím mũi tên di chuyển · +/− đổi zoom · 0 vừa khung. Click chọn ô/vật thể theo khung ảnh.</p>
 </div>
</template>
