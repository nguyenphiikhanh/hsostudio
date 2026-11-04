import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import initSqlJs from 'sql.js'
import { DIRECTIONS, resolvePose } from '../src/lib/characterPose.js'
import { createAttackTrial } from '../src/lib/attackTrial.js'

const SQL = await initSqlJs()
const db = new SQL.Database(await readFile(new URL('../public/game/catalog.sqlite', import.meta.url)))
const [{ columns, values }] = db.exec(`SELECT a.width,a.height,p.slot,t.frames,t.offsets,t.density FROM character_textures t JOIN character_parts p ON p.asset_id=t.base_asset JOIN assets a ON a.id=t.asset_id WHERE p.provenance='packet-metadata'`)
const layers = values.map(values => {
  const row = Object.fromEntries(columns.map((column, index) => [column, values[index]]))
  const frames = JSON.parse(row.frames), offsets = JSON.parse(row.offsets)
  return { slot: row.slot, ...frames[0], x: offsets[0][0], y: offsets[0][1], poseFrames: frames, poseOffsets: offsets, asset: row, visible: true }
})
db.close()

test('all original parts can display trial crop poses 3/4 and anchors 0–5 in four directions', () => {
  for (const direction of DIRECTIONS) for (const pose of [3, 4]) for (let anchorPose = 0; anchorPose < 6; anchorPose++) {
    const posed = resolvePose(layers, direction.key, pose, 0, { experimentalAttack: true, anchorPose })
    for (const [index, part] of posed.entries()) {
      const source = layers[index]
      const expected = source.poseFrames[source.poseFrames.length === 15 ? direction.group * 5 + pose : direction.group]
      for (const key of ['sx', 'sy', 'w', 'h']) assert.equal(part[key], expected[key])
      assert.equal(part.x, source.poseOffsets[direction.anchor + anchorPose][0])
      assert.equal(part.y, source.poseOffsets[direction.anchor + anchorPose][1])
      assert.ok((part.sx + part.w) * part.asset.density <= part.asset.width)
      assert.ok((part.sy + part.h) * part.asset.density <= part.asset.height)
    }
  }
})

test('extra poses require explicit opt-in and trial data never implies recovered timing', () => {
  const trial = createAttackTrial()
  assert.equal(trial.experimental, true)
  assert.equal(trial.provenance, 'studio-trial')
  assert.deepEqual(trial.frames.map(frame => frame.pose), [0, 3, 4, 0])
  assert.equal(trial.repeat, 0)
  const source = layers.find(layer => layer.slot === 'shirt')
  const [legacy] = resolvePose([source], 'down', 4)
  assert.equal(legacy.sx, source.poseFrames[2].sx)
  for (const options of [{ preparePose: 5 }, { strikeAnchor: 6 }, { fps: 0 }]) assert.throws(() => createAttackTrial(options))
  const custom = createAttackTrial({ preparePose: 4, prepareAnchor: 5, strikePose: 3, strikeAnchor: 2 })
  assert.deepEqual(custom.frames.map(frame => [frame.pose, frame.anchorPose]), [[0, 0], [4, 5], [3, 2], [0, 0]])
})
