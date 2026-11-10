import {computed,ref,watch,onUnmounted,nextTick} from 'vue'
import {designTemplates,nextDesignId,reservedNativeIds} from '../lib/partDesign/templates'
import {makeDesign,designLayer,validateRestoredDesign} from '../lib/partDesign/schema'
import {readDesignPNG,readSourcePNG,exportDesign} from '../lib/partDesign/files'
import {releasePreviewImage,download} from '../lib/export'
const clone=value=>JSON.parse(JSON.stringify(value))

export function usePartDesigns({layers,characterClass,updateCharacter}) {
  const slot=ref('pants'),key=ref(''),id=ref(0),label=ref(''),sourceId=ref(''),itemId=ref(0)
  const uploads=ref({}),drafts=ref([]),busy=ref(false),error=ref(''),notice=ref(''),restored=ref(null),sqlDocument=ref(null)
  const urls=new Set()
  const templates=computed(()=>designTemplates(slot.value,characterClass.value))
  const template=computed(()=>templates.value.find(t=>t.key===key.value))
  const sourceItem=computed(()=>template.value?.items.find(i=>String(i.row.id)===String(sourceId.value)))
  const active=computed(()=>layers.value.find(l=>l.slot===slot.value)?.customDesign)
  function sweep(){
    const used=new Set([...Object.values(uploads.value).map(v=>v.url),...drafts.value.flatMap(d=>Object.values(d.images))])
    for(const url of urls)if(!used.has(url)){releasePreviewImage(url);urls.delete(url)}
  }
  let generation=0
  function configure(){
    generation++;uploads.value={};restored.value=null;sqlDocument.value=null;error.value='';notice.value=''
    sweep();const t=template.value;if(!t)return
    const used=drafts.value.filter(d=>d.document.slot===slot.value).map(d=>d.document.id)
    id.value=Math.max(nextDesignId(templates.value,slot.value),...used.map(n=>n+1))
    label.value=`${t.label} · thiết kế mới`;sourceId.value=String(t.items[0]?.row.id??'')
    itemId.value=Math.max(100000,...drafts.value.map(d=>(d.document.h5Item?.id??0)+1))
  }
  watch([slot,characterClass],()=>{
    const current=layers.value.find(l=>l.slot===slot.value)
    key.value=templates.value.find(t=>t.key===current?.customDesign?.templateKey||(!current?.customDesign&&String(t.id)===String(current?.partId)))?.key??templates.value[0]?.key??''
    configure()
  },{immediate:true})
  watch(key,configure)

  async function run(action){
    if(busy.value)return
    busy.value=true;error.value='';notice.value=''
    try{await action()}catch(e){error.value=e.message}finally{busy.value=false}
  }
  async function upload(resource,file){
    if(!file)return
    return run(async()=>{
      const t=template.value,version=generation
      const image=await readDesignPNG(file,t.assets[resource])
      if(version!==generation){releasePreviewImage(image.url);throw new Error('Đã đổi mẫu; hãy chọn lại PNG')}
      const expected=restored.value?.resources[resource]
      if(restored.value&&(!expected||expected.sha256!==image.meta.sha256)){releasePreviewImage(image.url);throw new Error('PNG không khớp SHA-256 trong JSON thiết kế')}
      image.meta.file=`${resource}.png`;urls.add(image.url)
      uploads.value={...uploads.value,[resource]:image};sweep()
      notice.value=`Đã kiểm tra PNG ${resource}: ${image.meta.width} × ${image.meta.height} · x${image.meta.density}`
    })
  }
  function metadata(){return Object.fromEntries(Object.entries(uploads.value).map(([k,v])=>[k,v.meta]))}
  function item(){return sourceItem.value?{table:sourceItem.value.table,sourceId:sourceItem.value.row.id,row:{...sourceItem.value.row}}:null}
  function create(){return run(async()=>{
    const t=template.value
    if(!uploads.value.sheet)throw new Error('Hãy tải lên PNG chính trước khi tạo thiết kế')
    const existing=drafts.value.find(d=>d.document.slot===slot.value&&d.document.id===id.value)
    if(!existing&&drafts.value.length>=20)throw new Error('Tối đa 20 thiết kế trong tab; tải gói và xóa bớt nháp trước khi thêm')
    if(templates.value.some(v=>Number(v.id)===id.value)||reservedNativeIds(t).includes(id.value))throw new Error('ID thiết kế trùng dữ liệu gốc hoặc nháp; chọn ID mới')
    const sql=item()
    if(drafts.value.some(d=>d!==existing&&d.document.h5Item?.id===itemId.value))throw new Error('ID vật phẩm H5 trùng nháp; chọn ID mới')
    const resources=metadata()
    if(restored.value&&Object.keys(restored.value.resources).some(k=>!resources[k]))throw new Error('Cần chọn đủ PNG trong JSON đã nhập')
    const doc=makeDesign(t,{id:id.value,label:label.value,item:sql,resources,itemId:itemId.value})
    const record={document:doc,template:clone(t),files:Object.fromEntries(Object.entries(uploads.value).map(([k,v])=>[k,v.bytes])),images:Object.fromEntries(Object.entries(uploads.value).map(([k,v])=>[k,v.url]))}
    if(existing)record.previous=existing.previous
    drafts.value=existing?drafts.value.map(d=>d===existing?record:d):[...drafts.value,record];apply(record);sweep()
    notice.value='Đã tạo và preview thiết kế nháp. Tải gói thiết kế để giữ PNG/JSON; sao chép SQL H5 trước khi reload.'
  })}
  function apply(record){
    const current=layers.value.find(l=>l.slot===record.document.slot)
    if(current?.customDesign){record.previous=drafts.value.find(d=>d.document.id===current.customDesign.id&&d.document.slot===current.slot)?.previous??null}
    else record.previous=current?clone(current):null
    const replacement=designLayer(record.template,record.document,record.images),index=layers.value.findIndex(l=>l.slot===record.document.slot)
    updateCharacter(index<0?[...layers.value,replacement]:layers.value.map((l,i)=>i===index?replacement:l))
  }
  function restore(record){
    const current=layers.value.find(l=>l.slot===record.document.slot)
    if(current?.customDesign?.id!==record.document.id)return
    updateCharacter(record.previous?layers.value.map(l=>l.slot===record.document.slot?clone(record.previous):l):layers.value.filter(l=>l.slot!==record.document.slot))
  }
  function previewRecord(record){return run(async()=>{if(record.document.slot==='weapon'&&characterClass.value!==record.template.clazz){characterClass.value=record.template.clazz;await nextTick()}apply(record)})}
  function remove(record){restore(record);drafts.value=drafts.value.filter(d=>d!==record);sweep()}
  async function exportRecord(record,format){return run(()=>{if(format==='sql'){sqlDocument.value=record.document;return}return exportDesign(record.document,record.files,format)})}
  async function exportOriginal(format='zip') {return run(async()=>{
    const t=template.value
    const files={},resources={}
    for(const [key,asset] of Object.entries(t.assets)){const r=await readSourcePNG(asset);files[key]=r.bytes;resources[key]={...r.meta,file:`${key}.png`}}
    // Preserve a matching HSO item only as provenance for the original part, never as an H5 item grant.
    const source=sourceItem.value
    const matching=source&&(!['pants','shirt'].includes(t.slot)||source.row.part===Number(t.id))?source:null
    const doc=makeDesign(t,{id:['mount','pet'].includes(t.slot)?t.id:Number(t.id),label:t.label,item:matching,resources,reference:true})
    if(format==='sql'){sqlDocument.value=doc;return}
    return exportDesign(doc,files,format)
  })}
  function downloadPNG(resource,record){return run(async()=>{
    if(record)return download(`${record.document.slot}-${record.document.id}-${resource}.png`,new Blob([record.files[resource]],{type:'image/png'}))
    const t=template.value,r=await readSourcePNG(t.assets[resource]);download(`${t.slot}-${t.id}-${resource}.png`,new Blob([r.bytes],{type:'image/png'}))
  })}
  async function importJSON(file){if(!file)return;return run(async()=>{
    if(file.size>4*1024*1024)throw new Error('JSON vượt giới hạn 4 MB')
    const doc=JSON.parse(await file.text()),t=templates.value.find(t=>t.key===doc.template?.key)
    if(!t)throw new Error('JSON khác loại/phái; hãy chọn đúng loại part và phái trước khi nhập')
    validateRestoredDesign(doc,t)
    const source=t.items.find(i=>i.table===doc.serverItem?.table&&i.row.id===doc.serverItem?.sourceId)
    if(doc.serverItem&&!source)throw new Error('Không tìm được vật phẩm SQL mẫu của JSON trong catalog')
    key.value=t.key
    // Flush key-dependent form reset before restoring the imported fields.
    await Promise.resolve()
    uploads.value={};restored.value=doc;id.value=doc.id;label.value=doc.label;sourceId.value=String(source?.row.id??'')
    await Promise.resolve();if(doc.h5Item)itemId.value=doc.h5Item.id;else if(doc.serverItem)itemId.value=doc.serverItem.row.id
    notice.value='Đã nhập JSON. Chọn lại PNG có SHA-256 khớp rồi bấm Preview thiết kế.'
  })}
  onUnmounted(()=>{for(const url of urls)releasePreviewImage(url)})
  return {slot,key,id,label,sourceId,itemId,templates,template,sourceItem,uploads,drafts,busy,error,notice,active,restored,sqlDocument,upload,create,previewRecord,restore,remove,exportRecord,exportOriginal,downloadPNG,importJSON}
}
