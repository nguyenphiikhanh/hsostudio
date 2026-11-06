// HSO 4.0.3 MainObject.updateMount / FrameImage.drawFrameNew, PetFly/PetWalk.
export function companionFrame(definition, direction = 'down', motion = 'idle', tick = 0) {
  const dir = { down:0, up:1, left:2, right:3 }[direction]
  if (dir === undefined) throw new Error(`Unknown direction: ${direction}`)
  const d = definition, a = d.asset, moving = motion === 'walk'
  tick = Math.max(0,Math.trunc(tick))
  let frame, x = 0, y = 0, seat = 0, front = false, bodyFrame
  if (d.slot === 'mount') {
    const group = [3,2,0,1][dir], rig = d.rig
    bodyFrame = moving ? 3 : tick % 12 < 7 ? 0 : 1
    const clip = rig[dir === 0 ? 'down' : dir === 1 ? 'up' : 'lr']
    frame = moving ? clip[tick % clip.length] : (dir === 0 ? 5 : dir === 1 ? 10 : 0) + bodyFrame
    const offset = group*2 + Number(moving)
    x = rig.dx[offset]; y = rig.dy[offset]
    const index = frame === (dir === 0 ? 8 : dir === 1 ? 13 : 3) ? 0 : frame === (dir === 0 ? 7 : dir === 1 ? 12 : 2) ? 1 : 2
    seat = moving ? rig.move[group*3+index] : rig.stand[group]
    front = rig.front.includes(frame)
  } else {
    const clip = d.frames[Number(moving)][Math.min(dir,2)]
    frame = clip[tick%clip.length]
    // Settled idle for fly-and-walk pets: PetFly.roam lands at yfly<=0,
    // and update overrides both crop coordinates to zero.
    if (d.movement === 2 && !moving) frame = 0
    y = d.movement === 1 || (d.movement === 2 && moving) ? -50 : 0
    // Layout fixture; original following position depends on owner history/RNG.
    x = 40
  }
  if(!Number.isInteger(frame) || frame<0 || ![x,y,seat].every(Number.isFinite))throw new Error(`Invalid ${d.slot} frame/anchor` )
  const column = Math.floor(frame/a.rows), row = frame%a.rows
  if (column >= a.columns || row < 0) throw new Error(`Frame outside ${d.slot}/${d.id}: ${frame}`)
  return { sx:column*a.frameWidth,sy:row*a.frameHeight,w:a.frameWidth,h:a.frameHeight,
    x:x-a.frameWidth/2,y:y-a.frameHeight,flipX:dir===3,frame,seat,front,bodyFrame }
}

export function validateCompanion(d, slot) {
  if (!d || d.status !== 'ready' || d.slot !== slot) throw new Error(`Unsupported ${slot}`)
  const a=d.asset
  if (!a || ![a.frameWidth,a.frameHeight,a.columns,a.rows].every(n=>Number.isInteger(n)&&n>0) || !Number.isInteger(a.density) || a.density<1 || a.density>4 || a.width !== a.frameWidth*a.columns*a.density || a.height !== a.frameHeight*a.rows*a.density) throw new Error(`Invalid ${slot} geometry`)
  for(const direction of ['down','up','left','right'])for(const motion of ['idle','walk'])for(let tick=0;tick<24;tick++) companionFrame(d,direction,motion,tick)
  return d
}

export function compileCompanion(d, libraryName) {
  validateCompanion(d,d.slot)
  if (!/^[a-zA-Z0-9_-]+$/.test(d.id)) throw new Error('Invalid companion ID')
  const folder=`${d.slot==='mount'?'mounts':'pets'}/${d.id}`, key=`${libraryName}-${d.slot}-${d.id}`
  const a=d.asset, atlasFrames={}, frameEntries=[]
  for(let frame=0;frame<a.columns*a.rows;frame++) {
    const crop={sx:Math.floor(frame/a.rows)*a.frameWidth,sy:frame%a.rows*a.frameHeight,w:a.frameWidth,h:a.frameHeight}
    frameEntries.push({texture:key,frame:`f${frame}`,crop})
    atlasFrames[`f${frame}`]={frame:{x:crop.sx*a.density,y:crop.sy*a.density,w:crop.w*a.density,h:crop.h*a.density},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:crop.w*a.density,h:crop.h*a.density},sourceSize:{w:crop.w*a.density,h:crop.h*a.density}}
  }
  return {definition:d,part:{...d,frameEntries},paths:{image:`${folder}/sheet.png`,data:`${folder}/atlas.json`,definition:`${folder}/companion.json`},
    atlas:{frames:atlasFrames,meta:{image:'sheet.png',scale:'1',size:{w:a.width,h:a.height}}},atlasEntry:{key,image:`${folder}/sheet.png`,data:`${folder}/atlas.json`,companionId:d.id,slot:d.slot}}
}

export function mountedAttackAllowed(definition, animation) {
  return definition?.slot==='mount' && definition.mountedAttack?.status==='ready'
    && (animation?.clientBasic===true || animation?.clientSkill===true) && animation.experimental===false
    && definition.mountedAttack.skillIds.includes(animation.skillId)
}
