<script setup>
import { computed, onMounted } from 'vue'
import { characterParts } from '../lib/characterParts'

const props = defineProps({ layers: { type: Array, required: true } })
const emit = defineEmits(['update', 'focus'])
const slots = [
  { key: 'pants', label: 'Quần', required: true },
  { key: 'shirt', label: 'Áo', required: true },
  { key: 'head', label: 'Đầu', required: true },
  { key: 'eyes', label: 'Mắt preview', required: false },
  { key: 'hair', label: 'Tóc', required: false },
  { key: 'helmet', label: 'Mũ', required: false },
]
const parts = characterParts()
const options = slot => parts.filter(p => p.slot === slot)
const selected = slot => props.layers.find(l => l.slot === slot)?.asset.id || ''
const complete = computed(() => slots.filter(s => s.required).every(s => props.layers.some(l => l.slot === s.key)))
function makeLayer(part) {
  const frame = JSON.parse(part.frames)[0]
  const [x, y] = JSON.parse(part.offsets)[0]
  return {
    name: part.label, qualityNote: part.quality_note, slot: part.slot, partId: part.part_id, provenance: part.provenance,
    asset: { id: part.id, source: part.source, image: part.image, width: part.width, height: part.height, density: part.density },
    ...frame, x, y, visible: true,
    ...(part.provenance === 'packet-metadata' ? { poseFrames: JSON.parse(part.frames), poseOffsets: JSON.parse(part.offsets) } : {}),
  }
}
function change(slot, id) {
  const next = props.layers.filter(l => l.slot !== slot)
  const part = parts.find(p => p.slot === slot && p.id === id)
  if (part) next.push(makeLayer(part))
  const rank = l => slots.findIndex(s => s.key === l.slot)
  next.sort((a, b) => (rank(a) < 0 ? 100 : rank(a)) - (rank(b) < 0 ? 100 : rank(b)))
  emit('update', next)
  emit('focus', next.findIndex(l => l.slot === slot))
}
function reset() {
  const next = slots.filter(s => s.key !== 'helmet').map(s => options(s.key).find(p => p.part_id === 0)).filter(Boolean).map(makeLayer)
  emit('update', next)
  emit('focus', 0)
}
onMounted(() => { if (!props.layers.length) reset() })
</script>

<template>
  <div class="preset-panel">
    <div class="section-heading"><div><p class="eyebrow">NHÂN VẬT MẪU · BỘ PHẬN</p><h2>{{ complete ? 'Thay bộ phận trực tiếp trên nhân vật' : 'Chọn đủ đầu, áo và quần để ghép nhân vật' }}</h2></div><button @click="reset">Khôi phục nhân vật mẫu</button></div>
    <div class="part-selectors"><label v-for="slot in slots" :key="slot.key" class="field">{{ slot.label }}<select :value="selected(slot.key)" :aria-label="`Bộ phận ${slot.label}`" @change="change(slot.key, $event.target.value)"><option value="">{{ slot.required ? 'Chưa chọn' : 'Không dùng' }}</option><option v-for="part in options(slot.key)" :key="part.id" :value="part.id">{{ part.label }}</option></select></label></div>
    <p v-for="l in layers.filter(l => l.qualityNote)" :key="l.slot" class="muted">{{ l.name }}: {{ l.qualityNote }}</p>
    <p class="muted">Ưu tiên PNG x4 và metadata riêng của x4; tọa độ chỉnh sửa dùng đơn vị x1. Chọn hướng và trạng thái ở bên dưới. Mắt gốc type 4 bị trống trong bộ dữ liệu; mắt preview là hình thay thế của Studio.</p>
  </div>
</template>
