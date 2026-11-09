<script setup>
import { useWorkbench } from '../composables/useWorkbench'
defineProps({ catalog: Boolean })
const { ready, layers, busy, exportName, archiveName, exportDrafts, draftCount, exportLibrary, exportCharacter, openGame } = useWorkbench()
</script>
<template>
  <div class="route-actions" aria-label="Xuất dữ liệu">
    <label class="export-name">Tên bản xuất<input v-model="exportName" aria-label="Tên bản xuất" :disabled="busy" maxlength="100" placeholder="character"><small>{{ archiveName }}.zip</small></label>
    <button v-if="!catalog" :disabled="!ready || !layers.length || busy || layers.some(l=>l.companion || l.title)" title="Demo H5 chưa hỗ trợ thú cưỡi, pet và danh hiệu." @click="openGame">Chơi thử H5</button>
    <button :disabled="!ready || busy" @click="exportDrafts">Xuất nháp ({{ draftCount }})</button>
    <button v-if="!catalog" :disabled="!ready || busy" @click="exportLibrary">Xuất thư viện part</button>
    <button v-if="!catalog" class="primary" :disabled="busy || !layers.length" @click="exportCharacter">{{ busy ? 'Đang đóng gói…' : 'Xuất cho Phaser ↗' }}</button>
  </div>
</template>
