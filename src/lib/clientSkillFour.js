import { query } from './catalog'

const textureInfo = {
  21: { frameWidth: 48, frameHeight: 48, nFrame: 3 },
  30: { frameWidth: 20, frameHeight: 18, nFrame: 3 },
  31: { frameWidth: 12, frameHeight: 13, nFrame: 4 },
  40: { frameWidth: 23, frameHeight: 33, nFrame: 2 },
  53: { frameWidth: 62, frameHeight: 64, nFrame: 3 },
  59: { frameWidth: 32, frameHeight: 32, nFrame: 4 },
  75: { frameWidth: 32, frameHeight: 22, nFrame: 3 },
  87: { frameWidth: 24, frameHeight: 30, nFrame: 5 },
  95: { frameWidth: 25, frameHeight: 45, nFrame: 1 },
}

export const skillFourInfo = {
  internalIds: [5, 37, 51, 40],
  effectIds: [11, 47, 64, 51],
  rawPlashTypes: [5, 5, 5, 6],
  plashTypes: [5, 5, 5, 3],
  rawFrameTicks: [11, 11, 11, 11],
  effectTicks: [11, 11, 11, 5],
  effectTextures: { 0: [30, 31, 40], 1: [87, 75], 2: [95, 53], 3: [21, 59] },
}

let cachedReference
export function getSkillFourReference() {
  if (cachedReference) return cachedReference
  const textures = Object.fromEntries(Object.entries(textureInfo).map(([id, info]) => {
    const source = `part_char/imgver/x4/110_${id}`
    const row = query('SELECT * FROM assets WHERE source=? AND status=? LIMIT 1', [source, 'decoded'])[0]
    if (!row) throw new Error(`Thiếu ảnh hiệu ứng HSO #${id} trong bộ dữ liệu đóng gói.`)
    return [id, { ...row, ...info, density: 4 }]
  }))
  cachedReference = { ...skillFourInfo, textures }
  return cachedReference
}

const directions = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }
const projectileTransforms = { right: 0, left: 2, down: 5, up: 6 }
const trunc = Math.trunc

function travel(dx, dy, maximum) {
  const duration = Math.max(1, trunc(trunc(Math.hypot(dx, dy)) / maximum))
  return { vx: trunc(dx / duration), vy: trunc(dy / duration), duration }
}

// Main sprite groups for EffectSkill 11, 47, 64 and 51. Per-target random
// fragments and gameplay status effects are omitted from this deterministic preview.
export function skillFourScene(clazz, direction, tick, reference, distance = clazz < 2 ? 40 : 100) {
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

  if (clazz === 0) {
    const start = { x: target.x - dx * 12, y: target.y - 90 }
    const end = { x: target.x, y: target.y - 14 }
    const motion = travel(end.x - start.x, end.y - start.y, 14)
    if (elapsed < motion.duration) {
      sprite(30, trunc(elapsed / 2) % 3, start.x + motion.vx * (elapsed + 1), start.y + motion.vy * (elapsed + 1), projectileTransforms[direction] || 0)
    } else if (elapsed < motion.duration + 6) {
      const impact = elapsed - motion.duration
      sprite(31, impact % 4, end.x, end.y)
      sprite(40, trunc(impact / 2) % 2, end.x, end.y - 12)
    }
  } else if (clazz === 1 && elapsed < 16) {
    if (elapsed < 9) sprite(87, elapsed % 5, target.x, target.y - 10)
    if (elapsed < 8) sprite(75, trunc(elapsed / 2) % 3, target.x + dx * 8, target.y - 20)
  } else if (clazz === 2 && elapsed < 12) {
    if (elapsed < 3) sprite(53, trunc(elapsed / 2) % 3, target.x, target.y - 8)
    sprite(95, 0, target.x, target.y - 25)
  } else if (clazz === 3 && elapsed < 16) {
    sprite(21, trunc(elapsed / 2) % 3, target.x, target.y - 18)
    if (elapsed >= 2 && elapsed < 12) sprite(59, trunc((elapsed - 2) / 2) % 4, target.x, target.y - 18)
  }
  return { target, sprites, effectFrame: elapsed }
}

const transforms = [[1,0,0,1],[1,0,0,-1],[-1,0,0,1],[-1,0,0,-1],[0,1,1,0],[0,1,-1,0],[0,-1,1,0],[0,-1,-1,0]]
export function paintSkillFour(ctx, scene, images, originX, originY) {
  for (const [index, sprite] of scene.sprites.entries()) {
    const { asset, frame, x, y, transform } = sprite
    const { frameWidth: w, frameHeight: h, density: d } = asset
    ctx.save(); ctx.translate(originX + x, originY + y)
    ctx.transform(...transforms[transform], 0, 0)
    ctx.drawImage(images[index], 0, frame * h * d, w * d, h * d, -w / 2, -h / 2, w, h)
    ctx.restore()
  }
}
