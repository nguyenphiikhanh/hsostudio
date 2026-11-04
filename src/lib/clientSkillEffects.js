import { query } from './catalog'
import { clientSkillData } from './clientSkillCatalog'

// FrameImage ids taken from EffectSkill.set_New_Effect and the special
// GameScreen.StartAddEffectSkill mappings in client 4.0.3.
const spriteIdsBySkill = {
  5: [[85,53],[33,18],[0],[47]],
  6: [[83,68],[15,17,26],[71,5,92],[127,75]],
  7: [[85,53],[33,18],[0],[65,94]],
  8: [[30,31,40],[91,118,119,120,121],[71,5,92],[]],
  17: [[92,115],[127,75],[92,115],[127,75]],
  19: [[85,53,114,116,115],[91,118,119,120,121],[24,7],[65,94,47]],
  20: [[83,68,30,31,40],[33,18,51],[23,24],[21,59]],
}

// arrInfoEff dimensions from FrameImage in the same client. Unlisted textures
// still render as a single source image using its exact decoded dimensions.
const frameInfo = {
  5:[7,7,4], 8:[22,30,4], 11:[24,19,3], 15:[36,30,3], 17:[20,20,4],
  18:[32,32,2], 20:[32,14,3], 21:[48,48,3], 23:[12,12,5], 24:[38,38,3],
  26:[36,30,3], 30:[20,18,3], 31:[12,13,4], 33:[30,37,3], 40:[23,33,2],
  47:[15,15,3], 49:[23,23,4], 51:[70,70,3], 53:[62,64,3], 54:[38,38,4],
  55:[55,55,3], 59:[32,32,4], 60:[30,32,4], 61:[50,50,4], 62:[15,15,3],
  65:[42,27,6], 66:[5,5,4], 68:[17,23,4], 71:[31,31,2], 75:[32,22,3],
  83:[27,32,3], 85:[19,45,1], 87:[24,30,5], 91:[8,5,2], 92:[16,16,3],
  94:[30,14,2], 114:[31,31,2], 115:[16,16,3], 116:[7,7,4], 117:[19,45,1],
  118:[55,55,3], 119:[55,55,3], 120:[55,55,3], 121:[55,55,3], 127:[36,30,4],
}

let cachedReference
export function getClientSkillEffectsReference() {
  if (cachedReference) return cachedReference
  const ids = [...new Set(Object.values(spriteIdsBySkill).flat(2).filter(Boolean))]
  const textures = Object.fromEntries(ids.map(id => {
    const source = `part_char/imgver/x4/110_${id}`
    const row = query('SELECT * FROM assets WHERE source=? AND status=? LIMIT 1', [source, 'decoded'])[0]
    if (!row) throw new Error(`Thiếu ảnh hiệu ứng HSO #${id} trong bộ dữ liệu đóng gói.`)
    const [frameWidth, frameHeight, nFrame] = frameInfo[id] || [row.width / 4, row.height / 4, 1]
    return [id, { ...row, frameWidth, frameHeight, nFrame, density: 4 }]
  }))
  cachedReference = { textures }
  return cachedReference
}

export function clientSkillEffectScene(clazz, skillId, direction, tick, reference, distance = clazz < 2 ? 40 : 100) {
  const skill = clientSkillData(clazz, skillId)
  const [dx,dy] = ({ down:[0,1], up:[0,-1], left:[-1,0], right:[1,0] })[direction] || [0,1]
  const target = { x: dx * distance, y: dy * distance, height: 40 }
  const elapsed = tick - skill.effectTick
  const sprites = []
  const ids = spriteIdsBySkill[skillId]?.[clazz] || []
  if (elapsed >= 0) ids.forEach((id, index) => {
    const asset = reference.textures[id]
    if (!asset || elapsed < index * 2) return
    const age = elapsed - index * 2
    sprites.push({ asset, id, frame: Math.floor(age / 2) % asset.nFrame,
      x: target.x + (index % 2 ? dx * 5 : 0), y: target.y - 18 - Math.floor(index / 2) * 5, index })
  })
  // These two client skills build their lightning/crack from procedural lines
  // instead of FrameImage sprites.
  const lines = []
  if (elapsed >= 0 && ((skillId === 5 && clazz === 2) || (skillId === 7 && clazz === 2))) {
    const length = skillId === 5 ? 30 : 42
    for (let branch = 0; branch < 3; branch++) {
      let px = target.x + (branch - 1) * 9, py = target.y - 38
      const points = [{x:px,y:py}]
      for (let step = 0; step < 5; step++) {
        px += dx * 3 + ((step + branch) % 2 ? 4 : -4)
        py += dy * 3 + length / 5
        points.push({x:px,y:py})
      }
      lines.push({ points, color: branch === 1 ? '#cff8ff' : '#62d9ff' })
    }
  }
  if (elapsed >= 0 && ((skillId === 8 && clazz === 3) || (skillId === 20 && clazz === 3))) {
    for (let branch = 0; branch < 4; branch++) {
      const side = branch % 2 ? 1 : -1
      const y = target.y - 12 - Math.floor(branch / 2) * 9
      lines.push({ color: branch % 2 ? '#fff0a8' : '#ffb461', points: [
        {x:target.x + side * 11,y:y - 5}, {x:target.x + side * 4,y:y}, {x:target.x + side * 12,y:y + 5},
      ] })
    }
  }
  if (elapsed >= 0 && skillId === 20 && clazz === 1) {
    for (let branch = 0; branch < 5; branch++) {
      const x = target.x + (branch - 2) * 7
      lines.push({ color: '#a9ffc2', points: [{x,y:target.y - 25},{x:x + (branch % 2 ? 4 : -4),y:target.y - 12},{x:x + 1,y:target.y - 2}] })
    }
  }
  return { target, sprites, lines, effectFrame: elapsed, effectId: skill.effectId }
}

export function paintClientSkillEffects(ctx, scene, images, originX, originY) {
  for (const [index, sprite] of scene.sprites.entries()) {
    const { asset, frame, x, y } = sprite
    const { frameWidth:w, frameHeight:h, density:d } = asset
    ctx.drawImage(images[index], 0, frame * h * d, w * d, h * d, originX + x - w / 2, originY + y - h / 2, w, h)
  }
  for (const line of scene.lines) {
    ctx.strokeStyle = line.color; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(originX + line.points[0].x, originY + line.points[0].y)
    for (const point of line.points.slice(1)) ctx.lineTo(originX + point.x, originY + point.y)
    ctx.stroke()
  }
}

