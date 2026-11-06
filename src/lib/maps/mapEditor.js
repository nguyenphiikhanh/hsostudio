import {validateMap} from './mapGeometry.js'
const clone=value=>structuredClone(value)
const editable=map=>({tiles:[...map.tiles],objects:map.objects.map(o=>({...o}))})
const sameObject=(a,b)=>a.index===b.index&&a.templateId===b.templateId&&a.cellX===b.cellX&&a.cellY===b.cellY
export function tileCount(map){return Math.floor(map.tileset.terrain.height/(map.tileSize*map.tileset.terrain.density))}
export function lineCells(from,to){
 if(!from||!to)return to?[to]:[]
 let x=from.col,y=from.row,dx=Math.abs(to.col-x),dy=-Math.abs(to.row-y),sx=x<to.col?1:-1,sy=y<to.row?1:-1,err=dx+dy
 const cells=[]
 while(true){cells.push({col:x,row:y});if(x===to.col&&y===to.row)break;const e=2*err;if(e>=dy){err+=dy;x+=sx}if(e<=dx){err+=dx;y+=sy}}
 return cells
}
export function validateEdits(edits,base,templates){
 if(!edits||!Array.isArray(edits.tiles)||edits.tiles.length!==base.width*base.height||!Array.isArray(edits.objects)||edits.objects.length>5000)throw new Error('Nháp có kích thước hoặc số vật thể không hợp lệ')
 if(Object.keys(edits).some(k=>!['tiles','objects'].includes(k)))throw new Error('Nháp chỉ hỗ trợ tiles và objects')
 const max=tileCount(base)
 for(const t of edits.tiles)if(!Number.isInteger(t)||t<0||t>max)throw new Error('Tile trong nháp nằm ngoài tileset')
 const ids=new Set(),source=new Map(base.objects.map(o=>[o.index,o]))
 const objects=edits.objects.map(o=>{
  if(!o||!['index','templateId','cellX','cellY'].every(k=>Number.isSafeInteger(o[k]))||o.index<0||o.index>2147483647||ids.has(o.index)||!templates[o.templateId]?.asset)throw new Error('ID/template vật thể trong nháp không hợp lệ hoặc bị trùng')
  if(Object.keys(o).some(k=>!['index','templateId','cellX','cellY'].includes(k)))throw new Error('Nháp có thuộc tính vật thể chưa hỗ trợ')
  const within=o.cellX>=0&&o.cellX<base.width&&o.cellY>=0&&o.cellY<base.height
  if(!within&&(!source.has(o.index)||!sameObject(o,source.get(o.index))))throw new Error('Vật thể chỉnh sửa phải có ô neo nằm trong map')
  ids.add(o.index)
  return {index:o.index,templateId:o.templateId,cellX:o.cellX,cellY:o.cellY}
 })
 const result={tiles:[...edits.tiles],objects}
 validateMap({...base,...result},templates)
 return result
}
export function createMapEditor(source,templates,objectTableSha256,historyLimit=100){
 const base=clone(source),map=clone(source),past=[],future=[]
 const signature={mapId:base.id,sourceSha256:base.source.sha256,objectTableSha256,terrainSha256:base.tileset.terrain.sha256,width:base.width,height:base.height,tileSize:base.tileSize,tilesetId:base.tileset.id}
 let before=null,label=''
 function begin(name){if(before)throw new Error('Đang có thao tác chỉnh sửa');before=editable(map);label=name}
 function replace(state){map.tiles=[...state.tiles];map.objects=state.objects.map(o=>({...o}))}
 function cancel(){if(!before)return false;replace(before);before=null;return true}
 function commit(){
  if(!before)return false
  const tiles=[]
  for(let i=0;i<map.tiles.length;i++)if(map.tiles[i]!==before.tiles[i])tiles.push({index:i,before:before.tiles[i],after:map.tiles[i]})
  const changed=JSON.stringify(map.objects)!==JSON.stringify(before.objects)
  const command={label,tiles,...(changed?{beforeObjects:before.objects,afterObjects:map.objects.map(o=>({...o}))}:{})}
  before=null
  if(!tiles.length&&!changed)return false
  past.push(command);if(past.length>historyLimit)past.shift();future.length=0;return true
 }
 function apply(command,forward){for(const t of command.tiles)map.tiles[t.index]=forward?t.after:t.before;if(command.beforeObjects)map.objects=(forward?command.afterObjects:command.beforeObjects).map(o=>({...o}))}
 function once(name,action){begin(name);try{action();return commit()}catch(e){cancel();throw e}}
 function assertCell(col,row){if(!Number.isInteger(col)||!Number.isInteger(row)||col<0||row<0||col>=map.width||row>=map.height)throw new Error('Ô neo phải nằm trong map')}
 function paint(cells,tile){
  if(!before)throw new Error('Chưa bắt đầu nét vẽ')
  if(!Number.isInteger(tile)||tile<0||tile>tileCount(map))throw new Error('Tile không hợp lệ')
  for(const c of cells){assertCell(c.col,c.row);map.tiles[c.row*map.width+c.col]=tile}
 }
 function add(templateId,col,row){
  assertCell(col,row);if(!templates[templateId]?.asset)throw new Error('Template chưa có PNG được hỗ trợ')
  if(map.objects.length>=5000)throw new Error('Nháp giới hạn 5000 vật thể')
  const index=Math.max(-1,...map.objects.map(o=>o.index))+1
  if(index>2147483647)throw new Error('Hết ID vật thể hợp lệ')
  map.objects.push({index,templateId,cellX:col,cellY:row});return index
 }
 function stats(){
  const originals=new Map(base.objects.map(o=>[o.index,o])),current=new Map(map.objects.map(o=>[o.index,o]))
  return {order:Number(base.objects.length===map.objects.length&&base.objects.some((o,i)=>o.index!==map.objects[i].index)),tiles:map.tiles.reduce((n,t,i)=>n+Number(t!==base.tiles[i]),0),added:map.objects.filter(o=>!originals.has(o.index)).length,removed:base.objects.filter(o=>!current.has(o.index)).length,changed:map.objects.filter(o=>originals.has(o.index)&&!sameObject(o,originals.get(o.index))).length}
 }
 return {map,signature,get active(){return before!==null},get history(){return{undo:past.length,redo:future.length,undoLabel:past.at(-1)?.label,redoLabel:future.at(-1)?.label}},get stats(){return stats()},
  begin,commit,cancel,paint,
  fill(col,row,tile){
   assertCell(col,row)
   return once('Tô vùng',()=>{
    if(!Number.isInteger(tile)||tile<0||tile>tileCount(map))throw new Error('Tile không hợp lệ')
    const old=map.tiles[row*map.width+col];if(old===tile)return
    const queue=[row*map.width+col];map.tiles[queue[0]]=tile
    for(let p=0;p<queue.length;p++){const i=queue[p],x=i%map.width,y=Math.floor(i/map.width);for(const j of [x>0?i-1:-1,x<map.width-1?i+1:-1,y>0?i-map.width:-1,y<map.height-1?i+map.width:-1])if(j>=0&&map.tiles[j]===old){map.tiles[j]=tile;queue.push(j)}}
   })
  },
  add(templateId,col,row){let id;once('Thêm vật thể',()=>{id=add(templateId,col,row)});return id},
  move(index,col,row){if(!before)throw new Error('Chưa bắt đầu kéo vật thể');assertCell(col,row);const o=map.objects.find(o=>o.index===index);if(!o)throw new Error('Không tìm thấy vật thể');o.cellX=col;o.cellY=row},
  duplicate(index){const o=map.objects.find(o=>o.index===index);if(!o)throw new Error('Không tìm thấy vật thể');let id;once('Nhân bản vật thể',()=>{id=add(o.templateId,o.cellX,o.cellY)});return id},
  remove(index){const o=map.objects.find(o=>o.index===index);if(!o)return false;return once('Xóa vật thể',()=>{map.objects=map.objects.filter(o=>o.index!==index)})},
  undo(){if(before)return cancel();const c=past.pop();if(!c)return false;apply(c,false);future.push(c);return true},
  redo(){if(before)return false;const c=future.pop();if(!c)return false;apply(c,true);past.push(c);return true},
  reset(){return once('Khôi phục gốc',()=>replace(editable(base)))},
  draft(){return{schema:'hso-map-draft',version:1,base:{...signature},edits:editable(map)}},
  parseDraft(doc){
   if(doc?.schema!=='hso-map-draft'||doc.version!==1)throw new Error('Đây không phải nháp Map Studio v1; dùng file từ “Tải nháp JSON”')
   for(const [key,value]of Object.entries(signature))if(doc.base?.[key]!==value)throw new Error(`Nháp không khớp map/nguồn đang mở (${key}); hãy chọn đúng map #${doc.base?.mapId ?? '?'}`)
   return validateEdits(doc.edits,base,templates)
  },
  importEdits(edits){const valid=validateEdits(edits,base,templates);return once('Nhập nháp',()=>replace(valid))},
 }
}
