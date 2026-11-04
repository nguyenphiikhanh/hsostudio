// x1 sheets group 15 clothing rectangles as front/back/side × 5 poses.
// The 24 anchor pairs group four directions × 6 poses. Walking uses poses 0–2;
// poses 3–5 are intentionally excluded until the original client is available.
export const DIRECTIONS = [
  { key: 'down', label: 'Nhìn trước', anchor: 0, group: 0, flipX: false },
  { key: 'up', label: 'Nhìn sau', anchor: 6, group: 1, flipX: false },
  { key: 'right', label: 'Sang phải', anchor: 18, group: 2, flipX: true },
  { key: 'left', label: 'Sang trái', anchor: 12, group: 2, flipX: false },
]
export const IDLE_FPS = 8
export const WALK_FPS = 8
export const WALK_CYCLE = [0, 1, 0, 2]
// Studio breathing: lift the head, stretch the shirt around the waist anchor, keep feet planted.
export const IDLE_CYCLE = [0, -0.5, -1, -0.5]

export function resolvePose(layers, directionKey = 'down', pose = 0, idleOffset = 0) {
  const direction = DIRECTIONS.find(d => d.key === directionKey) || DIRECTIONS[0]
  const step = Math.max(0, Math.min(2, pose))
  const resolved = layers.map(layer => {
    if (!layer.poseFrames?.length || !layer.poseOffsets?.length) return { ...layer }
    const index = layer.poseFrames.length === 15 ? direction.group * 5 + step : direction.group
    const frame = layer.poseFrames[index]
    const offset = layer.poseOffsets[direction.anchor + step]
    if (!frame || !offset) return { ...layer }
    const [baseX, baseY] = layer.poseOffsets[0]
    return {
      ...layer,
      ...(directionKey === 'down' && step === 0 ? {} : frame),
      x: offset[0] + layer.x - baseX,
      y: offset[1] + layer.y - baseY,
      flipX: direction.flipX,
    }
  })
  const head = resolved.find(l => l.slot === 'head')
  const baseHead = layers.find(l => l.slot === 'head')
  const pants = resolved.find(l => l.slot === 'pants' && l.visible)
  return resolved.map(layer => {
    if (layer.slot !== 'eyes' || layer.provenance !== 'editor-placeholder') return layer
    if (direction.key === 'up') return { ...layer, visible: false }
    const dx = head && baseHead ? head.x - baseHead.x : 0
    const dy = head && baseHead ? head.y - baseHead.y : 0
    if (direction.group === 2 && head && baseHead) {
      const adjustment = layer.x + 3
      return { ...layer, sx: 0, w: 1, x: direction.key === 'left' ? head.x + 3 + adjustment : head.x + head.w - 4 + adjustment, y: layer.y + dy }
    }
    return { ...layer, x: layer.x + dx, y: layer.y + dy }
  }).map(layer => {
    const breathes = layer.slot !== 'pants' && (layer.poseFrames?.length || layer.provenance === 'editor-placeholder')
    if (!breathes) return layer
    const lift = Math.max(-1, Math.min(0, idleOffset))
    if (layer.slot === 'shirt') {
      // Hands can extend below the waist in the same crop. Anchor at the pants,
      // not the PNG bottom, so stretching cannot pull the actual waist upward.
      const waist = pants && pants.y > layer.y && pants.y < layer.y + layer.h ? pants.y : layer.y + layer.h
      const stretch = (waist - layer.y - lift) / (waist - layer.y)
      return { ...layer, y: layer.y + lift, displayHeight: layer.h * stretch }
    }
    return { ...layer, y: layer.y + lift }
  })
}

export function paintLayers(ctx, layers, images, originX, originY) {
  layers.forEach((layer, index) => {
    if (!layer.visible) return
    if (![layer.sx, layer.sy, layer.w, layer.h].every(Number.isInteger) || ![layer.x, layer.y].every(Number.isFinite)) return
    const density = layer.asset.density || 1
    if (layer.sx < 0 || layer.sy < 0 || layer.w <= 0 || layer.h <= 0 || (layer.sx + layer.w) * density > layer.asset.width || (layer.sy + layer.h) * density > layer.asset.height) return
    ctx.save()
    ctx.translate(originX + layer.x + (layer.flipX ? layer.w : 0), originY + layer.y)
    if (layer.flipX) ctx.scale(-1, 1)
    ctx.drawImage(images[index], layer.sx * density, layer.sy * density, layer.w * density, layer.h * density, 0, 0, layer.w, layer.displayHeight ?? layer.h)
    ctx.restore()
  })
}
