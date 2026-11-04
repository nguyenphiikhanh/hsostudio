<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { loadImage } from '../lib/export'
import { resolvePose, paintLayers } from '../lib/characterPose'
import { skillThreeScene, paintSkillThree } from '../lib/clientSkillThree'

const props = defineProps({ layers: Array, clazz: Number, direction: String, tick: Number, options: Object })
const emit = defineEmits(['error'])
const canvas = ref(null)
const reference = computed(() => props.layers.find(layer => layer.clientWeapon)?.clientWeapon.skillThree)
const labels = ['Rồng đất', 'Tia chớp', 'Sóng xung kích', 'Súng phóng lựu']
let version = 0

async function draw() {
  const id = ++version
  if (!reference.value || !canvas.value) return
  try {
    const scene = skillThreeScene(props.clazz, props.direction, props.tick, reference.value)
    const posed = resolvePose(props.layers, props.direction, 0, 0, props.options)
    const [parts, effects] = await Promise.all([
      Promise.all(posed.map(layer => loadImage(layer.asset))),
      Promise.all(scene.sprites.map(sprite => loadImage(sprite.asset))),
    ])
    if (id !== version || !canvas.value) return
    const ctx = canvas.value.getContext('2d')
    ctx.setTransform(4, 0, 0, 4, 0, 0); ctx.clearRect(0, 0, 340, 240); ctx.imageSmoothingEnabled = false
    const x = 170 - scene.target.x / 2, y = 140 - scene.target.y / 2
    const tx = x + scene.target.x, ty = y + scene.target.y
    ctx.strokeStyle = '#839177'; ctx.lineWidth = 0.5
    ctx.strokeRect(tx - 8, ty - 40, 16, 40)
    ctx.beginPath(); ctx.moveTo(tx - 12, ty); ctx.lineTo(tx + 12, ty); ctx.stroke()
    paintLayers(ctx, posed, parts, x, y)
    paintSkillThree(ctx, scene, effects, x, y)
    canvas.value.dataset.effectFrame = scene.effectFrame
    canvas.value.dataset.sprites = scene.sprites.length
  } catch (error) { emit('error', error.message) }
}

watch(() => [props.layers, props.clazz, props.direction, props.tick, props.options], draw, { deep: true })
onMounted(draw)
onUnmounted(() => version++)
</script>

<template>
  <div class="skill-preview" data-testid="skill-three-preview">
    <p class="eyebrow">CHIÊU #3 · THÂN / VŨ KHÍ / HIỆU ỨNG GỐC · {{ labels[clazz] }}</p>
    <canvas ref="canvas" class="checker" width="1360" height="960" style="width:100%;max-width:680px;height:auto" aria-label="Preview chiêu 3 và mục tiêu mẫu" :data-clazz="clazz" :data-tick="tick" :data-direction="direction" />
    <p class="muted">Hiệu ứng chính dùng sprite client HSO 4.0.3 đã đối chiếu; khung viền là mục tiêu mẫu, không phải sprite quái. Hướng hiện tại điều khiển cả nhân vật và mục tiêu.</p>
    <p class="muted">Preview tái hiện sprite chính theo nhịp kích hoạt. Mảnh vỡ ngẫu nhiên, hiệu ứng phụ, sát thương, âm thanh và cooldown chưa mô phỏng; ZIP thư viện part chỉ xuất timeline cơ thể.</p>
  </div>
</template>
