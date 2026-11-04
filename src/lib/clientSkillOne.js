// Port of the primary EffectSkill branches 28/55/59/23 in Java client 4.0.3.
// Coordinates are x1 world units; the preview target uses Player.hOne = 40.
const trunc = Math.trunc
const imageBullet = [0,0,2,1,1,2,0,0,2,1,1,2,0,0,2,1,1,2,0,0,2,1,1,2]
const rotateBullet = [2,2,3,3,3,4,5,5,5,5,5,1,0,0,0,0,0,7,6,6,6,6,6,2]
const angleFrames = [12,11,10,9,8,7,6,5,4,3,2,1,0,23,22,21,20,19,18,17,16,15,14,13]
const directions = { down: [0,1], up: [0,-1], left: [-1,0], right: [1,0] }

function randomSource(seed = 403) {
  return (min, max) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return min + seed % (max - min)
  }
}
function signed(random, min, max) { return random(0,2) ? random(min,max) : -random(min,max) }
function nonzero(random, max) { return signed(random, 1, max) }
function speed(dx, dy, maximum) {
  dx ||= 1; dy ||= 1
  const duration = Math.max(1, trunc(trunc(Math.hypot(dx, dy)) / maximum))
  return { vx: trunc(dx / duration), vy: trunc(dy / duration), duration }
}
function bulletFrame(dx, dy) {
  const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360
  return angle <= 15 || angle > 345 ? 12 : angleFrames[trunc((angle - 15) / 15) + 1]
}

// Seed fixes the random sample for reproducible stepping, not the original Java RNG stream.
export function skillOneScene(clazz, direction, tick, reference, distance = clazz < 2 ? 40 : 100) {
  const [dx,dy] = directions[direction]
  const target = { x: dx * distance, y: dy * distance, height: 40 }
  const f = tick - reference.effectTicks[clazz]
  const sprites = [], lines = []
  const sprite = (id, frame, x, y, transform = 0, top = false) => {
    const asset = reference.textures[id]
    if (!asset) throw new Error(`Thiếu ảnh hiệu ứng HSO #${id} trong bộ dữ liệu đóng gói.`)
    sprites.push({ asset, frame, x, y, transform, top })
  }
  if (f < 0) return { target, sprites, lines, effectFrame: f }
  if (clazz === 0 && f < 6) {
    // create_Kiem_Lv2: target foot + hOne/4; anchor HCENTER|TOP at y-frameHeight.
    sprite(53, trunc(f / 2) % 3, target.x, target.y + 10 - 64, 0, true)
  } else if (clazz === 1) {
    if (f < 6) sprite(51, trunc(f / 2), target.x, target.y - 20)
    const random = randomSource(), active = []
    // EffectSkill.update case 55 + Model.Line.update; retain the client's ranges/colors.
    for (let step = 0; step <= f; step++) {
      for (const line of active) {
        line.x0 += line.vx; line.x1 += line.vx
        line.y0 += line.vy; line.y1 += line.vy; line.age++
      }
      for (let i = active.length - 1; i >= 0; i--) if (active[i].age > active[i].life) active.splice(i,1)
      if (step >= 12) continue
      const count = random(2,4)
      for (let i = 0; i < count; i++) {
        const length = random(10,24), offset = nonzero(random,15), velocity = signed(random,6,12)
        let x0, y0, x1, y1, vx = 0, vy = 0
        if (dx) {
          x0 = target.x + offset; x1 = x0 + (offset > 0 ? length : -length)
          y0 = y1 = target.y - 20 + nonzero(random,30); vx = velocity
        } else {
          y0 = target.y - 20 + offset; y1 = y0 + (offset > 0 ? length : -length)
          x0 = x1 = target.x + nonzero(random,30); vy = velocity
        }
        active.push({ x0,y0,x1,y1,vx,vy,age:0,life:random(2,5),double:random(0,5)===0,color:random(0,3)===1 ? -462656 : -7 })
      }
    }
    lines.push(...active)
  } else if (clazz === 2) {
    const start = { x: 0, y: -10 }, end = { x: target.x, y: target.y - 20 }
    const motion = speed(end.x - start.x, end.y - start.y,14)
    if (f < motion.duration) sprite(17, trunc(f / 2) % 4, start.x + motion.vx * (f + 1), start.y + motion.vy * (f + 1))
    else if (f < motion.duration + 6) sprite(24, trunc((f - motion.duration) / 2) % 3,end.x,end.y)
  } else if (clazz === 3) {
    const start = { x: 0, y: -15 }, end = { x: target.x, y: target.y - 20 }
    const random = randomSource(), frame = bulletFrame(end.x - start.x,end.y - start.y)
    let longest = 0
    for (let i = 0; i < 4; i++) {
      const motion = speed(end.x + signed(random,0,13) - start.x,end.y + signed(random,0,13) - start.y,22)
      longest = Math.max(longest,motion.duration - 1)
      if (f + 1 < motion.duration) sprite(47,imageBullet[frame],start.x + motion.vx * (f + 1),start.y + motion.vy * (f + 1),rotateBullet[frame])
    }
    // EffectSkill case 23 -> EffectEnd 12 (g60), after all four bullets are removed.
    const impact = Math.max(5,longest)
    if (f >= impact && f < impact + 4) sprite(60,f - impact,target.x,target.y + 10)
  }
  return { target, sprites, lines, effectFrame: f }
}

const transforms = [[1,0,0,1],[1,0,0,-1],[-1,0,0,1],[-1,0,0,-1],[0,1,1,0],[0,1,-1,0],[0,-1,1,0],[0,-1,-1,0]]
export function paintSkillOne(ctx, scene, images, originX, originY) {
  for (const [index, sprite] of scene.sprites.entries()) {
    const { asset, frame, x, y, transform, top } = sprite
    const w = asset.frameWidth, h = asset.frameHeight, d = asset.density
    ctx.save(); ctx.translate(originX + x,originY + y + (top ? h/2 : 0))
    ctx.transform(...transforms[transform],0,0)
    ctx.drawImage(images[index],0,frame*h*d,w*d,h*d,-w/2,-h/2,w,h)
    ctx.restore()
  }
  const color = value => `#${(value & 0xffffff).toString(16).padStart(6,'0')}`
  for (const line of scene.lines) {
    ctx.strokeStyle = color(line.color); ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(originX+line.x0,originY+line.y0); ctx.lineTo(originX+line.x1,originY+line.y1); ctx.stroke()
    if (line.double) {
      ctx.strokeStyle = color(-466864)
      ctx.beginPath(); ctx.moveTo(originX+line.x0+1,originY+line.y0-1); ctx.lineTo(originX+line.x1+1,originY+line.y1-1); ctx.stroke()
    }
  }
}
