<script setup>
import {useWorkbench} from '../composables/useWorkbench'
import {usePartDesigns} from '../composables/usePartDesigns'
import {DESIGN_SLOTS} from '../lib/partDesign/templates'
import {designSQL} from '../lib/partDesign/mysql'
const editor=usePartDesigns(useWorkbench())
const {slot,key,id,label,sourceId,itemId,templates,template,sourceItem,uploads,drafts,busy,error,notice,active,restored}=editor
function file(event,resource){const f=event.target.files?.[0];event.target.value='';editor.upload(resource,f)}
function json(event){const f=event.target.files?.[0];event.target.value='';editor.importJSON(f)}
</script>
<template>
  <details class="part-design-panel" data-testid="part-design-panel">
    <summary>Thiết kế part · PNG / JSON / MySQL <small v-if="drafts.length">({{drafts.length}} nháp)</small></summary>
    <p class="muted">Kế thừa nguyên bố cục frame, anchor và rig của mẫu. Ảnh mới chỉ preview trong tab; không sửa nguồn. Tải gói thiết kế trước khi reload.</p>
    <label class="field">Loại part<select v-model="slot" aria-label="Loại part thiết kế" :disabled="busy"><option v-for="[value,text] in DESIGN_SLOTS" :key="value" :value="value">{{text}}</option></select></label>
    <label class="field">Mẫu frame / rig<select v-model="key" aria-label="Mẫu part thiết kế" :disabled="busy"><option v-for="t in templates" :key="t.key" :value="t.key">#{{t.id}} · {{t.label}}</option></select></label>
    <template v-if="template">
      <details class="design-source"><summary>Tải tài nguyên mẫu gốc</summary>
        <div v-for="(asset,resource) in template.assets" :key="resource" class="design-resource">
          <p class="path">{{resource==='splash'?'WPS tấn công':'PNG chính'}} · {{asset.width}} × {{asset.height}} · x{{asset.density||1}}<br>{{asset.source}}</p>
          <button :disabled="busy" :aria-label="`Tải PNG mẫu ${resource}`" @click="editor.downloadPNG(resource)">Tải PNG {{resource==='splash'?'WPS':'part'}}</button>
        </div>
        <div class="design-actions"><button :disabled="busy" @click="editor.exportOriginal('json')">JSON mẫu</button><button :disabled="busy" @click="editor.exportOriginal('sql')">SQL mẫu</button><button :disabled="busy" @click="editor.exportOriginal()">ZIP mẫu</button></div>
      </details>
      <hr>
      <label class="field">Nhập JSON thiết kế đã xuất (tùy chọn)<input type="file" accept=".json,application/json" aria-label="Nhập JSON thiết kế" :disabled="busy" @change="json"></label>
      <p v-if="restored" class="muted">JSON #{{restored.id}} đã nạp. Chọn lại PNG đúng checksum để khôi phục.</p>
      <div v-for="(asset,resource) in template.assets" :key="resource" class="design-resource">
        <label class="field">{{resource==='splash'?'PNG WPS tấn công (tùy chọn)':'PNG thiết kế chính'}}<input type="file" accept="image/png,.png" :aria-label="`PNG thiết kế ${resource}`" :disabled="busy" @change="file($event,resource)"></label>
        <p v-if="uploads[resource]" class="muted" :data-testid="`design-upload-${resource}`">Hợp lệ: {{uploads[resource].meta.width}} × {{uploads[resource].meta.height}} · x{{uploads[resource].meta.density}}</p>
      </div>
      <img v-if="uploads.sheet" :src="uploads.sheet.url" alt="PNG thiết kế nháp" class="design-image checker">
      <div class="field-grid"><label class="field">ID thiết kế / part mới<input v-model.number="id" type="number" min="0" :max="['pants','shirt','weapon'].includes(slot)?127:32767" aria-label="ID thiết kế mới" :disabled="busy"></label><label class="field">ID vật phẩm MySQL<input v-model.number="itemId" type="number" min="0" max="32767" aria-label="ID vật phẩm MySQL" :disabled="busy||!sourceItem"></label></div>
      <label class="field">Tên thiết kế<input v-model="label" maxlength="255" aria-label="Tên thiết kế part" :disabled="busy"></label>
      <label class="field">Mẫu vật phẩm SQL · kế thừa chỉ số<select v-model="sourceId" aria-label="Mẫu vật phẩm MySQL" :disabled="busy"><option v-if="!template.items.length" value="">Không có vật phẩm mẫu</option><option v-for="i in template.items" :key="`${i.table}-${i.row.id}`" :value="String(i.row.id)">{{i.table}} #{{i.row.id}} · {{i.row.name}} · part {{i.row.part??'—'}}</option></select></label>
      <p v-if="!sourceItem" class="invalid">Mẫu này chưa có vật phẩm tương ứng: vẫn xuất PNG/JSON, SQL chỉ ghi chú và không tạo INSERT.</p>
      <button class="primary design-create" :disabled="busy" @click="editor.create">{{busy?'Đang kiểm tra…':'Preview / cập nhật nháp'}}</button>
      <p v-if="active" class="badge">ĐANG PREVIEW NHÁP #{{active.id}} · {{active.label}}</p>
      <p class="muted">SQL chỉ tạo template item3/item4. PNG/frame/rig nằm trong gói riêng. Thú/pet mới cần nối mapping Java; ID gợi ý chưa đối chiếu database đang chạy. Xuất thư viện part vẫn dùng nguồn gốc; dùng gói thiết kế dưới đây để lưu nháp.</p>
    </template>
    <p v-if="error" class="invalid" role="alert">{{error}}</p><p v-if="notice" class="muted" role="status">{{notice}}</p>
    <section v-if="drafts.length" class="design-drafts" aria-label="Thiết kế part trong tab">
      <h3>Thiết kế trong tab</h3>
      <article v-for="record in drafts" :key="`${record.document.slot}-${record.document.id}`" class="design-draft">
        <strong>{{record.document.label}}</strong><p class="path">{{record.document.slot}} #{{record.document.id}} · MySQL {{record.document.serverItem?.table??'chưa có mẫu'}} #{{record.document.serverItem?.row.id??'—'}}</p>
        <div class="design-actions"><button :disabled="busy" @click="editor.previewRecord(record)">Preview #{{record.document.id}}</button><button :disabled="busy" @click="editor.restore(record)">Bỏ preview</button><button :disabled="busy" @click="editor.remove(record)">Xóa nháp</button></div>
        <div class="design-actions"><button v-for="(_,resource) in record.files" :key="resource" :disabled="busy" :aria-label="`Tải PNG nháp ${resource}`" @click="editor.downloadPNG(resource,record)">PNG {{resource}}</button><button :disabled="busy" @click="editor.exportRecord(record,'json')">Xuất JSON thiết kế</button><button :disabled="busy" @click="editor.exportRecord(record,'sql')">Xuất SQL thiết kế</button><button class="primary" :disabled="busy" @click="editor.exportRecord(record)">Tải gói thiết kế ZIP</button></div>
        <details><summary>Xem SQL và phạm vi tích hợp</summary><p class="muted">{{record.document.serverIntegration.remaining.join(' ')}}</p><pre>{{designSQL(record.document)}}</pre></details>
      </article>
    </section>
  </details>
</template>
