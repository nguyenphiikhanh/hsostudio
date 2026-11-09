import server from '../../data/partDesignServer.json' with {type:'json'}

export function sqlValue(value) {
  if(value===null)return 'NULL'
  if(typeof value==='number') {if(!Number.isSafeInteger(value))throw new Error('Giá trị SQL phải là số nguyên an toàn');return String(value)}
  if(typeof value!=='string')throw new Error('Giá trị SQL không hợp lệ')
  if(value==='')return "''"
  return `CONVERT(0x${Array.from(new TextEncoder().encode(value),b=>b.toString(16).padStart(2,'0')).join('')} USING utf8mb4)`
}
export function designSQL(document) {
  const {table,row}=document.serverItem??{},columns=server.tables[table]
  const header=['-- HSO Studio: MySQL item template export.', '-- Schema: hso/hsoodtest.sql; metadata and PNG are external files.',
    '-- INSERT only: no UPDATE / REPLACE / DELETE; duplicate IDs fail.',
    '-- Importing this SQL does NOT register an appearance. Deploy PNG/packet/client metadata separately.',
    '-- Server Manager uses indexed item lists: preserve contiguous item IDs and verify load order.',
    ...(document.slot==='mount'||document.slot==='pet'?['-- REQUIRED: add the new item ID to UseItem.use_item_mount / Pet.get_pet and client resource mapping.','-- The pet SQL table is NOT an appearance registry.']:['-- REQUIRED: register the new part/image metadata in server packets and client resource lookup.']),
    '-- See design.json serverIntegration for exact scope.']
  if(!columns||!row)return [...header,'-- No matching source item exists for this part. No INSERT generated.',''].join('\n')
  if(columns.some(k=>!(k in row)))throw new Error('Template vật phẩm thiếu cột trong schema HSO')
  return [...header,'SET NAMES utf8mb4;','START TRANSACTION;',`INSERT INTO \`${table}\` (${columns.map(c=>'`'+c+'`').join(', ')}) VALUES (${columns.map(c=>sqlValue(row[c])).join(', ')});`,'COMMIT;',''].join('\n')
}
export function serverIntegration(slot) {
  return {status:'requires-manual-integration',dialect:'mysql',schemaSource:server.schemaSource,evidence:server.evidence,sourceHashes:server.sourceHashes,
    sqlScope:'item-template-only',imageAndRigInDatabase:false,
    remaining:slot==='mount'||slot==='pet'?['Deploy PNG and rig in the appropriate client/server resource format.','Add explicit new item/appearance mapping in UseItem.use_item_mount or Pet.get_pet; SQL does not create that mapping.','Verify client support and resource ID limits; Studio design ID is not automatically a native mount type or pet icon.']:
      ['Deploy PNG and original-layout frame/anchor metadata as HSO resources; JSON is not a native -52 packet.','Verify client resource lookup and availability for the new part ID.'],
    limits:{itemId:[0,32767],...(slot==='pants'||slot==='shirt'||slot==='weapon'?{partId:[0,127]}:{})}}
}
