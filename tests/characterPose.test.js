import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import initSqlJs from 'sql.js'
import { DIRECTIONS, resolvePose, WALK_CYCLE } from '../src/lib/characterPose.js'

const SQL = await initSqlJs()
const database = new SQL.Database(await readFile(new URL('../public/game/catalog.sqlite', import.meta.url)))
const [{ columns, values }] = database.exec('SELECT a.id, a.source, a.width, a.height, p.slot, p.frames, p.offsets FROM character_parts p JOIN assets a ON a.id = p.asset_id WHERE p.provenance = "packet-metadata"')
const parts = values.map(values => {
  const row = Object.fromEntries(columns.map((key, i) => [key, values[i]]))
  const frames = JSON.parse(row.frames), offsets = JSON.parse(row.offsets)
  return { ...frames[0], x: offsets[0][0], y: offsets[0][1], slot: row.slot, visible: true,
    asset: row, poseFrames: frames, poseOffsets: offsets }
})
database.close()

test('all supported parts have valid idle and walking crops in four directions', () => {
  assert.equal(parts.length, 414)
  for (const direction of DIRECTIONS) {
    for (const pose of new Set(WALK_CYCLE)) {
      const layers = resolvePose(parts, direction.key, pose)
      for (const layer of layers) {
        assert.ok(layer.sx >= 0 && layer.sy >= 0 && layer.w > 0 && layer.h > 0, layer.asset.source)
        assert.ok(layer.sx + layer.w <= layer.asset.width && layer.sy + layer.h <= layer.asset.height, layer.asset.source)
        assert.equal(layer.flipX, direction.key === 'right')
      }
    }
  }
})

test('walking swaps clothing rectangles, head direction and preserves position edits', () => {
  const pants = parts.find(p => p.slot === 'pants')
  const edited = { ...pants, x: pants.x + 7, y: pants.y - 3 }
  const [resolved] = resolvePose([edited], 'up', 2)
  assert.equal(resolved.sx, pants.poseFrames[7].sx)
  assert.equal(resolved.sy, pants.poseFrames[7].sy)
  assert.equal(resolved.x, pants.poseOffsets[8][0] + 7)
  assert.equal(resolved.y, pants.poseOffsets[8][1] - 3)
  assert.deepEqual(pants.poseFrames.length, 15)
})

test('eye placeholder hides behind head and uses one eye in side views; manual layers stay intact', () => {
  const head = parts.find(p => p.slot === 'head')
  const eyes = { slot: 'eyes', provenance: 'editor-placeholder', sx: 0, sy: 0, w: 7, h: 2, x: -3, y: -20, visible: true }
  const manual = { slot: null, sx: 1, sy: 2, w: 3, h: 4, x: 5, y: 6, visible: true }
  assert.equal(resolvePose([head, eyes], 'up', 0)[1].visible, false)
  assert.equal(resolvePose([head, eyes], 'left', 1)[1].w, 1)
  assert.equal(resolvePose([head, eyes], 'right', 2)[1].w, 1)
  assert.deepEqual(resolvePose([manual], 'left', 2), [manual])
})


test('idle breathing raises upper body while feet, crops and manual layers stay fixed', () => {
  const base = ['pants', 'shirt', 'head', 'hair'].map(slot => parts.find(p => p.slot === slot))
  for (const direction of DIRECTIONS) {
    const standing = resolvePose(base, direction.key, 0, 0)
    const breathing = resolvePose(base, direction.key, 0, -1)
    standing.forEach((layer, i) => {
      assert.equal(breathing[i].y, layer.y - (layer.slot === 'pants' ? 0 : 1))
      if (layer.slot === 'shirt') {
        const pants = standing.find(part => part.slot === 'pants')
        const fraction = (pants.y - layer.y) / layer.h
        assert.ok(Math.abs(breathing[i].y + breathing[i].displayHeight * fraction - pants.y) < 1e-9)
      }
      for (const key of ['sx', 'sy', 'w', 'h', 'x']) assert.equal(breathing[i][key], layer[key])
    })
  }
})
