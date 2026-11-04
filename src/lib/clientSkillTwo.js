import { query } from './catalog'

const textureInfo = {
  83: { frameWidth: 27, frameHeight: 32, nFrame: 3, sha256: '692279549d09797d253e44493def01a354f72fd73109560fd9c339b24f8336ad' },
  68: { frameWidth: 17, frameHeight: 23, nFrame: 4, sha256: '634be0332b5b12506937e529e689aa2329ff9718cca1259136c11de8c843d7f5' },
  70: { frameWidth: 50, frameHeight: 50, nFrame: 4, sha256: '8f0a3a45550816f06f90413f57e310e88905556f6df00b826eed3f64f21dd0dc' },
  72: { frameWidth: 34, frameHeight: 38, nFrame: 3, sha256: 'e063de3b97e63b4835fae1687f8ed50c5f237c37cb68b43a278acd442fa945c1' },
  57: { frameWidth: 25, frameHeight: 25, nFrame: 3, sha256: 'e19bfc7c352a3f05a1a3a2fa5c58163e8e22463fb3d9095e2d3e1f8ebd7ac37f' },
  3: { frameWidth: 20, frameHeight: 20, nFrame: 4, sha256: '4462c0c7ea9266f53fce578acd0d2c43da2ef51b4acc90e4a7a6630d735962f8' },
  74: { frameWidth: 21, frameHeight: 17, nFrame: 9, sha256: '6c8b7bf1905039e746273d1bcc25bed6c65f476bf309f66616361508c2873d0b' },
}

export const skillTwoInfo = {
  internalIds: [41, 36, 20, 18], effectIds: [52, 46, 25, 22],
  plashTypes: [1, 1, 1, 8], effectTicks: [9, 9, 9, 4],
}

let cachedReference
export function getSkillTwoReference() {
  if (cachedReference) return cachedReference
  const textures = Object.fromEntries(Object.entries(textureInfo).map(([id, info]) => {
    const source = `part_char/imgver/x4/110_${id}`
    const row = query('SELECT * FROM assets WHERE source=? AND status=? LIMIT 1', [source, 'decoded'])[0]
    if (!row) throw new Error(`Thiếu ảnh hiệu ứng HSO #${id} trong bộ dữ liệu đóng gói.`)
    return [id, { ...row, ...info, density: 4 }]
  }))
  cachedReference = { ...skillTwoInfo, textures }
  return cachedReference
}

const directions = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }
const projectileTransforms = { right: 0, left: 2, down: 5, up: 6 }
const trunc = Math.trunc
function travel(dx, dy, maximum) {
  const duration = Math.max(1, trunc(trunc(Math.hypot(dx, dy)) / maximum))
  return { vx: trunc(dx / duration), vy: trunc(dy / duration), duration }
}

// Port of the four skill #2 EffectSkill branches (52, 46, 25 and 22).
// Target geometry matches the Studio fixture used by skill #1; RNG-only client
// particles are omitted so frame stepping stays deterministic.
export function skillTwoScene(clazz, direction, tick, reference, distance = clazz < 2 ? 40 : 100) {
  if (!Number.isInteger(clazz) || clazz < 0 || clazz > 3) throw new Error('Invalid HSO class')
  const [dx, dy] = directions[direction] || directions.down
  const target = { x: dx * distance, y: dy * distance, height: 40 }
  const elapsed = tick - reference.effectTicks[clazz]
  const sprites = []
  const sprite = (id, frame, x, y, transform = 0) => sprites.push({ asset: reference.textures[id], frame, x, y, transform })
  if (elapsed < 0) return { target, sprites, effectFrame: elapsed }

  if (clazz === 0 && elapsed < 12) {
    sprite(83, trunc(elapsed / 2) % 3, target.x, target.y - 29)
    sprite(68, trunc(elapsed / 2) % 4, target.x, target.y - 13)
  } else if (clazz === 1 && elapsed < 15) {
    if (elapsed < 3) sprite(70, elapsed % 4, target.x, target.y - 20)
    else sprite(72, trunc(elapsed / 2) % 3, target.x, target.y + 5)
  } else if (clazz === 2) {
    const start = { x: 0, y: -10 }, end = { x: target.x, y: target.y - 20 }
    const motion = travel(end.x - start.x, end.y - start.y, 12)
    if (elapsed < motion.duration) {
      sprite(57, trunc(elapsed / 2) % 3, start.x + motion.vx * (elapsed + 1), start.y + motion.vy * (elapsed + 1), projectileTransforms[direction] || 0)
    } else if (elapsed < motion.duration + 4) {
      sprite(3, elapsed - motion.duration, end.x, end.y)
    }
  } else if (clazz === 3) {
    const start = { x: 0, y: -15 }, end = { x: target.x, y: target.y - 20 }
    const motion = travel(end.x - start.x, end.y - start.y, 22)
    if (elapsed < motion.duration) {
      const frame = dx > 0 ? 0 : dx < 0 ? 8 : dy < 0 ? 2 : 5
      sprite(74, frame, start.x + motion.vx * (elapsed + 1), start.y + motion.vy * (elapsed + 1), projectileTransforms[direction] || 0)
    }
  }
  return { target, sprites, effectFrame: elapsed }
}

const transforms = [[1,0,0,1],[1,0,0,-1],[-1,0,0,1],[-1,0,0,-1],[0,1,1,0],[0,1,-1,0],[0,-1,1,0],[0,-1,-1,0]]
export function paintSkillTwo(ctx, scene, images, originX, originY) {
  for (const [index, sprite] of scene.sprites.entries()) {
    const { asset, frame, x, y, transform } = sprite
    const { frameWidth: w, frameHeight: h, density: d } = asset
    ctx.save(); ctx.translate(originX + x, originY + y)
    ctx.transform(...transforms[transform], 0, 0)
    ctx.drawImage(images[index], 0, frame * h * d, w * d, h * d, -w / 2, -h / 2, w, h)
    ctx.restore()
  }
}
