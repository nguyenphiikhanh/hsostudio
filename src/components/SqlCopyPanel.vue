<script setup>
import {ref,watch} from 'vue'
const props=defineProps({sql:{type:String,required:true},title:{type:String,required:true}})
const field=ref(null),status=ref('')
watch(()=>props.sql,()=>{status.value=''})
async function copy(text){
  status.value=''
  try{await navigator.clipboard.writeText(text);status.value=props.sql===text?'Đã sao chép SQL.':'SQL đã thay đổi; hãy sao chép lại.'}
  catch{field.value?.focus();field.value?.select();status.value='Không truy cập được clipboard. SQL đã được chọn; nhấn Ctrl+C hoặc Cmd+C để sao chép.'}
}
</script>
<template>
  <div class="sql-copy-panel">
    <label class="field">{{title}}<textarea ref="field" :value="sql" :aria-label="title" readonly rows="10" spellcheck="false" wrap="off"></textarea></label>
    <button :disabled="!sql" @click="copy(sql)">Sao chép SQL</button>
    <p v-if="status" class="muted" role="status">{{status}}</p>
  </div>
</template>
