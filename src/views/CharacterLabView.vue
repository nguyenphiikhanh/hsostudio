<script setup>
import { ref, onMounted, onActivated, onDeactivated } from 'vue'
import PartDesignPanel from '../components/PartDesignPanel.vue'
import CharacterPreset from '../components/CharacterPreset.vue'
import CharacterAnimation from '../components/CharacterAnimation.vue'
import WorkbenchInspector from '../components/WorkbenchInspector.vue'
import CharacterExports from '../components/CharacterExports.vue'
import { useWorkbench } from '../composables/useWorkbench'
const workbench = useWorkbench()
const { layers, characterClass, activeLayer, scale, updateCharacter, clearCharacter, preview, error } = workbench
const canvas = ref(null), stage = ref(null), tab = ref('equipment'), effect = ref(false)
const tabs = [['equipment','Trang bị'],['animation','Animation'],['tuning','Tinh chỉnh']]
function attachStage() { workbench.canvas.value = canvas.value; workbench.stage.value = stage.value; workbench.draw(); workbench.centerStage() }
onMounted(attachStage)
onActivated(attachStage)
onDeactivated(() => { workbench.canvas.value = null; workbench.stage.value = null })
function tabKey(event, index) {
  const next = event.key==='ArrowRight' ? (index+1)%tabs.length : event.key==='ArrowLeft' ? (index+tabs.length-1)%tabs.length : event.key==='Home' ? 0 : event.key==='End' ? tabs.length-1 : -1
  if(next<0)return
  event.preventDefault();tab.value=tabs[next][0];document.getElementById(`tab-${tab.value}`)?.focus()
}
function focusLayer(index) { activeLayer.value=index }
</script>
<template>
  <div class="character-lab-page">
    <div class="page-heading"><div><p class="eyebrow">NHÂN VẬT</p><h1>Character Lab</h1></div><CharacterExports/></div>
    <section class="composer lab-layout">
      <div class="lab-preview">
        <div class="viewport-heading"><span>Preview trực tiếp · {{ layers.length }} lớp</span><div class="viewport-actions"><button :disabled="effect" @click="workbench.centerStage">Căn giữa</button><label>Zoom <select :disabled="effect" :title="effect?'Hiệu ứng chiêu tự vừa khung':'Phóng to nhân vật'" v-model="scale" aria-label="Zoom nhân vật"><option v-for="s in [1,2,3,4,6,8]" :key="s" :value="s">{{s}}×</option></select></label></div></div>
        <div class="shared-character-viewport">
          <div v-show="!effect" ref="stage" class="stage checker"><canvas ref="canvas" width="2560" height="1920" :style="{ width: `${640 * scale}px`, height: `${480 * scale}px` }" aria-label="Bản xem trước các lớp nhân vật"></canvas><span v-if="!layers.length" class="stage-empty">Chọn Trang bị để thêm bộ phận</span></div>
          <div v-show="effect" id="character-effect-stage"></div>
        </div>
        <div class="direction-heading"><span>Bốn hướng</span><small>Bấm hướng để xem trên preview chính</small></div>
        <CharacterAnimation :layers="layers" v-model:clazz="characterClass" controls-target="#character-animation-controls" effects-target="#character-effect-stage" @effect="effect=$event" @update="preview = $event" @error="error = $event"/>
      </div>
      <aside class="lab-context" aria-label="Chỉnh sửa nhân vật">
        <div class="context-tabs" role="tablist" aria-label="Công cụ nhân vật"><button v-for="([key,label],i) in tabs" :id="`tab-${key}`" :key="key" role="tab" :aria-selected="tab===key" :tabindex="tab===key?0:-1" @keydown="tabKey($event,i)" :aria-controls="`panel-${key}`" @click="tab=key">{{label}}</button></div>
        <div id="panel-equipment" v-show="tab==='equipment'" role="tabpanel" aria-labelledby="tab-equipment"><PartDesignPanel/><CharacterPreset :layers="layers" v-model:clazz="characterClass" @update="updateCharacter" @focus="focusLayer"/></div>
        <div id="panel-animation" v-show="tab==='animation'" role="tabpanel" aria-labelledby="tab-animation"><div id="character-animation-controls"></div></div>
        <div id="panel-tuning" v-show="tab==='tuning'" role="tabpanel" aria-labelledby="tab-tuning"><WorkbenchInspector/><button class="clear-layers" @click="clearCharacter">Xóa các lớp</button></div>
      </aside>
    </section>
  </div>
</template>
