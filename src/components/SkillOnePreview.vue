<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { loadImage } from '../lib/export'
import { resolvePose, paintLayers } from '../lib/characterPose'
import { skillOneScene, paintSkillOne } from '../lib/clientSkillOne'
const props = defineProps({ layers: Array, clazz: Number, direction: String, tick: Number, options: Object })
const emit = defineEmits(['error'])
const canvas = ref(null)
const reference = computed(() => props.layers.find(l => l.clientWeapon)?.clientWeapon.skillOne)
let version = 0
async function draw() {
  const id = ++version
  if (!reference.value || !canvas.value) return
  try {
    const scene = skillOneScene(props.clazz,props.direction,props.tick,reference.value)
    const posed = resolvePose(props.layers,props.direction,0,0,props.options)
    const [parts, effects] = await Promise.all([
      Promise.all(posed.map(l => loadImage(l.asset))), Promise.all(scene.sprites.map(s => loadImage(s.asset))),
    ])
    if (id !== version || !canvas.value) return
    const ctx = canvas.value.getContext('2d')
    ctx.setTransform(4,0,0,4,0,0); ctx.clearRect(0,0,340,240); ctx.imageSmoothingEnabled = false
    const x = 170 - scene.target.x/2, y = 140 - scene.target.y/2
    const tx = x+scene.target.x, ty = y+scene.target.y
    ctx.strokeStyle = '#839177'; ctx.lineWidth = 0.5
    ctx.strokeRect(tx-8,ty-40,16,40)
    ctx.beginPath(); ctx.moveTo(tx-12,ty); ctx.lineTo(tx+12,ty); ctx.stroke()
    paintLayers(ctx,posed,parts,x,y)
    paintSkillOne(ctx,scene,effects,x,y)
    canvas.value.dataset.effectFrame = scene.effectFrame
    canvas.value.dataset.sprites = scene.sprites.length
    canvas.value.dataset.lines = scene.lines.length
  } catch (error) { emit('error',error.message) }
}
watch(() => [props.layers,props.clazz,props.direction,props.tick,props.options],draw,{ deep:true })
onMounted(draw)
onUnmounted(() => version++)
</script>
<template>
  <div class="skill-one-preview" data-testid="skill-one-preview">
    <p class="eyebrow">CHIÊU #1 · THÂN / VŨ KHÍ / HIỆU ỨNG GỐC</p>
    <canvas ref="canvas" class="checker" width="1360" height="960" style="width:100%;max-width:680px;height:auto" aria-label="Preview chiêu 1 và mục tiêu mẫu" :data-clazz="clazz" :data-tick="tick" :data-direction="direction" />
    <p class="muted">Khung viền là mục tiêu mẫu cao 40, cách {{ clazz &lt; 2 ? 40 : 100 }} đơn vị; không phải sprite quái. Bấm hướng bên dưới để đổi hướng. PNG hiệu ứng x4 từ server, WPS x1 từ client. Hạt ngẫu nhiên dùng seed cố định để có thể xem từng frame.</p>
    <p class="muted">Đã khôi phục hiệu ứng chính của bốn phái. Chưa đưa vào tia tụ lực trước đòn, bụi đá/rung màn hình và tương tác mặt nước; không mô phỏng sát thương, âm thanh hay cooldown. Hiệu ứng chỉ có trong preview; ZIP thư viện part xuất timeline cơ thể.</p>
  </div>
</template>
