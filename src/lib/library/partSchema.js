export const PART_SLOTS = ['pants', 'shirt', 'head', 'eyes', 'hair', 'helmet']

// part.json is the editable source; atlas.json and library.json are generated.
export function compilePart(definition, libraryName) {
  const { slot, partId, width, height, frames, offsets } = definition
  const density = definition.density ?? 1
  if (![1, 2, 3, 4].includes(density)) throw new Error('Invalid texture density')
  const key = `${slot}-${partId}`
  if (!PART_SLOTS.includes(slot) || !Number.isSafeInteger(partId) || partId < 0) throw new Error(`Invalid slot/partId: ${key}`)
  if (![width, height].every(value => Number.isSafeInteger(value) && value > 0)) throw new Error(`Invalid image dimensions: ${key}`)
  const expected = slot === 'pants' || slot === 'shirt' ? 15 : slot === 'eyes' && frames?.length===1 ? 1 : 3
  if (!Array.isArray(frames) || frames.length !== expected) throw new Error(`${key} requires ${expected} frame crops`)
  if (!Array.isArray(offsets) || offsets.length !== (slot === 'eyes' && definition.provenance==='editor-placeholder' ? 1 : 24) || offsets.some(pair => !Array.isArray(pair) || pair.length !== 2 || pair.some(n => !Number.isSafeInteger(n)))) throw new Error(`Invalid anchors: ${key}`)
  const directory = `parts/${slot}/${partId}`
  const paths = { image: `${directory}/sheet.png`, data: `${directory}/atlas.json`, definition: `${directory}/part.json` }
  const texture = `${libraryName}-${key}`
  const atlasFrames = {}
  function add(crop, frame) {
    if (!crop || ['sx', 'sy', 'w', 'h'].some(field => !Number.isSafeInteger(crop[field])) || crop.sx < 0 || crop.sy < 0 || crop.w <= 0 || crop.h <= 0 || (crop.sx + crop.w) * density > width || (crop.sy + crop.h) * density > height) throw new Error(`Invalid crop: ${key}/${frame}`)
    atlasFrames[frame] = { frame: { x: crop.sx * density, y: crop.sy * density, w: crop.w * density, h: crop.h * density }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: crop.w * density, h: crop.h * density }, sourceSize: { w: crop.w * density, h: crop.h * density } }
    return { texture, frame, crop: { ...crop } }
  }
  const part = { ...definition, directory, files: paths, frames: frames.map((crop, index) => add(crop, `${key}-frame-${index}`)) }
  if (slot === 'eyes' && definition.provenance === 'editor-placeholder') part.sideFrame = add({ ...frames[0], w: 1 }, `${key}-side`)
  return { key, part, paths, atlas: { frames: atlasFrames, meta: { app: 'HSO Studio', image: 'sheet.png', format: 'RGBA8888', size: { w: width, h: height }, scale: '1' } }, atlasEntry: { key: texture, image: paths.image, data: paths.data, partKey: key } }
}
