<script setup>
import { useWorkbench } from '../composables/useWorkbench'
import { gameUrl, imageAsset } from '../lib/catalog'
const { title, table, total, search, category, categories, zoom, decoded, rows, selected, page, pageSize, select } = useWorkbench()
</script>

<template>
  <div class="catalog-page">
          <div class="section-heading"><div><p class="eyebrow">THƯ VIỆN / {{ table }}</p><h1>{{ title }}</h1></div><span>{{ total.toLocaleString() }} kết quả</span></div>

          <div class="filters"><input v-model="search" aria-label="Tìm theo tên hoặc ID" placeholder="Tìm tên, đường dẫn hoặc ID…"><template v-if="table === 'assets'"><select v-model="category" aria-label="Loại asset"><option value="">Mọi loại</option><option v-for="c in categories" :key="c">{{ c }}</option></select><select v-model="zoom" aria-label="Độ phân giải"><option value="">Mọi độ phân giải</option><option v-for="z in ['x1','x2','x3','x4']" :key="z">{{ z }}</option></select><label class="inline"><input v-model="decoded" type="checkbox"> Có ảnh</label></template></div>
          <div class="gallery"><button v-for="row in rows" :key="row.id" class="asset-card" :class="{ chosen: selected?.id === row.id }" @click="select(row)"><div class="thumbnail checker"><img v-if="imageAsset(row, table)?.image" :src="gameUrl(imageAsset(row, table).image)" alt="" loading="lazy"><span v-else>{{ table === 'mobs' ? 'MOB' : 'DATA' }}</span></div><strong :title="row.name || row.source">{{ row.name || row.source }}</strong><small>{{ table === 'assets' ? `${row.width} × ${row.height} · ${row.status}` : `#${row.id}${row.level != null ? ' · Lv.' + row.level : ''}` }}</small></button></div>
          <p v-if="!rows.length" class="empty">Không có kết quả phù hợp bộ lọc.</p>
          <div class="pagination"><button :disabled="page === 0" @click="page--">← Trước</button><span>{{ page + 1 }} / {{ Math.max(1, Math.ceil(total / pageSize)) }}</span><button :disabled="(page + 1) * pageSize >= total" @click="page++">Sau →</button></div>

  </div>
</template>
