import {ref,shallowRef,computed,watch,onMounted} from 'vue'
import {loadMap,loadMapIndex} from '../lib/maps/mapData'
import {collisionGrid} from '../lib/maps/mapGeometry.js'
export function useMapViewer() {
  const imported=new Map(),importedEntries=ref([])
  const index=shallowRef(null),query=ref(''),selectedId=ref('0'),data=shallowRef(null),loading=ref(false),error=ref('')
  const selectedCell=ref(null),selectedObject=ref(null),hoverCell=ref(null)
  const layers=ref({terrain:true,objects:true,grid:false,collision:false,warps:true,spawns:false})
  const normalize=s=>String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/đ/g,'d').toLowerCase()
  const options=computed(()=>[...(index.value?.maps??[]),...importedEntries.value].filter(m=>normalize(`${m.id} ${m.name}`).includes(normalize(query.value)))||[])
  const collision=computed(()=>data.value?collisionGrid(data.value.map,data.value.templates):[])
  let generation=0
  async function open() {
    const current=++generation
    loading.value=true;error.value='';data.value=null;selectedCell.value=null;selectedObject.value=null;hoverCell.value=null
    try {const result=imported.get(selectedId.value)??await loadMap(selectedId.value);if(current===generation)data.value=result}
    catch(e){if(current===generation)error.value=e.message}
    finally{if(current===generation)loading.value=false}
  }
  watch(selectedId,open)
  async function reload() {
    loading.value=true
    try {if(!index.value)index.value=await loadMapIndex();await open()}
    catch(e){error.value=e.message;loading.value=false}
  }
  onMounted(reload)
  function registerMap(result){
    const key=String(result.map.id);imported.set(key,result)
    importedEntries.value=[...importedEntries.value.filter(m=>String(m.id)!==key),{id:result.map.id,name:result.map.name+' · PNG nháp',width:result.map.width,height:result.map.height,status:'ready'}]
    if(selectedId.value===key)open();else selectedId.value=key
  }
  return {registerMap,index,query,selectedId,data,loading,error,selectedCell,selectedObject,hoverCell,layers,options,collision,reload}
}
