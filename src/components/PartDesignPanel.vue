<script setup>
import {useWorkbench} from '../composables/useWorkbench'
import {usePartDesigns} from '../composables/usePartDesigns'
import {DESIGN_SLOTS} from '../lib/partDesign/templates'
import SqlCopyPanel from './SqlCopyPanel.vue'
import schemaSQL from '../lib/partDesign/h5Schema.sql?raw'
import {designSQL,h5Content} from '../lib/partDesign/mysql'
const editor=usePartDesigns(useWorkbench())
const {slot,key,id,label,sourceId,itemId,templates,template,sourceItem,uploads,drafts,busy,error,notice,active,restored,sqlDocument}=editor
function file(event,resource){const f=event.target.files?.[0];event.target.value='';editor.upload(resource,f)}
function json(event){const f=event.target.files?.[0];event.target.value='';editor.importJSON(f)}
</script>
<template>
  <details class="part-design-panel" data-testid="part-design-panel">
    <summary>Thiết kế part · PNG / JSON / MySQL <small v-if="drafts.length">({{drafts.length}} nháp)</small></summary>
    <p class="muted">Kế thừa nguyên bố cục frame, anchor và rig của mẫu. Ảnh mới chỉ preview trong tab; không sửa nguồn. Tải gói thiết kế trước khi reload.</p>
    <details class="design-schema"><summary>Khởi tạo MySQL H5 · chạy một lần</summary><p class="muted">Chọn database H5 và chạy toàn bộ script, gồm DELIMITER. MySQL 8.0.21+; khuyến nghị 8.4. Chỉ tạo h5_* tables/procedure, không đổi bảng HSO cũ.</p><SqlCopyPanel :sql="schemaSQL" title="SQL khởi tạo MySQL H5"/></details>
    <label class="field">Loại part<select v-model="slot" aria-label="Loại part thiết kế" :disabled="busy"><option v-for="[value,text] in DESIGN_SLOTS" :key="value" :value="value">{{text}}</option></select></label>
    <label class="field">Mẫu frame / rig<select v-model="key" aria-label="Mẫu part thiết kế" :disabled="busy"><option v-for="t in templates" :key="t.key" :value="t.key">#{{t.id}} · {{t.label}}</option></select></label>
    <template v-if="template">
      <details class="design-source"><summary>Tải tài nguyên mẫu gốc</summary>
        <div v-for="(asset,resource) in template.assets" :key="resource" class="design-resource">
          <p class="path">{{resource==='splash'?'WPS tấn công':'PNG chính'}} · {{asset.width}} × {{asset.height}} · x{{asset.density||1}}<br>{{asset.source}}</p>
          <button :disabled="busy" :aria-label="`Tải PNG mẫu ${resource}`" @click="editor.downloadPNG(resource)">Tải PNG {{resource==='splash'?'WPS':'part'}}</button>
        </div>
        <div class="design-actions"><button :disabled="busy" @click="editor.exportOriginal('json')">JSON mẫu</button><button :disabled="busy" @click="editor.exportOriginal('sql')">Xem SQL mẫu H5</button><button :disabled="busy" @click="editor.exportOriginal()">ZIP mẫu</button></div>
      </details>
      <hr>
      <label class="field">Nhập JSON thiết kế đã xuất (tùy chọn)<input type="file" accept=".json,application/json" aria-label="Nhập JSON thiết kế" :disabled="busy" @change="json"></label>
      <p v-if="restored" class="muted">JSON #{{restored.id}} đã nạp. Chọn lại PNG đúng checksum để khôi phục.</p>
      <div v-for="(asset,resource) in template.assets" :key="resource" class="design-resource">
        <label class="field">{{resource==='splash'?'PNG WPS tấn công (tùy chọn)':'PNG thiết kế chính'}}<input type="file" accept="image/png,.png" :aria-label="`PNG thiết kế ${resource}`" :disabled="busy" @change="file($event,resource)"></label>
        <p v-if="uploads[resource]" class="muted" :data-testid="`design-upload-${resource}`">Hợp lệ: {{uploads[resource].meta.width}} × {{uploads[resource].meta.height}} · x{{uploads[resource].meta.density}}</p>
      </div>
      <img v-if="uploads.sheet" :src="uploads.sheet.url" alt="PNG thiết kế nháp" class="design-image checker">
      <div class="field-grid"><label class="field">ID thiết kế / part mới<input v-model.number="id" type="number" min="0" :max="2147483647" aria-label="ID thiết kế mới" :disabled="busy"></label><label class="field">ID vật phẩm H5<input v-model.number="itemId" type="number" min="0" max="2147483647" aria-label="ID vật phẩm MySQL" :disabled="busy"></label></div>
      <label class="field">Tên thiết kế<input v-model="label" maxlength="255" aria-label="Tên thiết kế part" :disabled="busy"></label>
      <label class="field">Nguồn chỉ số HSO · tùy chọn<select v-model="sourceId" aria-label="Mẫu vật phẩm MySQL" :disabled="busy"><option v-if="!template.items.length" value="">Không có vật phẩm mẫu</option><option v-for="i in template.items" :key="`${i.table}-${i.row.id}`" :value="String(i.row.id)">{{i.table}} #{{i.row.id}} · {{i.row.name}} · part {{i.row.part??'—'}}</option></select></label>
      <p v-if="!sourceItem" class="invalid">Không có vật phẩm mẫu: tạo part và vật phẩm H5 với chỉ số trống; bạn có thể bổ sung trong MySQL.</p>
      <button class="primary design-create" :disabled="busy" @click="editor.create">{{busy?'Đang kiểm tra…':'Preview / cập nhật nháp'}}</button>
      <p v-if="active" class="badge">ĐANG PREVIEW NHÁP #{{active.id}} · {{active.label}}</p>
      <p class="muted">SQL đăng ký asset, part, rig, animation và vật phẩm trong h5_* tables. Chép PNG theo đường dẫn được ghi rồi chạy SQL. ID gợi ý không kiểm tra database H5 của bạn. Server H5 cần đọc contract này; không dùng SQL cho server Java HSO cũ. Xuất thư viện part vẫn dùng danh mục gốc.</p>
    </template>
    <section v-if="sqlDocument" class="design-sql-view" aria-label="SQL mẫu H5">
      <p v-for="a in h5Content(sqlDocument).assets" :key="a.key" class="path">PNG → assets/{{a.path}}</p>
      <SqlCopyPanel :sql="designSQL(sqlDocument)" title="SQL đăng ký mẫu H5"/>
    </section>
    <p v-if="error" class="invalid" role="alert">{{error}}</p><p v-if="notice" class="muted" role="status">{{notice}}</p>
    <section v-if="drafts.length" class="design-drafts" aria-label="Thiết kế part trong tab">
      <h3>Thiết kế trong tab</h3>
      <article v-for="record in drafts" :key="`${record.document.slot}-${record.document.id}`" class="design-draft">
        <strong>{{record.document.label}}</strong><p class="path">{{record.document.slot}} #{{record.document.id}} · H5 item #{{record.document.h5Item?.id??'—'}}</p>
        <div class="design-actions"><button :disabled="busy" @click="editor.previewRecord(record)">Preview #{{record.document.id}}</button><button :disabled="busy" @click="editor.restore(record)">Bỏ preview</button><button :disabled="busy" @click="editor.remove(record)">Xóa nháp</button></div>
        <div class="design-actions"><button v-for="(_,resource) in record.files" :key="resource" :disabled="busy" :aria-label="`Tải PNG nháp ${resource}`" @click="editor.downloadPNG(resource,record)">PNG {{resource}}</button><button :disabled="busy" @click="editor.exportRecord(record,'json')">Xuất JSON thiết kế</button><button class="primary" :disabled="busy" @click="editor.exportRecord(record)">Tải gói thiết kế ZIP</button></div>
        <details class="design-sql-view"><summary>SQL MySQL H5 · xem / sao chép</summary>
          <p v-for="a in h5Content(record.document).assets" :key="a.key" class="path">PNG → assets/{{a.path}}</p>
          <p class="muted">Chạy SQL khởi tạo một lần trước; sau đó chép PNG và chạy câu CALL này. ID đã có sẽ báo lỗi, không ghi đè. Server H5 cần hỗ trợ rig/animation contract v1 và làm mới content_revision.</p>
          <SqlCopyPanel :sql="designSQL(record.document)" :title="`SQL thiết kế H5 ${record.document.slot}-${record.document.id}`"/>
        </details>
      </article>
    </section>
  </details>
</template>
