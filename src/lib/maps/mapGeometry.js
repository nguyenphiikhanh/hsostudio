// Java 4.0.3 LoadMap.loadmap, Block_TileMap_Item, CRes.quickSort1.
const newStand = {9:19,10:5,11:21,12:34,13:47,14:26,15:9,16:42}
export function terrainType(tile, tileset) {
  const stand = tileset.id >= 9 ? newStand[tileset.id] : tileset.info[1]
  if (tile === 0 || tile >= stand) return 1
  return tileset.id < 9 && tile >= tileset.info[0] ? 2 : 0
}
export function objectPlacement(object, template, tileSize = 24) {
  return { x:object.cellX*tileSize+template.dx, y:object.cellY*tileSize+template.dy,
    width:template.asset.width/template.asset.density, height:template.asset.height/template.asset.density }
}
export function sortObjects(objects) {
  const a = [...objects]
  const swap = (i,j) => { if(a[i].cellY!==a[j].cellY) [a[i],a[j]]=[a[j],a[i]] }
  function sort(lo,hi) {
    if(hi<=lo)return
    const pivot=a[hi].cellY;let left=lo-1,right=hi
    while(true) {
      if(a[++left].cellY<pivot)continue
      while(right>0 && a[--right].cellY>pivot){}
      if(left>=right)break
      swap(left,right)
    }
    swap(left,hi);sort(lo,left-1);sort(left+1,hi)
  }
  sort(0,a.length-1)
  return a
}
export function collisionGrid(map, templates) {
  const cells = map.tiles.map(t=>terrainType(t,map.tileset))
  for(const o of map.objects)for(const [dx,dy] of templates[o.templateId].blocks) {
    const x=o.cellX+dx,y=o.cellY+dy
    if(x>=0&&y>=0&&x<map.width&&y<map.height)cells[y*map.width+x]=1
  }
  return cells
}
export function cellAt(map, collision, x, y) {
  if(!map || x<0 || y<0 || x>=map.width*map.tileSize || y>=map.height*map.tileSize)return null
  const col=Math.floor(x/map.tileSize),row=Math.floor(y/map.tileSize),index=row*map.width+col
  return {col,row,x:Math.floor(x),y:Math.floor(y),index,tile:map.tiles[index],type:collision[index],terrainType:terrainType(map.tiles[index],map.tileset)}
}
export function hitObject(map, templates, x, y) {
  for(const o of sortObjects(map.objects).reverse()) {
    const p=objectPlacement(o,templates[o.templateId],map.tileSize)
    if(x>=p.x&&y>=p.y&&x<p.x+p.width&&y<p.y+p.height)return o
  }
  return null
}
export function validateMap(map, templates) {
  if(!map || map.version!==1 || !Number.isInteger(map.id) || !Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width<1 || map.height<1 || map.width>127 || map.height>127 || map.tileSize!==24 || map.tiles.length!==map.width*map.height)throw new Error('Layout map không hợp lệ')
  const a=map.tileset?.terrain
  if(!a || a.density!==4 || a.width<96 || !a.image || !Array.isArray(map.tileset.info) || (map.tileset.id>=9 && !newStand[map.tileset.id]))throw new Error('Thiếu tileset/metadata được hỗ trợ')
  for(const t of map.tiles)if(!Number.isInteger(t)||t<0||t*96>a.height)throw new Error('Tile nằm ngoài PNG')
  for(const o of map.objects) {
    const d=templates[o.templateId]
    if(!d?.asset?.image || ![o.cellX,o.cellY,d.dx,d.dy].every(Number.isInteger) || !Array.isArray(d.blocks) || d.blocks.some(p=>p.length!==2||!p.every(Number.isInteger)))throw new Error(`Thiếu template vật thể #${o.templateId}`)
  }
  return map
}
export function mapAssets(map, templates) {
  return [...new Map([map.tileset.terrain,...map.objects.map(o=>templates[o.templateId].asset)].map(a=>[a.image,a])).values()]
}
