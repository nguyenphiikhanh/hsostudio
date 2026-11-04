// x1 sheets group 15 clothing rectangles as front/back/side × 5 poses.
// The 24 anchor pairs group four directions × 6 poses. Walking uses poses 0–2;
// Attacks #0–#2 use the verified client frame mapping below; other skills remain trials.
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

// Static client evidence: CharPartInfo.PART_OF_FRAME, SplashSkill type 0, 40 ms ticks.
export function clientBasicPhase(tick) {
  const step = Math.max(0, Math.min(8, Math.trunc(tick)))
  return { bodyFrame: step < 4 ? 4 : step < 8 ? 5 : 0, weaponFrame: step < 4 ? 4 : step < 8 ? step : 0 }
}

export function clientBasicClip(clazz) {
  if (!Number.isInteger(clazz) || clazz < 0 || clazz > 3) throw new Error('Invalid HSO class')
  return {
    clientBasic: true, experimental: false, provenance: 'official-client-4.0.3', clientSha256: 'f023b34e0ba0a3dcf44249ed5f90b78f0427deee4668562b8e3a0e9e349b18c6',
    clazz, skillId: 0, fps: 25, repeat: 0,
    frames: Array.from({ length: 9 }, (_, tick) => {
      const phase = clientBasicPhase(tick)
      return { pose: [0, 0, 1, 2, 3, 4][phase.bodyFrame], anchorPose: phase.bodyFrame, clientBodyFrame: phase.bodyFrame, clientWeaponFrame: phase.weaponFrame, idleOffset: 0 }
    }),
    limitations: ['Body/weapon frame timeline verified against official Java client 4.0.3 for skill #0.', 'Library runtime exports body animation only; weapon textures/equipping are not included in the part library.', 'Other skills and cosmetic weapon effects are not covered.'],
  }
}

const VERIFIED_SKILLS = {
  1: { internalIds: [23, 44, 46, 19], effectIds: [28, 55, 59, 23], plashTypes: [1, 1, 1, 8], effectTicks: [9, 9, 9, 4] },
  2: { internalIds: [41, 36, 20, 18], effectIds: [52, 46, 25, 22], plashTypes: [1, 1, 1, 8], effectTicks: [9, 9, 9, 4] },
}

// Skills #1/#2 use the same SplashSkill type/frame timing in client 4.0.3.
// ListSkill halves the gunner values (plash 16 -> 8, frame 9 -> 4).
export function clientSkillPhase(clazz, skillId, tick) {
  if (skillId === 0) return clientBasicPhase(tick)
  if (!VERIFIED_SKILLS[skillId] || !Number.isInteger(clazz) || clazz < 0 || clazz > 3) throw new Error('Unverified HSO skill')
  const windup = clazz === 3 ? 10 : 6
  const step = Math.max(0, Math.trunc(tick))
  return { bodyFrame: step < windup ? 4 : step < windup + 4 ? 5 : 0,
    weaponFrame: step < windup ? 4 : step < windup + 4 ? step - windup + 4 : 0 }
}

export function clientSkillClip(clazz, skillId) {
  if (skillId === 0) return clientBasicClip(clazz)
  clientSkillPhase(clazz, skillId, 0)
  const verified = VERIFIED_SKILLS[skillId]
  return {
    ...clientBasicClip(clazz), clientBasic: false, clientSkill: true, skillId,
    internalSkillId: verified.internalIds[clazz], plashType: verified.plashTypes[clazz],
    effectId: verified.effectIds[clazz], effectTick: verified.effectTicks[clazz],
    frames: Array.from({ length: clazz === 3 ? 15 : 11 }, (_, tick) => {
      const phase = clientSkillPhase(clazz, skillId, tick)
      return { pose: [0, 0, 1, 2, 3, 4][phase.bodyFrame], anchorPose: phase.bodyFrame,
        clientBodyFrame: phase.bodyFrame, clientWeaponFrame: phase.weaponFrame, idleOffset: 0 }
    }),
    limitations: [`Skill #${skillId} body/WPS and effect trigger traced against official Java client 4.0.3.`,
      'Part library exports body timeline only. Weapon, target and skill effects are preview-only.'],
  }
}

export function resolvePose(layers, directionKey = 'down', pose = 0, idleOffset = 0, options = {}) {
  const direction = DIRECTIONS.find(d => d.key === directionKey) || DIRECTIONS[0]
  const hasClientWeapon = layers.some(layer => layer.slot === 'weapon' && layer.clientWeapon)
  const clientFrame = options.clientBodyFrame ?? (hasClientWeapon && !options.experimentalAttack ? [0, 2, 3][Math.max(0, Math.min(2, Math.trunc(pose)))] : undefined)
  const step = clientFrame !== undefined ? [0, 0, 1, 2, 3, 4][clientFrame] : Math.max(0, Math.min(options.experimentalAttack ? 4 : 2, Math.trunc(pose)))
  const anchorStep = clientFrame !== undefined ? clientFrame : options.experimentalAttack ? Math.max(0, Math.min(5, Math.trunc(options.anchorPose ?? step))) : step
  const resolved = layers.map(layer => {
    if (!layer.poseFrames?.length || !layer.poseOffsets?.length) return { ...layer }
    const index = layer.poseFrames.length === 15 ? direction.group * 5 + step : direction.group
    const frame = layer.poseFrames[index]
    const clientDirection = { down: 0, up: 1, left: 2, right: 3 }[direction.key]
    const offset = layer.poseOffsets[(clientFrame !== undefined && clientDirection === 3 ? 12 : direction.anchor) + anchorStep]
    if (!frame || !offset) return { ...layer }
    const [baseX, baseY] = layer.poseOffsets[0]
    return {
      ...layer,
      ...(directionKey === 'down' && step === 0 && !options.experimentalAttack && clientFrame === undefined ? {} : frame),
      x: (clientFrame !== undefined && clientDirection === 3 ? -offset[0] - frame.w : offset[0]) + layer.x - baseX,
      y: offset[1] + layer.y - baseY,
      flipX: direction.flipX,
    }
  })
  const head = resolved.find(l => l.slot === 'head')
  const baseHead = layers.find(l => l.slot === 'head')
  const pants = resolved.find(l => l.slot === 'pants' && l.visible)
  const breathing = resolved.map(layer => {
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
  return breathing.map(layer => {
    if (layer.slot !== 'weapon' || !layer.clientWeapon) return layer
    if (options.experimentalAttack && !options.clientAttack) return { ...layer, visible: false }
    const weapon = layer.clientWeapon
    const dir = { down: 0, up: 1, left: 2, right: 3 }[direction.key]
    const bodyFrame = clientFrame ?? anchorStep
    const weaponFrame = options.clientWeaponFrame ?? 0
    const behind = dir !== 1 && (layer.clazz === 3 ? bodyFrame !== 4 : bodyFrame !== 5)
    if (options.clientAttack && weaponFrame >= 4) {
      const frame = weapon.splash.frames[dir][weaponFrame]
      return { ...layer, asset: { ...weapon.splash, id: weapon.splash.source }, sx: frame.sx, sy: frame.sy, w: frame.w, h: frame.h,
        x: frame.x, y: frame.y, flipX: false, renderFront: !behind }
    }
    const frame = weapon.frames[dir], offset = weapon.offsets[dir][Math.min(bodyFrame, 2)]
    return { ...layer, ...frame, x: offset[0], y: offset[1], flipX: false, renderFront: !behind }
  })
}

export function paintLayers(ctx, layers, images, originX, originY) {
  const ordered = layers.map((layer, index) => ({ layer, index, depth: layer.slot === 'weapon' && layer.clientWeapon ? (layer.renderFront ? layers.length : -1) : index })).sort((a, b) => a.depth - b.depth)
  ordered.forEach(({ layer, index }) => {
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
