import { validateCompanion } from './companionPose.js'
import { resolvePose } from './characterPose.js'

// Call from Scene.preload(). baseUrl points to the extracted ZIP directory.
export function preloadLibrary(scene, baseUrl, manifest, partKeys = null) {
  const base = baseUrl.replace(/\/$/, '')
  const selected = partKeys ? new Set(partKeys) : null
  for (const atlas of [...manifest.atlases,...(manifest.companionAtlases || [])]) {
    if (selected && atlas.partKey && !selected.has(atlas.partKey)) continue
    scene.load.atlas(atlas.key, `${base}/${atlas.image}`, `${base}/${atlas.data}`)
  }
}

export class EquipmentCharacter {
  constructor(scene, manifest, equipment, animations, outfit, x = 0, y = 0) {
    this.scene = scene
    this.manifest = manifest
    this.items = equipment.items
    this.animations = animations.states
    this.outfit = {}
    this.direction = 'down'
    this.state = 'idle'
    this.elapsed = 0
    this.images = new Map()
    this.companions = {}
    for(const [slot,id] of Object.entries(outfit.companions || {})) {this.validateCompanion(slot,id); this.companions[slot]=String(id)}
    for (const [slot, selection] of Object.entries(outfit.equipment)) {
      this.validatePart(slot, selection.partKey)
      this.outfit[slot] = { ...selection }
    }
    this.container = scene.add.container(x, y)
    this.rebuild()
    this.onUpdate = (_time, delta) => this.update(delta)
    this.onShutdown = () => this.destroy()
    scene.events.on('update', this.onUpdate)
    scene.events.once('shutdown', this.onShutdown)
  }
  validatePart(slot, key) {
    const part = this.manifest.parts[key]
    if (!part || part.slot !== slot) throw new Error(`Part ${key} does not belong to slot ${slot}`)
    if (this.scene.textures && !this.scene.textures.exists(part.frames[0].texture)) throw new Error(`Part ${key} must be preloaded before equipping`)
    return part
  }
  equip(slot, partId) {
    if (!this.manifest.slotOrder.includes(slot)) throw new Error(`Unknown slot ${slot}`)
    if (partId == null) delete this.outfit[slot]
    else {
      const key = `${slot}-${partId}`
      this.validatePart(slot, key)
      this.outfit[slot] = { partKey: key, x: 0, y: 0, visible: true }
    }
    this.rebuild()
    return this
  }
  equipItem(itemId) {
    const item = this.items[String(itemId)]
    if (!item) throw new Error(`Item ${itemId} has no supported part mapping`)
    const part = this.validatePart(item.slot, item.partKey)
    return this.equip(item.slot, part.partId)
  }
  validateCompanion(slot,id) {
    const d=this.manifest.companions?.[slot]?.[String(id)]
    validateCompanion(d,slot)
    if(this.scene.textures && !this.scene.textures.exists(d.frameEntries[0].texture))throw new Error('Companion must be preloaded')
    return d
  }
  setCompanion(slot,id) {
    if(!['mount','pet'].includes(slot))throw new Error('Invalid companion slot')
    if(id===null)delete this.companions[slot]
    else {this.validateCompanion(slot,id);this.companions[slot]=String(id)}
    if(this.companions.mount && this.state==='attack')this.state='idle'
    this.elapsed=0;this.rebuild();return this
  }
  mount(id) {return this.setCompanion('mount',id)}
  setPet(id) {return this.setCompanion('pet',id)}
  equipCompanionItem(kind,itemId) {
    const item=this.manifest.companionInventory?.find(i=>i.kind===kind && i.id===itemId && i.status==='ready')
    if(!item)throw new Error('Unsupported companion item')
    return this.setCompanion(kind,kind==='mount'?item.typeId:item.imageId)
  }
  setState(state, direction = this.direction) {
    if (this.companions.mount && state==='attack')throw new Error('Mounted attack is not supported by this rig')
    if (!this.animations[state]) throw new Error(`Unsupported state ${state}`)
    if (!this.manifest.directions.includes(direction)) throw new Error(`Unsupported direction ${direction}`)
    if (state !== this.state || this.animations[state].repeat === 0) this.elapsed = 0
    this.state = state
    this.direction = direction
    this.render()
    return this
  }
  setPosition(x, y) { this.container.setPosition(x, y); return this }
  rebuild() {
    for (const image of this.images.values()) image.destroy()
    this.images.clear()
    for (const slot of this.manifest.slotOrder) {
      const selected = this.outfit[slot]
      if (!selected) continue
      const part = this.manifest.parts[selected.partKey]
      const entry = part.frames[0]
      const image = this.scene.add.image(0, 0, entry.texture, entry.frame).setOrigin(0, 0)
      this.images.set(slot, image)
      this.container.add(image)
    }
    for(const [slot,id] of Object.entries(this.companions)) {
      const entry=this.manifest.companions[slot][id].frameEntries[0]
      const image=this.scene.add.image(0,0,entry.texture,entry.frame).setOrigin(0,0)
      this.images.set(slot,image);this.container.add(image)
    }
    this.render()
  }
  update(delta) {
    if (this.destroyed) return
    if (!Number.isFinite(delta) || delta < 0) return
    this.elapsed += delta
    this.render()
  }
  render() {
    const animation = this.animations[this.state]
    const tick = Math.floor(this.elapsed * animation.fps / 1000)
    const phase = animation.frames[animation.repeat === 0 ? Math.min(tick, animation.frames.length - 1) : tick % animation.frames.length]
    const layers = this.manifest.slotOrder.filter(slot => this.outfit[slot]).map(slot => {
      const selection = this.outfit[slot], part = this.manifest.parts[selection.partKey]
      const [baseX, baseY] = part.offsets[0]
      return {
        slot, partId: part.partId, provenance: part.provenance, ...part.frames[0].crop,
        x: baseX + (selection.x || 0), y: baseY + (selection.y || 0), visible: selection.visible !== false,
        asset: { width: part.width, height: part.height, density: part.density || 1 },
        ...(part.offsets.length === 24 ? { poseFrames: part.frames.map(f => f.crop), poseOffsets: part.offsets } : {}),
      }
    })
    for(const [slot,id] of Object.entries(this.companions)) {
      const d=this.manifest.companions[slot][id]
      layers.push({slot,companion:d,asset:d.asset,...d.frameEntries[0].crop,x:0,y:0,visible:true})
    }
    const posed = resolvePose(layers, this.direction, phase.pose, phase.idleOffset, { experimentalAttack: animation.experimental === true, anchorPose: phase.anchorPose, clientBodyFrame: phase.clientBodyFrame, motion:this.state,tick:Math.floor(this.elapsed*25/1000) })
    for (const layer of posed) {
      const selection = this.outfit[layer.slot], part = layer.companion ? this.manifest.companions[layer.slot][this.companions[layer.slot]] : this.manifest.parts[selection.partKey]
      const entries=layer.companion?part.frameEntries:part.frames
      const density=layer.companion?part.asset.density:part.density
      const entry = layer.slot === 'eyes' && layer.w === 1 ? part.sideFrame
        : entries.find(f => ['sx', 'sy', 'w', 'h'].every(key => f.crop[key] === layer[key]))
      if (!entry) throw new Error(`Missing frame for ${layer.slot}`)
      this.images.get(layer.slot).setTexture(entry.texture, entry.frame)
        .setScale(1 / (density || 1), (layer.displayHeight ?? layer.h) / layer.h / (density || 1)).setPosition(layer.x, layer.y).setFlipX(Boolean(layer.flipX)).setVisible(layer.visible).setDepth(layer.renderDepth ?? (layer.slot==='weapon'?100:this.manifest.slotOrder.indexOf(layer.slot)))
    }
    this.container.sort('depth')
  }
  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.scene.events.off('update', this.onUpdate)
    this.scene.events.off('shutdown', this.onShutdown)
    this.container.destroy()
    this.images.clear()
  }
}
