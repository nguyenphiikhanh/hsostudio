<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { gameUrl } from './lib/catalog'
import { provideWorkbench } from './composables/useWorkbench'
import WorkbenchInspector from './components/WorkbenchInspector.vue'
const GamePreview = defineAsyncComponent(() => import('./components/GamePreview.vue'))
const route = useRoute()
const isMap = computed(() => route.name === 'maps')
const isCatalog = computed(() => route.name === 'catalog')
const { gameLayers, openGame, ready, layers, busy, exportName, archiveName, exportDrafts, draftCount, exportLibrary, exportCharacter, error, notice, tables, table, changeTable, report } = provideWorkbench()
</script>

<template>
  <div class="workbench">
    <GamePreview v-if="gameLayers" :layers="gameLayers" @close="gameLayers = null"/>
    <header><div class="brand"><span class="mark">H</span><div><strong>HSO STUDIO</strong><small>Asset workbench / Hiệp Sĩ Ong Đất</small></div></div><template v-if="!isMap"><button :disabled="!ready || !layers.length || busy || layers.some(l=>l.companion || l.title)" title="Demo arena chưa hỗ trợ mount/pet/danh hiệu; dùng preview Studio hoặc runtime trong ZIP để xem." @click="openGame">Chơi thử H5</button><span class="badge">CHỈNH NHÁP · KHÔNG LƯU NGUỒN</span><label class="export-name">Tên bản xuất<input v-model="exportName" aria-label="Tên bản xuất" :disabled="busy" maxlength="100" placeholder="character"><small>{{ archiveName }}.zip</small></label><button :disabled="!ready || busy" @click="exportDrafts">Xuất nháp ({{ draftCount }})</button><button :disabled="!ready || busy" @click="exportLibrary">Xuất thư viện part</button><button class="primary" :disabled="busy || !layers.length" @click="exportCharacter">{{ busy ? 'Đang đóng gói…' : 'Xuất cho Phaser ↗' }}</button></template><span v-else class="badge">MAP VIEWER · CHỈ ĐỌC</span></header>
    <p v-if="error" class="alert" role="alert">{{ error }} <button @click="error = ''">Đóng</button></p>
    <p v-if="notice && !isMap" class="notice" role="status">{{ notice }} <button @click="notice = ''">Đóng</button></p>
    <div v-if="!ready" class="loading">{{ error ? 'Chưa thể mở catalog.' : 'Đang mở SQLite và lập chỉ mục tài nguyên…' }}</div>
    <div v-else class="workspace" :class="{'workspace-map':isMap}">
        <aside class="sidebar">
          <p class="eyebrow">KHÔNG GIAN LÀM VIỆC</p>
          <nav class="workspace-menu" aria-label="Không gian làm việc">
            <RouterLink :to="{name:'character-lab'}">Character Lab</RouterLink>
            <RouterLink :to="{name:'catalog'}">Thư viện dữ liệu</RouterLink>
            <RouterLink :to="{name:'maps'}">Map</RouterLink>
          </nav>
          <template v-if="isCatalog">
            <p class="eyebrow menu-heading">DỮ LIỆU GAME</p>
            <nav aria-label="Danh mục"><button v-for="[key, label] in tables" :key="key" :class="{ active: table === key }" @click="changeTable(key)">{{ label }}<small>{{ key === 'assets' ? report.assets : report.tables[key] }}</small></button></nav>
          </template>
          <div class="source-info"><span class="dot"></span> SQLite · chỉ đọc<p>{{ report.decoded.toLocaleString() }} ảnh giải mã</p><p>{{ report.assets - report.decoded }} mục chưa giải mã</p><a :href="gameUrl('catalog.sqlite')" download>Tải catalog.sqlite ↓</a></div>
        </aside>
        <main>
          <RouterView v-slot="{ Component }"><KeepAlive><component :is="Component"/></KeepAlive></RouterView>
        </main>
        <WorkbenchInspector v-if="!isMap" :show-record="isCatalog"/>
    </div>
  </div>
</template>
