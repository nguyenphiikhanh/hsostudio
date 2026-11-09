<script setup>
import { defineAsyncComponent } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { gameUrl } from './lib/catalog'
import { provideWorkbench } from './composables/useWorkbench'
const GamePreview = defineAsyncComponent(() => import('./components/GamePreview.vue'))
const { gameLayers, ready, error, notice, report } = provideWorkbench()
</script>
<template>
  <div class="workbench desktop-studio">
    <GamePreview v-if="gameLayers" :layers="gameLayers" @close="gameLayers = null"/>
    <header class="app-header"><div class="brand"><span class="mark">H</span><div><strong>HSO STUDIO</strong><small>Không gian thiết kế game</small></div></div><span class="badge">BẢN NHÁP · NGUỒN CHỈ ĐỌC</span></header>
    <p v-if="error" class="alert" role="alert">{{ error }} <button @click="error = ''">Đóng</button></p>
    <p v-if="notice" class="notice" role="status">{{ notice }} <button @click="notice = ''">Đóng</button></p>
    <div v-if="!ready" class="loading">{{ error ? 'Chưa thể mở catalog.' : 'Đang mở thư viện tài nguyên…' }}</div>
    <div v-else class="workspace">
      <aside class="sidebar">
        <p class="eyebrow">KHÔNG GIAN</p>
        <nav class="workspace-menu" aria-label="Không gian làm việc">
          <RouterLink :to="{name:'character-lab'}">Character Lab</RouterLink>
          <RouterLink :to="{name:'catalog'}">Thư viện dữ liệu</RouterLink>
          <RouterLink :to="{name:'maps'}">Map</RouterLink>
        </nav>
        <details class="source-info"><summary>Thư viện nguồn</summary><p>{{ report.decoded.toLocaleString() }} ảnh giải mã</p><p>{{ report.assets - report.decoded }} mục chưa giải mã</p><a :href="gameUrl('catalog.sqlite')" download>Tải SQLite ↓</a></details>
      </aside>
      <main><RouterView v-slot="{ Component }"><KeepAlive><component :is="Component"/></KeepAlive></RouterView></main>
    </div>
  </div>
</template>
