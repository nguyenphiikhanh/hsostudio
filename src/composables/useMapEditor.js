import {ref,shallowRef,computed,watch,onDeactivated} from 'vue'
import {createMapEditor,lineCells,tileCount} from '../lib/maps/mapEditor.js'
import {collisionGrid,cellAt} from '../lib/maps/mapGeometry.js'
import {loadMapAsset} from '../lib/maps/mapData'

export function useMapEditor(source,{selectedCell,selectedObject,hoverCell}){
 const sessions=new Map(),session=shallowRef(null),revision=ref(0),tool=ref('pan'),brush=ref(1),templateId=ref(0)
 const assetLoading=ref(false),assetError=ref('')
 let gesture=null,assetGeneration=0
 const stats=computed(()=>{revision.value;return session.value?.editor.stats??{tiles:0,added:0,removed:0,changed:0}})
 const modified=computed(()=>Object.values(stats.value).some(n=>n>0))
 const history=computed(()=>{revision.value;return session.value?.editor.history??{undo:0,redo:0}})
 const active=computed(()=>{revision.value;return Boolean(session.value?.editor.active)})
 const data=computed(()=>{revision.value;const s=session.value;return s?{...s.baseData,map:s.editor.map,images:s.images,editInfo:{modified:modified.value,stats:stats.value,base:s.editor.signature}}:null})
 const collision=computed(()=>data.value?collisionGrid(data.value.map,data.value.templates):[])
 const count=computed(()=>data.value?tileCount(data.value.map):0)
 const template=computed(()=>data.value?.templates[templateId.value])
 const templateReady=computed(()=>{revision.value;return Boolean(template.value?.asset&&session.value?.images.has(template.value.asset.image))})
 function changed(){
  revision.value++
  const d=data.value
  if(!d)return
  if(selectedObject.value)selectedObject.value=d.map.objects.find(o=>o.index===selectedObject.value.index)??null
  if(selectedCell.value)selectedCell.value=cellAt(d.map,collision.value,selectedCell.value.x,selectedCell.value.y)
  if(hoverCell.value)hoverCell.value=cellAt(d.map,collision.value,hoverCell.value.x,hoverCell.value.y)
 }
 function cancel(){gesture=null;if(session.value?.editor.cancel())changed()}
 async function ensureTemplate(){
  const generation=++assetGeneration,s=session.value,d=s?.baseData.templates[templateId.value]
  assetError.value='';assetLoading.value=false
  if(!s||!d?.asset)return
  if(s.images.has(d.asset.image))return
  assetLoading.value=true
  try{const image=await loadMapAsset(d.asset);s.images.set(d.asset.image,image);if(session.value===s)changed()}
  catch(e){if(generation===assetGeneration&&session.value===s)assetError.value=e.message}
  finally{if(generation===assetGeneration)assetLoading.value=false}
 }
 watch(source,baseData=>{
  cancel();assetGeneration++;assetLoading.value=false;assetError.value=''
  if(!baseData){session.value=null;revision.value++;return}
  let s=sessions.get(baseData.map.id)
  if(!s){s={baseData,images:new Map(baseData.images),editor:createMapEditor(baseData.map,baseData.templates,baseData.tableSource.sha256)};sessions.set(baseData.map.id,s)}
  session.value=s;tool.value='pan';brush.value=Math.min(brush.value,tileCount(s.editor.map));changed();ensureTemplate()
 },{immediate:true})
 watch(templateId,ensureTemplate)
 watch(tool,()=>{cancel()})
 onDeactivated(cancel)
 function editor(){if(!session.value)throw new Error('Chưa có map để sửa');return session.value.editor}
 function selectTool(value){cancel();tool.value=value}
 function chooseTile(value){brush.value=value;if(!['paint','fill'].includes(tool.value))selectTool('paint')}
 function start(point){
  cancel();if(!data.value||!point.cell)return
  const e=editor(),{cell}=point
  selectedCell.value=cell
  if(tool.value==='paint'||tool.value==='erase'){
   e.begin(tool.value==='erase'?'Tẩy tile':'Vẽ tile');gesture={kind:'tiles',last:cell,tile:tool.value==='erase'?0:brush.value};e.paint([cell],gesture.tile);changed()
  }else if(tool.value==='fill'){e.fill(cell.col,cell.row,brush.value);changed()}
  else if(tool.value==='eyedrop'){brush.value=cell.tile;selectTool('paint')}
  else if(tool.value==='place'){
   if(!templateReady.value)throw new Error('PNG vật thể chưa sẵn sàng')
   const id=e.add(templateId.value,cell.col,cell.row);selectedObject.value=e.map.objects.find(o=>o.index===id);changed()
  }else if(tool.value==='move'&&point.object){
   const o=point.object;selectedObject.value=o;e.begin('Di chuyển vật thể');gesture={kind:'move',id:o.index,start:point.world,col:o.cellX,row:o.cellY};changed()
  }
 }
 function move(point){
  if(!gesture||!data.value)return
  const e=editor()
  if(point.cell)selectedCell.value=point.cell
  if(gesture.kind==='tiles'){
   if(point.cell)e.paint(lineCells(gesture.last,point.cell),gesture.tile)
   gesture.last=point.cell
  }else{
   const x=gesture.col+Math.floor(point.world.x/24)-Math.floor(gesture.start.x/24),y=gesture.row+Math.floor(point.world.y/24)-Math.floor(gesture.start.y/24)
   if(x===gesture.col&&y===gesture.row){changed();return}
   e.move(gesture.id,Math.max(0,Math.min(e.map.width-1,x)),Math.max(0,Math.min(e.map.height-1,y)))
  }
  changed()
 }
 function end(){if(session.value?.editor.active){session.value.editor.commit();changed()}gesture=null}
 function undo(){gesture=null;if(editor().undo())changed()}
 function redo(){if(editor().redo())changed()}
 function duplicate(){cancel();if(!selectedObject.value)return;const e=editor(),id=e.duplicate(selectedObject.value.index);selectedObject.value=e.map.objects.find(o=>o.index===id);selectTool('move');changed()}
 function remove(){cancel();if(!selectedObject.value)return;editor().remove(selectedObject.value.index);selectedObject.value=null;changed()}
 function reset(){cancel();editor().reset();selectedObject.value=null;changed()}
 function draft(){end();return editor().draft()}
 async function importDraft(doc){
  cancel();const s=session.value;if(!s)throw new Error('Hãy chọn map trước khi nhập nháp')
  const edits=s.editor.parseDraft(doc),initialEdits=JSON.stringify(s.editor.draft().edits)
  const assets=[...new Map(edits.objects.map(o=>{const a=s.baseData.templates[o.templateId].asset;return[a.image,a]})).values()]
  const images=await Promise.all(assets.map(async a=>[a.image,s.images.get(a.image)??await loadMapAsset(a)]))
  if(session.value!==s||JSON.stringify(s.editor.draft().edits)!==initialEdits)throw new Error('Map đã thay đổi trong lúc nhập; hãy thử lại')
  for(const [path,image]of images)s.images.set(path,image)
  s.editor.importEdits(edits);selectedObject.value=null;selectedCell.value=null;changed()
 }
 return {data,collision,tool,brush,templateId,template,templateReady,assetLoading,assetError,stats,modified,history,active,count,selectTool,chooseTile,start,move,end,cancel,undo,redo,duplicate,remove,reset,draft,importDraft,ensureTemplate}
}
