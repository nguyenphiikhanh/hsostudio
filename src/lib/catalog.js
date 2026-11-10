import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

export const gameUrl = (path) => path.startsWith('data:image/png;base64,') ? path : `${import.meta.env.BASE_URL}game/${path.split('/').map(encodeURIComponent).join('/')}`
let database
export async function loadCatalog() {
  const [SQL, response] = await Promise.all([
    initSqlJs({ locateFile: () => wasmUrl }), fetch(gameUrl('catalog.sqlite')),
  ])
  if (!response.ok) throw new Error(`Không tải được catalog (${response.status}). Kiểm tra thư mục public/game và build lại ứng dụng.`)
  database = new SQL.Database(new Uint8Array(await response.arrayBuffer()))
}
export function query(sql, params = []) {
  const statement = database.prepare(sql)
  try {
    statement.bind(params)
    const rows = []
    while (statement.step()) rows.push(statement.getAsObject())
    return rows
  } finally { statement.free() }
}
export function imageAsset(row, table) {
  if (table === 'assets') return row.image ? row : null
  const icon = row.iconid ?? row.icon
  return icon == null ? null : query('SELECT * FROM assets WHERE source = ? AND status = ? LIMIT 1', [`icon/x1/${icon}.png`, 'decoded'])[0]
}
