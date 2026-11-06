<script setup>
import { computed, ref, watch } from 'vue'
import { combatCatalog } from '../lib/combat'
import { SKILL_CATEGORIES } from '../lib/clientSkillCatalog'
import { createAttackTrial } from '../lib/attackTrial'

const props = defineProps({ trial: { type: Object, required: true }, clientVerified: { type: Boolean, default: false }, mountedSkillIds: {type:Array,default:null} })
const emit = defineEmits(['update'])
const catalog = combatCatalog()
const clazz = ref(props.trial.clazz), skillId = ref(props.trial.skillId), level = ref(0)
const preparePose = ref(props.trial.preparePose), strikePose = ref(props.trial.strikePose), prepareAnchor = ref(props.trial.prepareAnchor), strikeAnchor = ref(props.trial.strikeAnchor)
const profile = computed(() => catalog.classes.find(profile => profile.id === clazz.value))
const skill = computed(() => profile.value.skills.find(skill => skill.id === skillId.value))
const detail = computed(() => skill.value.levels[level.value])
const clientSkillCategory = computed(() => SKILL_CATEGORIES[skillId.value])
function poseChanged(stage) {
  if (stage === 'prepare') prepareAnchor.value = preparePose.value
  else strikeAnchor.value = strikePose.value
}
watch(clazz, () => { skillId.value = 0; level.value = 0 })
watch(skillId, () => { level.value = 0 })
watch(() => props.trial.clazz, value => { if (value !== clazz.value) clazz.value = value })
watch([clazz, skillId, preparePose, strikePose, prepareAnchor, strikeAnchor], () => {
  emit('update', createAttackTrial({ clazz: clazz.value, skillId: skillId.value, preparePose: preparePose.value, strikePose: strikePose.value, prepareAnchor: prepareAnchor.value, strikeAnchor: strikeAnchor.value }))
}, { immediate: true })
</script>

<template>
  <div class="attack-lab" aria-label="Đối chiếu tấn công">
    <p class="eyebrow">{{ clientVerified ? 'TẤN CÔNG · CLIENT HSO 4.0.3' : 'TẤN CÔNG · BẢN THỬ TỪ POSE GỐC' }}</p>
    <div class="motion-controls">
      <label class="field">Phái<select v-model.number="clazz" aria-label="Phái tấn công"><option v-for="profile in catalog.classes" :key="profile.id" :value="profile.id">{{ profile.label }}</option></select></label>
      <label class="field">Kỹ năng server<select v-model.number="skillId" aria-label="Kỹ năng tấn công"><option v-for="skill in profile.skills" :key="skill.id" :value="skill.id" :disabled="mountedSkillIds !== null && !mountedSkillIds.includes(skill.id)">#{{ skill.id }} · {{ skill.name }}</option></select></label>
      <label class="field">Cấp kỹ năng<select v-model.number="level" aria-label="Cấp kỹ năng tấn công"><option v-for="(_, i) in skill.levels" :key="i" :value="i">{{ i + 1 }}</option></select></label>
    </div>
    <p class="muted" data-testid="attack-evidence">{{ profile.label }} · {{ profile.weapon_label }} (item type {{ profile.weapon_type }}) · {{ skill.name }} · cooldown {{ detail.delay }} ms · range {{ skill.range }} · typePaint {{ skill.typePaint }} · subEff {{ skill.subEff }} · performDur {{ skill.performDur }}</p>
    <p class="path">Nguồn server: {{ profile.source }} · SHA-256 {{ profile.sha256 }}</p>
    <p class="muted">{{ skill.detail }}</p>
    <div v-if="!clientVerified" class="motion-controls">
      <label class="field">Pose A<select v-model.number="preparePose" aria-label="Pose tấn công A" @change="poseChanged('prepare')"><option v-for="i in 5" :key="i" :value="i - 1">{{ i - 1 }}</option></select></label>
      <label class="field">Anchor A<select v-model.number="prepareAnchor" aria-label="Anchor tấn công A"><option v-for="i in 6" :key="i" :value="i - 1">{{ i - 1 }}</option></select></label>
      <label class="field">Pose B<select v-model.number="strikePose" aria-label="Pose tấn công B" @change="poseChanged('strike')"><option v-for="i in 5" :key="i" :value="i - 1">{{ i - 1 }}</option></select></label>
      <label class="field">Anchor B<select v-model.number="strikeAnchor" aria-label="Anchor tấn công B"><option v-for="i in 6" :key="i" :value="i - 1">{{ i - 1 }}</option></select></label>
      <span class="badge">0 → {{ preparePose }} → {{ strikePose }} → 0</span>
    </div>
    <p v-if="clientVerified && skillId <= 4" class="muted">Kỹ năng #{{ skillId }} dùng timeline cơ thể/WPS đối chiếu client 4.0.3. Chiêu #1–#4 có preview sprite hiệu ứng chính trong khung mục tiêu mẫu; hiệu ứng phụ và tương tác gameplay chưa mô phỏng.</p>
    <p v-else-if="clientVerified" class="muted">Kỹ năng #{{ skillId }} · nhóm {{ clientSkillCategory }}. Preview hiệu ứng chính theo client 4.0.3 nằm ngay dưới khung animation; hiệu ứng phụ và tương tác gameplay chưa mô phỏng.</p>
    <p v-else-if="['passive','self-buff','party-buff'].includes(clientSkillCategory)" class="muted">Kỹ năng #{{ skillId }} thuộc nhóm nội tại/buff; không có chuỗi đánh vũ khí.</p>
    <p v-else class="muted">Tên kỹ năng, type vũ khí và cooldown lấy từ server. Chuỗi pose, anchor và FPS đang thử nghiệm; cooldown không phải thời lượng animation. Các phái dùng chung chuỗi thử, chưa xác nhận động tác riêng theo phái. Vũ khí được ẩn ở chiêu chưa có mapping client.</p>
  </div>
</template>
