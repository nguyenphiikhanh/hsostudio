<script setup>
import { titleCatalog, titleLayer } from '../lib/titles'
const props = defineProps({ layers: { type: Array, required: true } })
const emit = defineEmits(['update'])
function change(id) {
  const next=props.layers.filter(l=>l.slot!=='title')
  if(id!=='') next.push(titleLayer(id))
  emit('update',next)
}
</script>
<template>
  <section class="weapon-equipment" aria-label="Trang bị danh hiệu">
    <p class="eyebrow">DANH HIỆU CÁ NHÂN · DỮ LIỆU SERVER</p>
    <label class="field">Danh hiệu<select aria-label="Danh hiệu cá nhân" :value="layers.find(l=>l.slot==='title')?.title.id ?? ''" @change="change($event.target.value)">
      <option value="">Không dùng</option>
      <option v-for="d in titleCatalog.titles" :key="d.id" :value="d.id">{{d.label}} · #{{d.id}} · {{d.rig.frames.length}} frame · x4</option>
    </select></label>
    <p class="muted">11 danh hiệu của bộ dữ liệu server này; không phải tên bang/tổ đội. PNG x4 và điểm đặt giữ nguyên từ nguồn; đổi frame mỗi 5 tick client (5 FPS), không lật theo hướng nhân vật. Khi cưỡi, danh hiệu nâng theo tọa độ người cưỡi.</p>
  </section>
</template>
