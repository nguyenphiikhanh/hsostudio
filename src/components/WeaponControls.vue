<script setup>
import { computed, ref, watch } from 'vue'
import { query } from '../lib/catalog'
import { clientWeaponLayer } from '../lib/clientWeapon'
import { weaponEquipmentFacts } from '../lib/weaponEquipment'

const emit = defineEmits(['weapon'])
const props = defineProps({ clazz: { type: Number, required: true } })
const level = ref(1), itemId = ref(''), cosmeticId = ref('')
const records = query('SELECT id,name,clazz,type,part,level,color FROM item3 WHERE type IN (8,9,10,11,24) ORDER BY level,part,color,id')
const normal = computed(() => records.filter(item => item.type !== 24 && (item.clazz === props.clazz || item.clazz === 4)))
const cosmetics = computed(() => records.filter(item => item.type === 24 && (item.clazz === props.clazz || item.clazz === 4)))
const distinctParts = computed(() => new Set(normal.value.map(item => item.part)).size)
const selected = computed(() => [itemId.value, cosmeticId.value].filter(id => id !== '').map(id => records.find(item => item.id === Number(id))).filter(Boolean))
const rendered = computed(() => {
  const item = records.find(item => item.id === Number(itemId.value))
  return itemId.value !== '' && item && eligible(item) ? clientWeaponLayer(item) : null
})
watch(rendered, value => emit('weapon', value), { immediate: true })
const facts = computed(() => selected.value.map(item => weaponEquipmentFacts(item, props.clazz, level.value)))
function eligible(item) {
  return Number.isInteger(level.value) && level.value >= 1 && weaponEquipmentFacts(item, props.clazz, level.value).eligible
}
watch([() => props.clazz, level], () => {
  for (const selection of [itemId, cosmeticId]) {
    const item = records.find(item => item.id === Number(selection.value))
    if (selection.value !== '' && (!item || !eligible(item))) selection.value = ''
  }
})
</script>

<template>
  <section class="weapon-equipment" aria-label="Vũ khí HSO đã đối chiếu">
    <p class="eyebrow">VẬT PHẨM VŨ KHÍ HSO · DỮ LIỆU SERVER</p>
    <label class="field">Cấp nhân vật để đối chiếu<input v-model.number="level" aria-label="Cấp nhân vật để đối chiếu" type="number" min="1" step="1"></label>
    <p class="muted">{{ normal.length }} mẫu vật phẩm của phái · {{ distinctParts }} giá trị part. Nhiều vật phẩm dùng cùng part; số sheet PNG không phải số món có thể trang bị.</p>
    <label class="field">Vũ khí thường · wear[0]<select v-model="itemId" aria-label="Vũ khí thường HSO"><option value="">Chọn vật phẩm để đối chiếu</option><option v-for="item in normal" :key="item.id" :value="item.id" :disabled="!eligible(item)">#{{ item.id }} · {{ item.name }} · Lv.{{ item.level }} · màu {{ item.color }} · part {{ item.part }}</option></select></label>
    <label class="field">Vũ khí thời trang · wear[17]<select v-model="cosmeticId" aria-label="Vũ khí thời trang HSO"><option value="">Không chọn</option><option v-for="item in cosmetics" :key="item.id" :value="item.id" :disabled="!eligible(item)">#{{ item.id }} · {{ item.name }} · Lv.{{ item.level }} · part {{ item.part }}</option></select></label>
    <div v-for="item in facts" :key="item.id" data-testid="verified-weapon-facts">
      <strong>#{{ item.id }} · {{ item.name }}</strong>
      <dl><dt>Slot server</dt><dd>wear[{{ item.wearSlot }}]</dd><dt>clazz / type / part</dt><dd>{{ item.clazz }} / {{ item.type }} / {{ item.part }}</dd><template v-if="item.cosmeticWeaponId !== null"><dt>idWeapon thời trang</dt><dd>{{ item.cosmeticWeaponId }} (part + 41)</dd></template></dl>
    </div>
    <p class="muted" data-testid="weapon-visual-status">{{ rendered ? 'Đang vẽ vũ khí thường theo client HSO 4.0.3: type = 50 + clazz, id = part; crop/offset/hướng/lớp lấy từ mã client. Chọn Tấn công và kỹ năng #0 để xem WPS gốc.' : itemId !== '' ? 'Catalog thiếu mapping client hoặc ảnh tương ứng. Chạy npm run prepare:game rồi tải lại Studio.' : 'Chọn vũ khí thường để preview theo client HSO 4.0.3. Vũ khí thời trang vẫn chỉ đối chiếu; chưa triển khai renderer hiệu ứng thời trang.' }}</p>
    <p v-if="rendered" class="path">{{ rendered.asset.source }} · {{ rendered.asset.density === 4 ? 'x4' : 'x1 fallback' }} · đòn đánh dùng WPS x1 gốc trong client</p>
    <details><summary>Nguồn kiểm chứng trang bị</summary><p class="path">UseItem.java: ProcessItem3 → kiểm tra phái/cấp<br>Player.java: player_wear → type 8–11 vào wear[0], type 24 vào wear[17]<br>Service.java: send_wear → gửi clazz/type/icon/part<br>Service.java: get_id_weapon → wear[17].part + 41<br>MessageHandler.java: -52 → trả ảnh theo type/id do client yêu cầu; không xác lập ánh xạ item sang sheet</p></details>
  </section>
</template>
