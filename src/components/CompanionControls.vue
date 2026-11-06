<script setup>
import { companionCatalog, companionLayer } from '../lib/companions'
const props=defineProps({layers:{type:Array,required:true}})
const emit=defineEmits(['update'])
function change(slot,id){const next=props.layers.filter(l=>l.slot!==slot);if(id!=='')next.push(companionLayer(slot,id));emit('update',next)}
</script>
<template>
  <section class="weapon-equipment" aria-label="Thú cưỡi và thú cưng">
    <p class="eyebrow">THÚ CƯỠI / THÚ CƯNG · CLIENT 4.0.3</p>
    <div class="part-selectors">
      <label v-for="[slot,title,key] in [['mount','Thú cưỡi','mounts'],['pet','Thú cưng','pets']]" :key="slot" class="field">{{title}}
        <select :aria-label="title" :value="layers.find(l=>l.slot===slot)?.companion.id ?? ''" @change="change(slot,$event.target.value)">
          <option value="">Không dùng</option><option v-for="d in companionCatalog[key]" :key="d.id" :value="d.id">{{d.label}} · #{{d.id}} · x{{d.asset.density}}{{ d.riderBinding?.status === 'unverified' ? ' · ghế chưa xác minh' : '' }}</option>
        </select>
      </label>
    </div>
    <p class="muted">Đã đối chiếu {{companionCatalog.mounts.length}} ngoại hình thú cưỡi và {{companionCatalog.pets.length}} pet. Vật phẩm x99/vĩnh viễn dùng chung ngoại hình. Khi cưỡi, dùng nhịp client 25 FPS, ẩn quần theo renderer gốc; {{companionCatalog.mounts.filter(d=>d.mountedAttack?.status==='ready').length}} rig hỗ trợ chiêu đánh #0–#8, #17, #19, #20 khi đã chọn vũ khí; Ngựa nâu bị client cấm đánh.</p>
    <p v-if="layers.some(l=>l.slot==='pet')" class="muted">Pet dùng frame gốc. Đặt cạnh nhân vật 40 đơn vị để xem rõ; đây là bố trí preview, chưa mô phỏng đường đi theo, AI và hành động ngẫu nhiên của pet.</p>
    <p v-for="d in layers.filter(l=>l.visible && l.companion?.warnings?.length)" :key="d.slot" class="muted">{{d.name}}: {{d.companion.warnings.join(' ')}}</p>
    <p v-if="layers.some(l=>l.visible && l.companion?.rig?.kind)" class="muted">Rig nhiều mảnh mới khôi phục đứng/đi theo dữ liệu client; chưa bật tấn công cho các thú này. Các hiệu ứng phụ và tương tác nước chưa được port.</p>
    <details><summary>Các vật phẩm chưa hỗ trợ ({{companionCatalog.inventory.filter(i=>i.status!=='ready').length}})</summary><p v-for="i in companionCatalog.inventory.filter(i=>i.status!=='ready')" :key="`${i.kind}-${i.id}`" class="muted">{{i.name}} · item #{{i.id}}: {{i.reason}}</p></details>
  </section>
</template>
