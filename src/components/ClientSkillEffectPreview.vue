<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { loadImage } from '../lib/export'
import { resolvePose, paintLayers } from '../lib/characterPose'
import { clientSkillEffectScene, paintClientSkillEffects } from '../lib/clientSkillEffects'
import { clientSkillData } from '../lib/clientSkillCatalog'

const props = defineProps({ layers: Array, clazz: Number, skillId: Number, direction: String, tick: Number, options: Object })
const emit = defineEmits(['error'])
const canvas = ref(null)
const reference = computed(() => props.layers.find(layer => layer.clientWeapon)?.clientWeapon.skillEffects)
const skill = computed(() => clientSkillData(props.clazz, props.skillId))
let version = 0

async function draw() {
  const id = ++version
  if (!reference.value || !canvas.value || !skill.value) return
  try {
    const scene = clientSkillEffectScene(props.clazz, props.skillId, props.direction, props.tick, reference.value)
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
    paintClientSkillEffects(ctx, scene, effects, x, y)
    canvas.value.dataset.effectFrame = scene.effectFrame
    canvas.value.dataset.effectId = scene.effectId
    canvas.value.dataset.sprites = scene.sprites.length
  } catch (error) { emit('error', error.message) }
}

watch(() => [props.layers, props.clazz, props.skillId, props.direction, props.tick, props.options], draw, { deep: true })
onMounted(draw)
onUnmounted(() => version++)
</script>

<template>
  <div class="skill-preview" data-testid="client-skill-effect-preview">
    <p class="eyebrow">CHIÊU #{{ skillId }} · THÂN / VŨ KHÍ / HIỆU ỨNG GỐC · effect {{ skill.effectId }}</p>
    <canvas ref="canvas" class="checker" width="1360" height="960" style="width:100%;max-width:680px;height:auto" aria-label="Preview hiệu ứng chiêu và mục tiêu mẫu" :data-clazz="clazz" :data-skill-id="skillId" :data-tick="tick" :data-direction="direction" />
    <details class="skill-provenance"><summary>Nguồn hiệu ứng và giới hạn preview</summary>
    <p class="muted">Hiệu ứng chính dùng FrameImage client khi có sprite; nhánh không có ảnh dùng nét vẽ minh họa cố định. Khung viền là mục tiêu mẫu, không phải sprite quái. Hạt ngẫu nhiên, hiệu ứng phụ, sát thương, âm thanh và cooldown chưa mô phỏng.</p>
    </details>
  </div>
</template>
