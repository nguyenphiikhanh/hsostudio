// HSO 4.0.3 MainObject.updateMount / FrameImage.drawFrameNew, PetFly/PetWalk.
export function companionFrame(definition, direction = 'down', motion = 'idle', tick = 0) {
  if(definition.rig?.kind)return compositeFrame(definition,direction,motion,tick)
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
  if(d.rig?.kind) {validateComposite(d);return d}
  if (!a || ![a.frameWidth,a.frameHeight,a.columns,a.rows].every(n=>Number.isInteger(n)&&n>0) || !Number.isInteger(a.density) || a.density<1 || a.density>4 || a.width !== a.frameWidth*a.columns*a.density || a.height !== a.frameHeight*a.rows*a.density) throw new Error(`Invalid ${slot} geometry`)
  for(const direction of ['down','up','left','right'])for(const motion of ['idle','walk'])for(let tick=0;tick<24;tick++) companionFrame(d,direction,motion,tick)
  return d
}

export function compileCompanion(d, libraryName) {
  validateCompanion(d,d.slot)
  if (!/^[a-zA-Z0-9_-]+$/.test(d.id)) throw new Error('Invalid companion ID')
  const folder=`${d.slot==='mount'?'mounts':'pets'}/${d.id}`, key=`${libraryName}-${d.slot}-${d.id}`
  const a=d.asset, atlasFrames={}, frameEntries=[]
  const crops=d.rig?.kind?d.rig.rects:Array.from({length:a.columns*a.rows},(_,frame)=>({sx:Math.floor(frame/a.rows)*a.frameWidth,sy:frame%a.rows*a.frameHeight,w:a.frameWidth,h:a.frameHeight}))
  for(const [frame,crop] of crops.entries()) {
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


export function companionBaseCrop(d) {
  return d.rig?.kind ? {...d.rig.rects[0]} : {sx:0,sy:0,w:d.asset.frameWidth,h:d.asset.frameHeight}
}

function compositeFrame(d,direction,motion,tick) {
  const dir={down:0,up:1,left:2,right:3}[direction]
  if(dir===undefined)throw new Error('Unknown companion direction')
  const r=d.rig,moving=motion==='walk',flip=dir===3
  tick=Math.max(0,Math.trunc(tick))
  let frame,seat=0,bodyFrame,x=40,y=-(r.flightHeight||0)
  if(r.kind==='effect-mount') {
    const group=[3,2,0,1][dir],offset=group*2+Number(moving)
    bodyFrame=moving?3:tick%12<7?0:1
    const clip=r[dir===0?'down':dir===1?'up':'lr'],sheetFrame=moving?clip[tick%clip.length]:(dir===0?5:dir===1?10:0)+bodyFrame
    const pose=moving?[2,2,2,3,3,4,4,4][tick%8]:bodyFrame
    frame=(dir===0?0:dir===1?7:14)+pose+Math.floor(tick/5)%(r.frames.length/21)*21
    const index=sheetFrame===(dir===0?8:dir===1?13:3)?0:sheetFrame===(dir===0?7:dir===1?12:2)?1:2
    seat=moving?r.move[group*3+index]:r.stand[group]
    x=r.dx[offset];y=r.dy[offset]
  } else {
    const timeline=r.animations[(dir===1?4:0)+Number(moving)]
    frame=timeline[tick%timeline.length]
  }
  const source=r.frames[frame]
  if(!source || ![frame,seat,x,y].every(Number.isFinite))throw new Error('Invalid composite companion frame/seat')
  const pieces=source.map((p,index)=>{
    const crop=r.rects[p.image]
    // loadData passes onTop==0 as the FIRST FrameEff argument: listPartTop.
    // The field name is misleading; the original constructor determines the pass.
    const front = r.kind === 'effect-mount' && p.top === 0
    return {...crop,x:x+(flip?-p.x-crop.w:p.x),y:y+p.y,flipX:(p.flip===1)!==flip,imageIndex:p.image,pieceIndex:index,front}
  })
  return {frame,seat,bodyFrame,pieces}
}

function validateComposite(d) {
  const r=d.rig,a=d.asset
  if(!['effect-mount','pet-tool'].includes(r.kind) || (r.kind==='effect-mount')!==(d.slot==='mount'))throw new Error('Invalid composite rig kind')
  if(!a || ![a.width,a.height,a.density].every(Number.isInteger) || a.density<1 || a.density>4 || a.width<=0||a.height<=0)throw new Error('Invalid composite texture')
  if(!Array.isArray(r.rects)||!r.rects.length||!Array.isArray(r.frames)||!r.frames.length)throw new Error('Missing composite geometry')
  for(const crop of r.rects)if(!['sx','sy','w','h'].every(k=>Number.isInteger(crop[k]))||crop.sx<0||crop.sy<0||crop.w<=0||crop.h<=0||(crop.sx+crop.w)*a.density>a.width||(crop.sy+crop.h)*a.density>a.height)throw new Error('Composite crop outside PNG')
  for(const frame of r.frames) {
    if(!Array.isArray(frame))throw new Error('Invalid composite frame')
    for(const p of frame)if(!['image','x','y','flip','top'].every(k=>Number.isInteger(p[k]))||!r.rects[p.image])throw new Error('Invalid composite piece')
  }
  if(r.kind==='effect-mount' && r.frames.length%21)throw new Error('Horse frame groups must contain 21 poses')
  if(r.kind==='pet-tool') {
    for(const index of [0,1,4,5]) {
      const clip=r.animations?.[index]
      if(!Array.isArray(clip)||!clip.length||clip.some(f=>!Number.isInteger(f)||!r.frames[f]))throw new Error('Invalid PetTool idle/walk timeline')
    }
  }
  const cycle=companionCycleLength(d,'walk')
  for(const direction of ['down','up','left','right'])for(const motion of ['idle','walk'])for(let tick=0;tick<cycle;tick++)companionFrame(d,direction,motion,tick)
}

export function companionCycleLength(d,motion='idle') {
  const moving=motion==='walk',gcd=(a,b)=>b?gcd(b,a%b):a
  let lengths
  if(d.rig?.kind==='effect-mount')lengths=moving?[8,d.rig.lr.length,d.rig.up.length,d.rig.down.length,d.rig.frames.length/21*5]:[12,d.rig.frames.length/21*5]
  else if(d.rig?.kind==='pet-tool')lengths=[d.rig.animations[moving?1:0].length,d.rig.animations[moving?5:4].length]
  else lengths=d.slot==='mount'?[moving?9:12]:d.frames[Number(moving)].map(a=>a.length)
  if(lengths.some(n=>!Number.isInteger(n)||n<1))throw new Error('Invalid companion cycle')
  return lengths.reduce((a,b)=>a*b/gcd(a,b),1)
}

export function companionViewport(layers) {
  if(!layers.some(l=>l.visible&&l.companion?.rig?.kind))return {scale:6,x:42,y:92}
  let left=-30,right=80,top=-95,bottom=10
  for(const l of layers) {
    if(!l.visible||!l.companion?.rig?.kind)continue
    const d=l.companion,r=d.rig,anchor=d.slot==='pet'?40:0,padding=d.slot==='mount'?Math.max(...r.dx.map(Math.abs)):0
    for(const frame of r.frames)for(const p of frame){const crop=r.rects[p.image],extent=Math.max(Math.abs(p.x),Math.abs(p.x+crop.w))+padding;left=Math.min(left,anchor-extent);right=Math.max(right,anchor+extent);top=Math.min(top,p.y-(r.flightHeight||0)+(d.slot==='mount'?Math.min(...r.dy):0));bottom=Math.max(bottom,p.y+crop.h+(d.slot==='mount'?Math.max(...r.dy):0))}
  }
  const scale=Math.min(6,624/(right-left+12),624/(bottom-top+12))
  return {scale,x:312/scale-(left+right)/2,y:312/scale-(top+bottom)/2}
}
