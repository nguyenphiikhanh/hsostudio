import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import initSqlJs from 'sql.js'
import { compilePart } from '../src/lib/library/partSchema.js'
import { DIRECTIONS, resolvePose, paintLayers } from '../src/lib/characterPose.js'

const SQL = await initSqlJs()
const db = new SQL.Database(await readFile(new URL('../public/game/catalog.sqlite', import.meta.url)))
const [{ columns, values }] = db.exec(`SELECT a.*, p.slot, p.part_id, t.frames, t.offsets, t.density, t.note, p.provenance
  FROM character_textures t JOIN character_parts p ON p.asset_id=t.base_asset JOIN assets a ON a.id=t.asset_id`)
const rows = values.map(values => Object.fromEntries(columns.map((key, i) => [key, values[i]])))
db.close()
const definition = row => ({ slot: row.slot, partId: row.part_id, width: row.width, height: row.height,
  frames: JSON.parse(row.frames), offsets: JSON.parse(row.offsets), density: row.density, provenance: row.provenance })

test('all x4 frame crops fit original sheets and retain logical coordinates in every pose', () => {
  assert.equal(rows.filter(row => row.density === 4).length, 412)
  for (const row of rows) {
    const part = definition(row)
    const { atlas } = compilePart(part, 'x4-test')
    for (const direction of DIRECTIONS) {
      for (const pose of [0, 1, 2]) {
        const [layer] = resolvePose([{ ...part.frames[0], slot: row.slot, provenance: row.provenance,
          x: part.offsets[0][0], y: part.offsets[0][1], poseFrames: part.frames, poseOffsets: part.offsets,
          asset: { width: row.width, height: row.height, density: row.density }, visible: true }], direction.key, pose)
        const draws = []
        const ctx = { save() {}, restore() {}, translate() {}, scale() {}, drawImage(...args) { draws.push(args.slice(1)) } }
        paintLayers(ctx, [layer], [{}], 0, 0)
        if (layer.visible) {
          assert.equal(draws.length, 1, row.source)
          assert.deepEqual(draws[0], [layer.sx * row.density, layer.sy * row.density, layer.w * row.density, layer.h * row.density, 0, 0, layer.w, layer.h])
        }
      }
    }
    for (const [index, frame] of part.frames.entries()) {
      const actual = atlas.frames[`${row.slot}-${row.part_id}-frame-${index}`].frame
      assert.deepEqual(actual, { x: frame.sx * row.density, y: frame.sy * row.density, w: frame.w * row.density, h: frame.h * row.density })
    }
  }
})

test('different x4 layouts use their own packet metadata; broken x4 sheets fall back explicitly', () => {
  const pants45 = rows.find(row => row.slot === 'pants' && row.part_id === 45)
  assert.equal(pants45.source, 'part_char/imgver/x4/0_45')
  assert.equal(JSON.parse(pants45.frames)[0].h, 11)
  const shirt44 = rows.find(row => row.slot === 'shirt' && row.part_id === 44)
  assert.equal(JSON.parse(shirt44.frames)[0].h, 13)
  for (const [slot, id] of [['pants', 44], ['shirt', 92]]) {
    const row = rows.find(row => row.slot === slot && row.part_id === id)
    assert.equal(row.density, 1)
    assert.ok(row.source.includes('/x1/'))
    assert.match(row.note, /vượt PNG/)
  }
})

test('old v1 definitions without density still compile with original pixel crops', () => {
  const old = definition(rows.find(row => row.slot === 'eyes'))
  delete old.density
  assert.deepEqual(compilePart(old, 'legacy').atlas.frames['eyes-0-frame-0'].frame, { x: 0, y: 0, w: 7, h: 2 })
  assert.throws(() => compilePart({ ...old, density: 0 }, 'bad'), /density/)
})


test('every shirt keeps the pants waist fixed throughout breathing in all four directions', () => {
  const pants = definition(rows.find(row => row.slot === 'pants' && row.part_id === 0))
  const pantsLayer = { slot: 'pants', ...pants.frames[0], x: pants.offsets[0][0], y: pants.offsets[0][1],
    poseFrames: pants.frames, poseOffsets: pants.offsets, visible: true }
  for (const row of rows.filter(row => row.slot === 'shirt')) {
    const part = definition(row)
    const layer = { slot: 'shirt', ...part.frames[0], x: part.offsets[0][0], y: part.offsets[0][1],
      poseFrames: part.frames, poseOffsets: part.offsets, asset: { density: row.density }, visible: true }
    for (const direction of DIRECTIONS) {
      const [feet, standing] = resolvePose([pantsLayer, layer], direction.key)
      const waist = feet.y > standing.y && feet.y < standing.y + standing.h ? feet.y : standing.y + standing.h
      const fraction = (waist - standing.y) / standing.h
      for (const lift of [-0.5, -1]) {
        const [stillFeet, breathing] = resolvePose([pantsLayer, layer], direction.key, 0, lift)
        assert.ok(Math.abs(breathing.y + breathing.displayHeight * fraction - waist) < 1e-9, row.source)
        assert.equal(stillFeet.y, feet.y)
        assert.equal(breathing.y, standing.y + lift)
        const draws = []
        paintLayers({ save() {}, restore() {}, translate() {}, scale() {}, drawImage(...args) { draws.push(args) } },
          [{ ...breathing, asset: { ...row, density: row.density } }], [{}], 0, 0)
        assert.equal(draws[0].at(-1), breathing.displayHeight)
      }
    }
  }
})
