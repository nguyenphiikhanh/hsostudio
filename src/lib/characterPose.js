// x1 sheets group 15 clothing rectangles as front/back/side × 5 poses.
// The 24 anchor pairs group four directions × 6 poses. Walking uses poses 0–2;
import { titleFrame } from './titlePose.js'
import { companionFrame } from './companionPose.js'
import { clientSkillData } from './clientSkillCatalog.js'

// Client skill and body/WPS mappings are stored in clientSkillCatalog.js.
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

const plashWindup = { 0: 4, 1: 6, 2: 12, 5: 8, 6: 30, 7: 16, 8: 10, 10: 22, 11: 11, 16: 6 }
const sungPlash = new Set([6, 10, 11, 16])

// SplashSkill.setPlash supplies the windup for these verified client attacks.
// ListSkill halves the gunner values before starting the animation.
export function clientSkillPhase(clazz, skillId, tick) {
  if (skillId === 0) return clientBasicPhase(tick)
  const data = clientSkillData(clazz, skillId)
  if (!data) throw new Error('Unverified HSO skill')
  const step = Math.max(0, Math.trunc(tick))
  if (skillId === 4 && clazz === 3) {
    if (step < 2) return { bodyFrame: 5, weaponFrame: 4 }
    if (step < 6) return { bodyFrame: 4, weaponFrame: step + 2 }
    return { bodyFrame: 0, weaponFrame: 0 }
  }
  if (data.category === 'passive' || data.category === 'party-buff' || (data.plashType === 0 && !['attack','control','area'].includes(data.category))) return { bodyFrame: 0, weaponFrame: 0 }
  if (data.plashType === 4) {
    if (step < 4) return { bodyFrame: 4, weaponFrame: 4 }
    if (step < 10) return { bodyFrame: 5, weaponFrame: step }
    return { bodyFrame: 0, weaponFrame: 0 }
  }
  if (data.plashType === 9) {
    if (step < 30) return { bodyFrame: clazz === 3 ? 5 : 4, weaponFrame: 4 }
    return { bodyFrame: 0, weaponFrame: 0 }
  }
  const plashType = data.plashType
  const windup = plashWindup[plashType]
  if (!windup) throw new Error('Unsupported HSO splash type')
  const sung = sungPlash.has(plashType)
  return { bodyFrame: step < windup ? sung ? 5 : 4 : step < windup + 4 ? sung ? 4 : 5 : 0,
    weaponFrame: step < windup ? 4 : step < windup + 4 ? step - windup + 4 : 0 }
}

export function clientSkillClip(clazz, skillId) {
  if (skillId === 0) return clientBasicClip(clazz)
  clientSkillPhase(clazz, skillId, 0)
  const verified = clientSkillData(clazz, skillId)
  const frameCount = verified.category === 'passive' || verified.category === 'party-buff' || (verified.plashType === 0 && !['attack','control','area'].includes(verified.category)) ? 1
    : skillId === 4 && clazz === 3 ? 7
      : verified.plashType === 4 ? 11 : verified.plashType === 9 ? 31
        : (plashWindup[verified.plashType] ?? 1) + 5
  return {
    ...clientBasicClip(clazz), clientBasic: false, clientSkill: true, skillId,
    internalSkillId: verified.internalSkillId, plashType: verified.plashType,
    effectId: verified.effectId, effectTick: verified.effectTick, category: verified.category,
    frames: Array.from({ length: frameCount }, (_, tick) => {
      const phase = clientSkillPhase(clazz, skillId, tick)
      return { pose: [0, 0, 1, 2, 3, 4][phase.bodyFrame], anchorPose: phase.bodyFrame,
        clientBodyFrame: phase.bodyFrame, clientWeaponFrame: phase.weaponFrame, idleOffset: 0 }
    }),
    limitations: [`Skill #${skillId} internal ID, plash and effect ID are mapped from official Java client 4.0.3; category: ${verified.category}.`,
      'Attack-category effects have main-sprite previews for skills #1–#20; passive and buff slots have no weapon-attack sequence. Part library exports body timeline only.'],
  }
}

export function resolvePose(layers, directionKey = 'down', pose = 0, idleOffset = 0, options = {}) {
  const direction = DIRECTIONS.find(d => d.key === directionKey) || DIRECTIONS[0]
  const mount = layers.find(l=>l.slot==='mount' && l.companion && l.visible)
  const hasComposite = layers.some(l => l.visible && (l.companion?.rig?.kind || l.title))
  const mountedAttack = Boolean(mount && options.motion==='attack' && options.clientAttack && mount.companion.mountedAttack?.status==='ready' && mount.companion.mountedAttack.skillIds.includes(options.clientSkillId ?? 0))
  const mounted = mount ? companionFrame(mount.companion,directionKey,mountedAttack ? options.mountEntry?.motion ?? 'idle' : options.motion,mountedAttack ? options.mountEntry?.tick ?? 0 : options.tick) : null
  if (mounted) { options={...options,clientBodyFrame:mountedAttack ? options.clientBodyFrame : mounted.bodyFrame,experimentalAttack:false}; idleOffset=0 }
  const hasClientWeapon = layers.some(layer => layer.slot === 'weapon' && layer.clientWeapon)
  const clientFrame = options.clientBodyFrame ?? (hasClientWeapon && !options.experimentalAttack ? [0, 2, 3][Math.max(0, Math.min(2, Math.trunc(pose)))] : undefined)
  const step = clientFrame !== undefined ? [0, 0, 1, 2, 3, 4][clientFrame] : Math.max(0, Math.min(options.experimentalAttack ? 4 : 2, Math.trunc(pose)))
  const anchorStep = clientFrame !== undefined ? clientFrame : options.experimentalAttack ? Math.max(0, Math.min(5, Math.trunc(options.anchorPose ?? step))) : step
  const resolved = layers.map(layer => {
    if (!layer.poseFrames?.length || !layer.poseOffsets?.length) return { ...layer }
    const index = layer.poseFrames.length === 15 ? direction.group * 5 + step : direction.group
    const frame = layer.poseFrames[index]
    const clientDirection = { down: 0, up: 1, left: 2, right: 3 }[direction.key]
    const usesClientMirror=clientFrame !== undefined || layer.provenance==='official-client-4.0.3'
    const offset = layer.poseOffsets[(usesClientMirror && clientDirection === 3 ? 12 : direction.anchor) + anchorStep]
    if (!frame || !offset) return { ...layer }
    const [baseX, baseY] = layer.poseOffsets[0]
    return {
      ...layer,
      ...(directionKey === 'down' && step === 0 && !options.experimentalAttack && clientFrame === undefined ? {} : frame),
      x: (usesClientMirror && clientDirection === 3 ? -offset[0] - frame.w : offset[0]) + layer.x - baseX,
      y: offset[1] + layer.y - baseY,
      flipX: direction.flipX,
    }
  })
  const head = resolved.find(l => l.slot === 'head')
  const baseHead = layers.find(l => l.slot === 'head')
  const pants = resolved.find(l => l.slot === 'pants' && l.visible)
  const breathing = resolved.map(layer => {
    if(layer.slot==='eyes' && layer.provenance==='official-client-4.0.3' && direction.key==='up')return {...layer,visible:false}
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
      if(!frame)return {...layer,visible:false}
      return { ...layer, asset: { ...weapon.splash, id: weapon.splash.source }, sx: frame.sx, sy: frame.sy, w: frame.w, h: frame.h,
        x: frame.x, y: frame.y, flipX: false, renderFront: !behind }
    }
    const frame = weapon.frames[dir], offset = weapon.offsets[dir][Math.min(bodyFrame, 2)]
    return { ...layer, ...frame, x: offset[0], y: offset[1], flipX: false, renderFront: !behind }
  }).flatMap((layer, index) => {
    if (layer.title) {
      const frame = titleFrame(layer.title, options.titleTick ?? options.tick, mounted?.seat ?? 0)
      return frame.pieces.map((p, order) => ({...layer,...p,frame:frame.frame,
        x:p.x+layer.x,y:p.y+layer.y,renderKey:`title:piece:${p.pieceIndex}`,renderDepth:layers.length+20+order/1000}))
    }
    if (layer.companion) {
      const frame=layer.slot==='mount' && mountedAttack ? mounted : companionFrame(layer.companion,directionKey,options.motion,options.tick)
      if (frame.pieces) return frame.pieces.map(p => {
        const depth = layer.slot === 'mount' ? (p.front ? layers.length + 4 : -3) : layers.length + 5
        // Preserve source piece order even when pooled sprites change layers between frames.
        return { ...layer, ...p, frame: frame.frame, seat: frame.seat,
          renderKey: p.pieceIndex === 0 ? layer.slot : layer.slot + ':piece:' + p.pieceIndex,
          renderDepth: depth + p.pieceIndex / (frame.pieces.length + 1) * 0.1 }
      })
      return {...layer,...frame,renderDepth:layer.slot==='mount'?(frame.front?layers.length+1:-1):layers.length+3}
    }
    const placed = mounted ? {...layer,y:layer.y-mounted.seat,visible:layer.slot==='pants'?false:layer.visible} : layer
    // Composite expansion must not change body/weapon depth by shifting array indices.
    if (hasComposite) {
      return { ...placed, renderDepth: layer.renderDepth ?? (layer.slot === 'weapon' && layer.clientWeapon ? (layer.renderFront ? layers.length + 2 : -2) : index) }
    }
    return placed
  })
}

export function paintLayers(ctx, layers, images, originX, originY) {
  const ordered = layers.map((layer, index) => ({ layer, index, depth: layer.renderDepth ?? (layer.slot === 'weapon' && layer.clientWeapon ? (layer.renderFront ? layers.length+2 : -2) : index) })).sort((a, b) => a.depth - b.depth)
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
