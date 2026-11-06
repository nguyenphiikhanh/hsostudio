<script setup>
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import AttackControls from './AttackControls.vue'
import SkillOnePreview from './SkillOnePreview.vue'
import SkillTwoPreview from './SkillTwoPreview.vue'
import SkillThreePreview from './SkillThreePreview.vue'
import SkillFourPreview from './SkillFourPreview.vue'
import ClientSkillEffectPreview from './ClientSkillEffectPreview.vue'
import { createAttackTrial } from '../lib/attackTrial'
import { companionCycleLength, companionViewport } from '../lib/companionPose.js'
import { loadImage } from '../lib/export'
import { DIRECTIONS, WALK_CYCLE, IDLE_CYCLE, IDLE_FPS, paintLayers, resolvePose, clientSkillPhase, clientSkillClip } from '../lib/characterPose'
import { clientSkillData, isClientAttackSkill } from '../lib/clientSkillCatalog'

const props = defineProps({ layers: { type: Array, required: true }, clazz: { type: Number, default: 0 } })
const emit = defineEmits(['update', 'error', 'update:clazz'])
const direction = ref('down'), motion = ref('idle'), playing = ref(true), fps = ref(IDLE_FPS), tick = ref(0)
const trial = ref(createAttackTrial({ clazz: props.clazz }))
const hasClientWeapon = computed(() => props.layers.some(layer => layer.slot === 'weapon' && layer.clientWeapon && layer.clazz === props.clazz))
const clientBasic = computed(() => motion.value === 'attack' && trial.value.skillId === 0 && hasClientWeapon.value)
const clientSkillOne = computed(() => motion.value === 'attack' && trial.value.skillId === 1 && hasClientWeapon.value && props.layers.some(l => l.clientWeapon?.skillOne))
const clientSkillTwo = computed(() => motion.value === 'attack' && trial.value.skillId === 2 && hasClientWeapon.value && props.layers.some(l => l.clientWeapon?.skillTwo))
const clientSkillThree = computed(() => motion.value === 'attack' && trial.value.skillId === 3 && hasClientWeapon.value && props.layers.some(l => l.clientWeapon?.skillThree))
const clientSkillFour = computed(() => motion.value === 'attack' && trial.value.skillId === 4 && hasClientWeapon.value && props.layers.some(l => l.clientWeapon?.skillFour))
const clientSkill = computed(() => motion.value === 'attack' && isClientAttackSkill(props.clazz, trial.value.skillId) && hasClientWeapon.value)
const clientNonAttackSkill = computed(() => motion.value === 'attack' && trial.value.skillId > 0 && !isClientAttackSkill(props.clazz, trial.value.skillId) && Boolean(clientSkillData(props.clazz, trial.value.skillId)))
const clientVerified = computed(() => clientBasic.value || clientSkill.value)
const hasCompanion = computed(()=>props.layers.some(l=>l.companion && l.visible))
const activeMount = computed(()=>props.layers.find(l=>l.slot==='mount' && l.visible)?.companion)
const hasMount = computed(()=>Boolean(activeMount.value))
const mountedCombat = computed(()=>activeMount.value?.mountedAttack?.status==='ready')
const mountEntry = ref({motion:'idle',tick:0})
watch(motion,(value,old)=>{
  if(value==='attack' && hasMount.value){
    mountEntry.value={motion:old==='walk'?'walk':'idle',tick:tick.value}
    if(!activeMount.value.mountedAttack?.skillIds?.includes(trial.value.skillId))updateTrial(createAttackTrial({clazz:props.clazz,skillId:0}))
  }
},{flush:'sync'})
const effectiveFps = computed(() => clientVerified.value || hasCompanion.value ? 25 : fps.value)
const companionCycle = computed(()=>{
  const lengths=props.layers.filter(l=>l.companion && l.visible).map(l=>companionCycleLength(l.companion,motion.value))
  const gcd=(a,b)=>b?gcd(b,a%b):a
  if(!hasMount.value)lengths.push(100/gcd(fps.value,100))
  return lengths.reduce((a,b)=>a*b/gcd(a,b),1)
})
watch(activeMount,()=>{if(hasMount.value && motion.value==='attack')motion.value='idle'})
watch(hasClientWeapon,value=>{if(hasMount.value && !value && motion.value==='attack')motion.value='idle'})
const nativePhase = computed(() => clientSkillPhase(props.clazz, clientSkill.value ? trial.value.skillId : 0, tick.value))
const attackPhase = computed(() => trial.value.frames[tick.value % trial.value.frames.length])
const baseAttackOptions = computed(() => clientVerified.value ? { clientAttack: true, clientBodyFrame: nativePhase.value.bodyFrame, clientWeaponFrame: nativePhase.value.weaponFrame } : motion.value === 'attack' ? { experimentalAttack: true, anchorPose: attackPhase.value.anchorPose } : {})
const attackOptions = computed(()=>hasCompanion.value ? {...baseAttackOptions.value,motion:motion.value,tick:tick.value,...(hasMount.value && motion.value==='attack'?{mountEntry:mountEntry.value,clientSkillId:trial.value.skillId}:{})} : baseAttackOptions.value)
const views = new Map()
const viewport=computed(()=>companionViewport(props.layers))
const cycleLength = computed(() => hasCompanion.value && motion.value!=='attack' ? companionCycle.value : clientSkill.value ? Math.max(32, clientSkillClip(props.clazz, trial.value.skillId).frames.length) : clientBasic.value ? 9 : motion.value === 'attack' ? trial.value.frames.length : motion.value === 'walk' ? WALK_CYCLE.length : IDLE_CYCLE.length)
const bodyTick = computed(()=>hasCompanion.value && !hasMount.value ? Math.floor(tick.value*fps.value/25) : tick.value)
const breath = computed(() => motion.value === 'idle' && !hasMount.value ? IDLE_CYCLE[bodyTick.value % IDLE_CYCLE.length] : 0)
const pose = computed(() => clientVerified.value ? [0, 0, 1, 2, 3, 4][nativePhase.value.bodyFrame] : motion.value === 'attack' ? attackPhase.value.pose : motion.value === 'walk' ? WALK_CYCLE[bodyTick.value % WALK_CYCLE.length] : 0)
let timer, renderVersion = 0
function stopTimer() { clearInterval(timer); timer = undefined }
function restartTimer() {
  stopTimer()
  if (playing.value) timer = setInterval(() => { tick.value = (tick.value + 1) % cycleLength.value }, 1000 / effectiveFps.value)
}
function nextFrame() { playing.value = false; tick.value = (tick.value + 1) % cycleLength.value }
function updateTrial(value) { trial.value = value; tick.value = 0; emit('update:clazz', value.clazz) }
watch(() => props.clazz, clazz => { if (clazz !== trial.value.clazz) updateTrial({ ...trial.value, clazz, skillId: 0 }) })
watch([clientVerified, clientSkill, hasCompanion, hasMount], () => { tick.value = 0 })
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
      ctx.scale(hasCompanion.value ? viewport.value.scale : 12, hasCompanion.value ? viewport.value.scale : 12)
      ctx.imageSmoothingEnabled = false
      paintLayers(ctx, posed, images, hasCompanion.value ? viewport.value.x : 26, hasCompanion.value ? viewport.value.y : 45)
      canvas.dataset.renderedMount=posed.find(l=>l.slot==='mount' && l.visible)?.companion.id ?? ''
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
      <label class="field">Trạng thái<select v-model="motion" aria-label="Trạng thái nhân vật" @change="changeMotion"><option value="idle">Đứng yên</option><option value="walk">Di chuyển</option><option value="attack" :disabled="hasMount && (!mountedCombat || !hasClientWeapon)">Tấn công · thử nghiệm</option></select></label>
      <button @click="playing = !playing">{{ playing ? 'Tạm dừng' : 'Phát animation' }}</button>
      <button @click="nextFrame">Frame tiếp →</button>
      <label class="field">Tốc độ<select :value="effectiveFps" :disabled="clientVerified || hasCompanion" aria-label="Tốc độ animation" @change="fps = Number($event.target.value)"><option v-for="value in [4,6,8,10,12,25]" :key="value" :value="value">{{ value }} fps</option></select></label>
      <span class="frame-status" role="status">{{ clientVerified ? `Client tick ${tick + 1}/${cycleLength} · body ${nativePhase.bodyFrame} · WPS ${nativePhase.weaponFrame}` : hasCompanion ? `Client tick ${tick + 1}/${cycleLength} · ${motion} · 25 FPS` : motion === 'attack' ? `Đòn ${tick + 1}/${cycleLength} · pose ${pose} · anchor ${attackPhase.anchorPose}` : motion === 'walk' ? `Bước ${tick + 1}/4 · pose ${pose}` : `Thở ${tick + 1}/${cycleLength} · lệch ${breath}px` }}</span>
    </div>
    <p v-if="hasMount" class="muted" data-testid="mounted-attack-status">{{mountedCombat ? activeMount.label + ': hỗ trợ chiêu đánh #0–#8, #17, #19, #20 của bốn phái. Chọn vũ khí thường, chuyển Tấn công; thú giữ frame/điểm ngồi tại lúc bắt đầu đòn, thân và WPS dùng frame client.' : activeMount.mountedAttack?.reason ?? 'Rig chưa hỗ trợ đánh khi cưỡi.'}}</p>
    <AttackControls v-if="motion === 'attack'" :trial="trial" :client-verified="clientVerified" :mounted-skill-ids="hasMount ? activeMount.mountedAttack?.skillIds ?? [] : null" @update="updateTrial"/>
    <p v-if="clientVerified" class="muted" data-testid="client-weapon-animation">Client HSO 4.0.3 · kỹ năng #{{ trial.skillId }} · 25 FPS (40 ms/tick). Body/WPS đổi theo plash của kỹ năng; preview lặp để xem, không mô phỏng cooldown.</p>
    <p v-if="clientNonAttackSkill" class="muted">Kỹ năng #{{ trial.skillId }} thuộc nhóm nội tại/buff; không có chuỗi đánh vũ khí hoặc preview va chạm mục tiêu.</p>
    <p v-else-if="motion === 'attack' && hasClientWeapon && !clientVerified" class="muted">Chiêu chưa thuộc nhóm đánh hoặc chưa có mapping animation client; vũ khí được ẩn trong chuỗi thử nghiệm.</p>
    <SkillOnePreview v-if="clientSkillOne" :layers="layers" :clazz="clazz" :direction="direction" :tick="tick" :options="attackOptions" @error="emit('error', $event)"/>
    <SkillTwoPreview v-if="clientSkillTwo" :layers="layers" :clazz="clazz" :direction="direction" :tick="tick" :options="attackOptions" @error="emit('error', $event)"/>
    <SkillThreePreview v-if="clientSkillThree" :layers="layers" :clazz="clazz" :direction="direction" :tick="tick" :options="attackOptions" @error="emit('error', $event)"/>
    <SkillFourPreview v-if="clientSkillFour" :layers="layers" :clazz="clazz" :direction="direction" :tick="tick" :options="attackOptions" @error="emit('error', $event)"/>
    <ClientSkillEffectPreview v-if="clientSkill && trial.skillId > 4 && !hasMount" :layers="layers" :clazz="clazz" :skill-id="trial.skillId" :direction="direction" :tick="tick" :options="attackOptions" @error="emit('error', $event)"/>
    <p v-if="hasMount && clientSkill && trial.skillId > 4" class="muted" data-testid="mounted-body-only">Chiêu này khi cưỡi hiển thị timeline thân/WPS đã đối chiếu. Hiệu ứng đầy đủ chưa được khôi phục; không dùng vị trí/hạt minh họa làm hiệu ứng gốc. Nội tại và buff không nằm trong nhóm đòn đánh này.</p>
    <div class="direction-views">
      <button v-for="view in DIRECTIONS" :key="view.key" :class="{ active: direction === view.key }" :aria-pressed="direction === view.key" :aria-label="`Xem hướng ${view.label}`" @click="direction = view.key">
        <canvas :ref="el => el ? views.set(view.key, el) : views.delete(view.key)" class="checker" width="624" height="624" :data-direction="view.key" :data-pose="pose" :data-breath="breath" :data-motion="motion" :data-anchor="attackOptions.anchorPose" :aria-label="`${motion === 'attack' ? 'Tấn công' : motion === 'walk' ? 'Di chuyển' : 'Đứng yên'} ${view.label}`"></canvas>
        <span>{{ view.label }}</span>
      </button>
    </div>
    <p class="muted">Bấm một hướng để xem lớn. Đứng yên có chuyển động thở 1px do Studio dựng, giữ chân cố định; không phải animation gốc. Hướng phải dùng ảnh ngang lật lại. Chu kỳ di chuyển 0 → 1 → 0 → 2 được suy ra từ frame bước chân, chưa đối chiếu client gốc. Lớp ghép tay giữ nguyên tư thế.</p>
  </section>
</template>
