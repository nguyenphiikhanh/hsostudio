import { gameUrl } from './catalog'
import { strToU8, zip } from 'fflate'

export function download(name, data, type = 'application/json') {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function exportFileName(value) {
  return String(value ?? '').trim().replace(/\.zip$/i, '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'character'
}
export async function downloadZip(name, files) {
  const entries = {}
  for (const [path, value] of Object.entries(files)) {
    entries[path] = value instanceof Blob ? new Uint8Array(await value.arrayBuffer())
      : value instanceof Uint8Array ? value
        : strToU8(typeof value === 'string' ? value : JSON.stringify(value, null, 2))
  }
  const buffer = await new Promise((resolve, reject) => zip(entries, { level: 6 }, (error, data) => error ? reject(error) : resolve(data)))
  download(`${exportFileName(name)}.zip`, new Blob([buffer], { type: 'application/zip' }))
}
const imageCache = new Map()
export function loadImage(asset) {
  if (!asset?.image || asset.image.startsWith('jar:')) return Promise.reject(new Error('Thiếu đường dẫn PNG trong bộ dữ liệu đóng gói.'))
  const url = gameUrl(asset.image)
  if (imageCache.has(asset.image)) return imageCache.get(asset.image)
  const pending = new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => { imageCache.delete(asset.image); reject(new Error(`Không tải được PNG ${url} (nguồn: ${asset.source}). Kiểm tra public/game hoặc build lại ứng dụng.`)) }
    img.src = url
  })
  imageCache.set(asset.image, pending)
  return pending
}
export function validCrop(layer) {
  const density = layer.asset.density || 1
  return ['sx', 'sy', 'w', 'h'].every(k => Number.isInteger(layer[k])) && ['x', 'y'].every(k => Number.isFinite(layer[k])) &&
    layer.sx >= 0 && layer.sy >= 0 && layer.w > 0 && layer.h > 0 &&
    (layer.sx + layer.w) * density <= layer.asset.width && (layer.sy + layer.h) * density <= layer.asset.height
}
export async function exportAtlas(layers, drafts, preview = null, requestedName = 'character') {
  if (!layers.length) throw new Error('Thêm ít nhất một lớp trước khi xuất atlas.')
  if (layers.some(l => !validCrop(l))) throw new Error('Vùng cắt phải là số nguyên; vị trí phải là số hữu hạn và vùng cắt phải nằm trong PNG.')
  const density = Math.max(...layers.map(l => l.asset.density || 1))
  const width = Math.max(...layers.map(l => l.w * density)) + 4
  const height = layers.reduce((sum, l) => sum + Math.ceil((l.displayHeight ?? l.h) * density) + 4, 0)
  if (width > 8192 || height > 8192) throw new Error('Atlas vượt 8192 px. Hãy giảm số lớp hoặc vùng cắt.')
  const images = await Promise.all(layers.map(l => loadImage(l.asset)))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  const frames = {}, composition = []
  let top = 2
  layers.forEach((layer, i) => {
    const key = `part-${i}`
    const sourceDensity = layer.asset.density || 1
    const displayHeight = layer.displayHeight ?? layer.h
    const packedHeight = Math.ceil(displayHeight * density)
    ctx.drawImage(images[i], layer.sx * sourceDensity, layer.sy * sourceDensity, layer.w * sourceDensity, layer.h * sourceDensity, 2, top, layer.w * density, packedHeight)
    frames[key] = { frame: { x: 2, y: top, w: layer.w * density, h: packedHeight }, rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: layer.w * density, h: packedHeight }, sourceSize: { w: layer.w * density, h: packedHeight } }
    composition.push({ frame: key, density, scaleY: displayHeight * density / packedHeight, name: layer.name, source: layer.asset.source, slot: layer.slot ?? null, partId: layer.partId ?? null, provenance: layer.provenance ?? 'manual-crop', x: layer.x, y: layer.y, depth: layer.renderDepth ?? (layer.slot === 'weapon' && layer.clientWeapon ? (layer.renderFront ? layers.length+2 : -2) : i), visible: layer.visible, flipX: Boolean(layer.flipX) })
    top += packedHeight + 4
  })
  const png = await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không tạo được PNG.'))))
  const name = exportFileName(requestedName)
  const compositionName = `${name}-composition`
  const snippet = `// Extract the ZIP into your Phaser assets directory.\n// In preload():\nthis.load.atlas('${name}', '${name}.png', '${name}.json');\nthis.load.json('${compositionName}', '${compositionName}.json');\n// In create():\nconst config = this.cache.json.get('${compositionName}');\nconst character = this.add.container(400, 300);\nconfig.layers.forEach(l => {\n  const image = this.add.image(l.x, l.y, '${name}', l.frame).setOrigin(0, 0).setScale(1 / (l.density || 1), (l.scaleY ?? 1) / (l.density || 1)).setVisible(l.visible).setFlipX(Boolean(l.flipX));\n  character.add(image);\n});\n`
  await downloadZip(name, {
    [`${name}.png`]: png,
    [`${name}.json`]: { frames, meta: { app: 'HSO Studio', image: `${name}.png`, format: 'RGBA8888', size: { w: width, h: height }, scale: '1' } },
    [`${compositionName}.json`]: { version: 1, name, texture: name, origin: [0, 0], layers: composition.sort((a, b) => a.depth - b.depth), drafts, preview, animations: [], animationStatus: 'Xuất tư thế đang xem, chưa xuất toàn bộ chu kỳ animation. Part mẫu dùng metadata; chu kỳ preview suy ra từ hình ảnh. Mắt preview là ảnh thay thế của Studio.' },
    [`load-${name}.js`]: snippet,
  })
}
