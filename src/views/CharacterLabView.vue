<script setup>
import { ref, onMounted, onActivated, onDeactivated } from 'vue'
import CharacterPreset from '../components/CharacterPreset.vue'
import CharacterAnimation from '../components/CharacterAnimation.vue'
import { useWorkbench } from '../composables/useWorkbench'
const workbench = useWorkbench()
const { layers, characterClass, activeLayer, scale, updateCharacter, clearCharacter, preview, error } = workbench
const canvas = ref(null), stage = ref(null)
function attachStage() {
  workbench.canvas.value = canvas.value
  workbench.stage.value = stage.value
  workbench.draw()
}
onMounted(() => { attachStage(); workbench.centerStage() })
onActivated(attachStage)
onDeactivated(() => { workbench.canvas.value = null; workbench.stage.value = null })
</script>

<template>
  <div class="character-lab-page">
    <div class="section-heading"><div><p class="eyebrow">THIẾT KẾ NHÂN VẬT</p><h1>Character Lab</h1></div></div>
          <section class="composer"><div class="section-heading"><div><p class="eyebrow">CHARACTER LAB</p><h2>Nhân vật hoàn chỉnh</h2></div><label>Zoom <select v-model="scale"><option :value="1">1×</option><option :value="2">2×</option><option :value="3">3×</option><option :value="4">4×</option><option :value="6">6×</option><option :value="8">8×</option></select></label></div><div class="character-workspace"><CharacterPreset :layers="layers" v-model:clazz="characterClass" @update="updateCharacter" @focus="activeLayer = $event"/><div class="character-preview"><div class="composer-actions"><span class="muted">Gốc tọa độ tại bàn chân. Có thể tinh chỉnh từng lớp trong Inspector.</span><button @click="clearCharacter">Xóa các lớp</button></div><div ref="stage" class="stage checker"><canvas ref="canvas" width="2560" height="1920" :style="{ width: `${640 * scale}px`, height: `${480 * scale}px` }" aria-label="Bản xem trước các lớp nhân vật"></canvas><span v-if="!layers.length" class="stage-empty">Thêm part từ thư viện để bắt đầu</span></div></div></div><CharacterAnimation :layers="layers" v-model:clazz="characterClass" @update="preview = $event" @error="error = $event"/></section>
  </div>
</template>
