import { query } from './catalog'

const textureInfo = {
  8: { frameWidth: 22, frameHeight: 30, nFrame: 4 },
  23: { frameWidth: 12, frameHeight: 12, nFrame: 5 },
  24: { frameWidth: 38, frameHeight: 38, nFrame: 3 },
  31: { frameWidth: 12, frameHeight: 13, nFrame: 4 },
  50: { frameWidth: 24, frameHeight: 35, nFrame: 3 },
  53: { frameWidth: 62, frameHeight: 64, nFrame: 3 },
  97: { frameWidth: 12, frameHeight: 12, nFrame: 3 },
}

export const skillThreeInfo = {
  internalIds: [21, 22, 39, 24],
  effectIds: [26, 27, 49, 31],
  plashTypes: [5, 1, 5, 5],
  effectTicks: [11, 9, 11, 5],
  effectTextures: { 0: [8, 53], 1: [50], 2: [23, 24], 3: [31, 97] },
}

let cachedReference
export function getSkillThreeReference() {
  if (cachedReference) return cachedReference
  const textures = Object.fromEntries(Object.entries(textureInfo).map(([id, info]) => {
    const source = `part_char/imgver/x4/110_${id}`
    const row = query('SELECT * FROM assets WHERE source=? AND status=? LIMIT 1', [source, 'decoded'])[0]
    if (!row) throw new Error(`Thiếu ảnh hiệu ứng HSO #${id} trong bộ dữ liệu đóng gói.`)
    return [id, { ...row, ...info, density: 4 }]
  }))
  cachedReference = { ...skillThreeInfo, textures }
  return cachedReference
}

const directions = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }
const projectileTransforms = { right: 0, left: 2, down: 5, up: 6 }
const trunc = Math.trunc

function travel(dx, dy, maximum) {
  const duration = Math.max(1, trunc(trunc(Math.hypot(dx, dy)) / maximum))
  return { vx: trunc(dx / duration), vy: trunc(dy / duration), duration }
}

// Main visual branches for EffectSkill 26, 27, 49 and 31. Random fragments and
// additional target/status effects are omitted to keep the preview deterministic.
export function skillThreeScene(clazz, direction, tick, reference, distance = clazz < 2 ? 40 : 100) {
  if (!Number.isInteger(clazz) || clazz < 0 || clazz > 3) throw new Error('Invalid HSO class')
  const [dx, dy] = directions[direction] || directions.down
  const target = { x: dx * distance, y: dy * distance, height: 40 }
  const elapsed = tick - reference.effectTicks[clazz]
  const sprites = []
  const sprite = (id, frame, x, y, transform = 0) => {
    const asset = reference.textures[id]
    if (asset) sprites.push({ asset, frame, x, y, transform })
  }
  if (elapsed < 0) return { target, sprites, effectFrame: elapsed }

  if (clazz === 0 && elapsed < 8) {
    sprite(8, trunc(elapsed / 2) % 4, target.x, target.y + 2)
    if (elapsed < 6) sprite(53, trunc(elapsed / 2) % 3, target.x, target.y - 20)
  } else if (clazz === 1 && elapsed < 9) {
    sprite(50, trunc(elapsed / 2) % 3, target.x, target.y - 8)
  } else if (clazz === 2) {
    const start = { x: 0, y: -10 }, end = { x: target.x, y: target.y - 20 }
    const motion = travel(end.x - start.x, end.y - start.y, 12)
    if (elapsed < motion.duration) {
      sprite(23, elapsed % 5, start.x + motion.vx * (elapsed + 1), start.y + motion.vy * (elapsed + 1), projectileTransforms[direction] || 0)
    } else if (elapsed < motion.duration + 6) {
      sprite(24, trunc((elapsed - motion.duration) / 2) % 3, end.x, end.y)
    }
  } else if (clazz === 3) {
    const start = { x: 0, y: -15 }, end = { x: target.x, y: target.y - 20 }
    const motion = travel(end.x - start.x, end.y - start.y, 16)
    if (elapsed < motion.duration) {
      sprite(31, elapsed % 4, start.x + motion.vx * (elapsed + 1), start.y + motion.vy * (elapsed + 1), projectileTransforms[direction] || 0)
    } else if (elapsed < motion.duration + 3) {
      sprite(97, elapsed - motion.duration, end.x, end.y)
    }
  }
  return { target, sprites, effectFrame: elapsed }
}

const transforms = [[1,0,0,1],[1,0,0,-1],[-1,0,0,1],[-1,0,0,-1],[0,1,1,0],[0,1,-1,0],[0,-1,1,0],[0,-1,-1,0]]
export function paintSkillThree(ctx, scene, images, originX, originY) {
  for (const [index, sprite] of scene.sprites.entries()) {
    const { asset, frame, x, y, transform } = sprite
    const { frameWidth: w, frameHeight: h, density: d } = asset
    ctx.save(); ctx.translate(originX + x, originY + y)
    ctx.transform(...transforms[transform], 0, 0)
    ctx.drawImage(images[index], 0, frame * h * d, w * d, h * d, -w / 2, -h / 2, w, h)
    ctx.restore()
  }
}
