// MainObject.paintPlayer: FrameName advances every 5 of the 25 Hz client ticks.
// Both name passes draw after the actor, with direction transform 0.
export function titleCycleLength(d) { return d.rig.frames.length * 5 }

export function titleFrame(d, tick = 0, seat = 0) {
  const frame = Math.floor(Math.max(0, Math.trunc(tick)) / 5) % d.rig.frames.length
  const pieces = d.rig.frames[frame].map((p, pieceIndex) => ({
    ...d.rig.rects[p.image], x: p.x, y: p.y + d.binding.originOffsetY - seat, flipX: p.flip === 1,
    pieceIndex, front: p.top === 0,
  })).sort((a, b) => Number(a.front) - Number(b.front) || a.pieceIndex - b.pieceIndex)
  return { frame, pieces }
}

export function validateTitle(d) {
  if (!d || d.slot !== 'title' || d.status !== 'ready' || !/^[a-zA-Z0-9_-]+$/.test(d.id)) throw new Error('Unsupported title')
  if (!Number.isFinite(d.binding?.originOffsetY)) throw new Error('Invalid title origin binding')
  const { asset: a, rig: r } = d
  if (!a || ![a.width,a.height,a.density].every(Number.isInteger) || a.width <= 0 || a.height <= 0 || a.density < 1 || a.density > 4) throw new Error('Invalid title PNG geometry')
  if (!r?.rects?.length || !r.frames?.length) throw new Error('Missing title geometry')
  for (const c of r.rects) if (!['sx','sy','w','h'].every(k=>Number.isInteger(c[k])) || c.sx<0 || c.sy<0 || c.w<=0 || c.h<=0 || (c.sx+c.w)*a.density>a.width || (c.sy+c.h)*a.density>a.height) throw new Error('Title crop outside PNG')
  for (const frame of r.frames) {
    if (!Array.isArray(frame) || !frame.length) throw new Error('Missing title pieces')
    for (const p of frame) if (!['x','y','image','flip','top'].every(k=>Number.isInteger(p[k])) || !r.rects[p.image]) throw new Error('Invalid title piece')
  }
  return d
}

export function compileTitle(d, name) {
  validateTitle(d)
  const folder=`titles/${d.id}`, key=`${name}-title-${d.id}`, a=d.asset
  const frameEntries=d.rig.rects.map((crop,index)=>({texture:key,frame:`f${index}`,crop}))
  // PartFrame indexes the rect array; rect.id need not equal its array index.
  const frames=Object.fromEntries(frameEntries.map(e=>[e.frame,{
    frame:{x:e.crop.sx*a.density,y:e.crop.sy*a.density,w:e.crop.w*a.density,h:e.crop.h*a.density},rotated:false,trimmed:false,
    spriteSourceSize:{x:0,y:0,w:e.crop.w*a.density,h:e.crop.h*a.density},sourceSize:{w:e.crop.w*a.density,h:e.crop.h*a.density},
  }]))
  return {part:{...d,frameEntries},paths:{image:`${folder}/sheet.png`,data:`${folder}/atlas.json`,definition:`${folder}/title.json`},
    atlas:{frames,meta:{image:'sheet.png',scale:'1',size:{w:a.width,h:a.height}}},atlasEntry:{key,image:`${folder}/sheet.png`,data:`${folder}/atlas.json`,titleId:d.id}}
}
