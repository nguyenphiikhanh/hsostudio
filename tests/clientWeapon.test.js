import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import initSqlJs from 'sql.js'
import { clientBasicPhase, resolvePose } from '../src/lib/characterPose.js'

const SQL = await initSqlJs()
const db = new SQL.Database(await readFile(new URL('../public/game/catalog.sqlite', import.meta.url)))
const ref = JSON.parse(db.exec('SELECT definition FROM hso_client_reference')[0].values[0][0])
const rows = db.exec('SELECT definition FROM hso_weapon_sheets')[0].values.map(([value]) => JSON.parse(value))
db.close()

test('normal weapon class/part mapping and offset row match CRes and MainObject for all 96 records', () => {
  for (const record of rows) {
    const weapon = { slot: 'weapon', clazz: record.clazz, asset: record, x: 0, y: 0, visible: true,
      clientWeapon: { ...record, splash: { ...ref.classes[record.clazz].splash, source: 'wps' } } }
    for (const [dir, direction] of ['down', 'up', 'left', 'right'].entries()) for (let frame = 0; frame < 4; frame++) {
      const [resolved] = resolvePose([weapon], direction, 0, 0, { clientBodyFrame: frame })
      assert.equal(resolved.sx, record.frames[dir].sx)
      assert.deepEqual([resolved.x, resolved.y], record.offsets[dir][Math.min(frame, 2)])
      assert.equal(resolved.flipX, false)
      assert.equal(resolved.renderFront, dir === 1)
    }
  }
})

test('basic attack frames use exact WPS crop and position; no weapon rotation or body-follow inference', () => {
  for (const record of rows.filter(record => record.part === 0)) {
    const splash = ref.classes[record.clazz].splash
    const weapon = { slot: 'weapon', clazz: record.clazz, asset: record, visible: true, clientWeapon: { ...record, splash: { ...splash, source: 'wps' } } }
    for (const [dir, direction] of ['down', 'up', 'left', 'right'].entries()) for (let tick = 0; tick < 8; tick++) {
      const phase = clientBasicPhase(tick)
      assert.equal(phase.bodyFrame, tick < 4 ? 4 : 5)
      assert.equal(phase.weaponFrame, tick < 4 ? 4 : tick)
      const [rendered] = resolvePose([weapon], direction, 0, 0, { clientAttack: true, clientBodyFrame: phase.bodyFrame, clientWeaponFrame: phase.weaponFrame })
      const expected = splash.frames[dir][phase.weaponFrame]
      for (const key of ['sx', 'sy', 'w', 'h', 'x', 'y']) assert.equal(rendered[key], expected[key])
      assert.equal(rendered.asset.density, 1)
      assert.equal(rendered.rotation, undefined)
      assert.equal(rendered.renderFront, !(dir !== 1 && (record.clazz === 3 ? phase.bodyFrame !== 4 : phase.bodyFrame !== 5)))
    }
    assert.deepEqual(clientBasicPhase(8), { bodyFrame: 0, weaponFrame: 0 })
    assert.equal(resolvePose([weapon], 'down', 3, 0, { experimentalAttack: true })[0].visible, false)
  }
})

test('native body frame 4/5 uses client crop mapping and mirrored side anchor', () => {
  const frames = Array.from({ length: 15 }, (_, i) => ({ sx: i, sy: 0, w: 10, h: 10 }))
  const offsets = Array.from({ length: 24 }, (_, i) => [-i, -i])
  const shirt = { slot: 'shirt', ...frames[0], x: 0, y: 0, poseFrames: frames, poseOffsets: offsets }
  const [left] = resolvePose([shirt], 'left', 0, 0, { clientBodyFrame: 4 })
  const [right] = resolvePose([shirt], 'right', 0, 0, { clientBodyFrame: 4 })
  assert.equal(left.sx, frames[13].sx)
  assert.equal(left.x, offsets[16][0])
  assert.equal(right.x, -offsets[16][0] - frames[13].w)
  assert.equal(right.y, left.y)
  assert.equal(right.flipX, true)
})
