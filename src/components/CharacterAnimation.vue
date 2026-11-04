<script setup>
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import AttackControls from './AttackControls.vue'
import SkillOnePreview from './SkillOnePreview.vue'
import SkillTwoPreview from './SkillTwoPreview.vue'
import { createAttackTrial } from '../lib/attackTrial'
import { loadImage } from '../lib/export'
import { DIRECTIONS, WALK_CYCLE, IDLE_CYCLE, IDLE_FPS, paintLayers, resolvePose, clientSkillPhase, clientSkillClip } from '../lib/characterPose'

const props = defineProps({ layers: { type: Array, required: true }, clazz: { type: Number, default: 0 } })
const emit = defineEmits(['update', 'error', 'update:clazz'])
const direction = ref('down'), motion = ref('idle'), playing = ref(true), fps = ref(IDLE_FPS), tick = ref(0)
const trial = ref(createAttackTrial({ clazz: props.clazz }))
const hasClientWeapon = computed(() => props.layers.some(layer => layer.slot === 'weapon' && layer.clientWeapon && layer.clazz === props.clazz))
const clientBasic = computed(() => motion.value === 'attack' && trial.value.skillId === 0 && hasClientWeapon.value)
const clientSkillOne = computed(() => motion.value === 'attack' && trial.value.skillId === 1 && hasClientWeapon.value && props.layers.some(l => l.clientWeapon?.skillOne))
const clientSkillTwo = computed(() => motion.value === 'attack' && trial.value.skillId === 2 && hasClientWeapon.value && props.layers.some(l => l.clientWeapon?.skillTwo))
const clientSkill = computed(() => clientSkillOne.value || clientSkillTwo.value)
const clientVerified = computed(() => clientBasic.value || clientSkill.value)
const effectiveFps = computed(() => clientVerified.value ? 25 : fps.value)
const nativePhase = computed(() => clientSkillPhase(props.clazz, clientSkill.value ? trial.value.skillId : 0, tick.value))
const attackPhase = computed(() => trial.value.frames[tick.value % trial.value.frames.length])
const attackOptions = computed(() => clientVerified.value ? { clientAttack: true, clientBodyFrame: nativePhase.value.bodyFrame, clientWeaponFrame: nativePhase.value.weaponFrame } : motion.value === 'attack' ? { experimentalAttack: true, anchorPose: attackPhase.value.anchorPose } : {})
const views = new Map()
const cycleLength = computed(() => clientSkill.value ? 32 : clientBasic.value ? 9 : motion.value === 'attack' ? trial.value.frames.length : motion.value === 'walk' ? WALK_CYCLE.length : IDLE_CYCLE.length)
const breath = computed(() => motion.value === 'idle' ? IDLE_CYCLE[tick.value] : 0)
const pose = computed(() => clientVerified.value ? [0, 0, 1, 2, 3, 4][nativePhase.value.bodyFrame] : motion.value === 'attack' ? attackPhase.value.pose : motion.value === 'walk' ? WALK_CYCLE[tick.value] : 0)
let timer, renderVersion = 0
function stopTimer() { clearInterval(timer); timer = undefined }
function restartTimer() {
  stopTimer()
  if (playing.value) timer = setInterval(() => { tick.value = (tick.value + 1) % cycleLength.value }, 1000 / effectiveFps.value)
}
function nextFrame() { playing.value = false; tick.value = (tick.value + 1) % cycleLength.value }
function updateTrial(value) { trial.value = value; tick.value = 0; emit('update:clazz', value.clazz) }
watch(() => props.clazz, clazz => { if (clazz !== trial.value.clazz) updateTrial({ ...trial.value, clazz, skillId: 0 }) })
watch([clientVerified, clientSkill], () => { tick.value = 0 })
function changeMotion() { tick.value = 0; playing.value = true; restartTimer() }
async function drawViews() {
  const version = ++renderVersion
  const snapshot = props.layers.map(l => ({ ...l, asset: { ...l.asset } }))
  try {
    const phaseOptions = { ...attackOptions.value }, poseIndex = pose.value, idle = breath.value
    await nextTick()
    await Promise.all(DIRECTIONS.map(async view => {
      const posed = resolvePose(snapshot, view.key, poseIndex, idle, phaseOptions)
      const images = await Promise.all(posed.map(layer => loadImage(layer.asset)))
      if (version !== renderVersion) return
      const canvas = views.get(view.key)
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(12, 12)
      ctx.imageSmoothingEnabled = false
      paintLayers(ctx, posed, images, 26, 45)
      ctx.restore()
    }))
  } catch (error) { emit('error', error.message) }
}
watch([playing, effectiveFps], restartTimer)
watch([direction, motion, pose, breath, tick, fps, playing, trial, clientVerified, clientSkill], () => {
  emit('update', { direction: direction.value, motion: motion.value, pose: pose.value, breath: breath.value, frame: tick.value, fps: effectiveFps.value, clientBasic: clientBasic.value, clientSkill: clientSkill.value, playing: playing.value, attackOptions: attackOptions.value, attackTrial: clientVerified.value ? clientSkillClip(props.clazz, trial.value.skillId) : { ...trial.value, fps: fps.value } })
}, { immediate: true })
watch([() => props.layers, pose, breath, attackOptions], drawViews, { deep: true })
onMounted(() => { drawViews(); restartTimer() })
onUnmounted(() => { stopTimer(); renderVersion++ })
</script>

<template>
  <section class="animation-panel" aria-label="Hướng và trạng thái nhân vật">
    <div class="motion-controls">
      <label class="field">Trạng thái<select v-model="motion" aria-label="Trạng thái nhân vật" @change="changeMotion"><option value="idle">Đứng yên</option><option value="walk">Di chuyển</option><option value="attack">Tấn công · thử nghiệm</option></select></label>
      <button @click="playing = !playing">{{ playing ? 'Tạm dừng' : 'Phát animation' }}</button>
      <button @click="nextFrame">Frame tiếp →</button>
      <label class="field">Tốc độ<select :value="effectiveFps" :disabled="clientVerified" aria-label="Tốc độ animation" @change="fps = Number($event.target.value)"><option v-for="value in [4,6,8,10,12,25]" :key="value" :value="value">{{ value }} fps</option></select></label>
      <span class="frame-status" role="status">{{ clientVerified ? `Client tick ${tick + 1}/${cycleLength} · body ${nativePhase.bodyFrame} · WPS ${nativePhase.weaponFrame}` : motion === 'attack' ? `Đòn ${tick + 1}/${cycleLength} · pose ${pose} · anchor ${attackPhase.anchorPose}` : motion === 'walk' ? `Bước ${tick + 1}/4 · pose ${pose}` : `Thở ${tick + 1}/${cycleLength} · lệch ${breath}px` }}</span>
    </div>
    <AttackControls v-if="motion === 'attack'" :trial="trial" :client-verified="clientVerified" @update="updateTrial"/>
    <p v-if="clientVerified" class="muted" data-testid="client-weapon-animation">Client HSO 4.0.3 · kỹ năng #{{ trial.skillId }} · 25 FPS (40 ms/tick). Dùng frame cơ thể 4/5 và WPS 4–7 theo client. Preview lặp để xem; không mô phỏng cooldown.</p>
    <p v-else-if="motion === 'attack' && hasClientWeapon" class="muted">Chiêu này vẫn dùng chuỗi thân thử nghiệm; vũ khí được ẩn cho tới khi đối chiếu xong động tác chiêu đó. Chọn kỹ năng #0, #1 hoặc #2 để xem vũ khí đánh theo client.</p>
    <SkillOnePreview v-if="clientSkillOne" :layers="layers" :clazz="clazz" :direction="direction" :tick="tick" :options="attackOptions" @error="emit('error', $event)"/>
    <SkillTwoPreview v-if="clientSkillTwo" :layers="layers" :clazz="clazz" :direction="direction" :tick="tick" :options="attackOptions" @error="emit('error', $event)"/>
    <div class="direction-views">
      <button v-for="view in DIRECTIONS" :key="view.key" :class="{ active: direction === view.key }" :aria-pressed="direction === view.key" :aria-label="`Xem hướng ${view.label}`" @click="direction = view.key">
        <canvas :ref="el => el ? views.set(view.key, el) : views.delete(view.key)" class="checker" width="624" height="624" :data-direction="view.key" :data-pose="pose" :data-breath="breath" :data-motion="motion" :data-anchor="attackOptions.anchorPose" :aria-label="`${motion === 'attack' ? 'Tấn công' : motion === 'walk' ? 'Di chuyển' : 'Đứng yên'} ${view.label}`"></canvas>
        <span>{{ view.label }}</span>
      </button>
    </div>
    <p class="muted">Bấm một hướng để xem lớn. Đứng yên có chuyển động thở 1px do Studio dựng, giữ chân cố định; không phải animation gốc. Hướng phải dùng ảnh ngang lật lại. Chu kỳ di chuyển 0 → 1 → 0 → 2 được suy ra từ frame bước chân, chưa đối chiếu client gốc. Lớp ghép tay giữ nguyên tư thế.</p>
  </section>
</template>
