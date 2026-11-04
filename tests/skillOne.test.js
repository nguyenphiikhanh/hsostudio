import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { clientSkillClip, clientSkillPhase } from '../src/lib/characterPose.js'
import { skillOneScene } from '../src/lib/clientSkillOne.js'
const reference = JSON.parse(await readFile(new URL('../reference/hso403/client.json',import.meta.url)))
const one = reference.skillOne

test('skill #1 maps each class through actual client internal ID, gunner division and trigger', () => {
  assert.deepEqual(one.internalIds,[23,44,46,19])
  assert.deepEqual(one.effectIds,[28,55,59,23])
  for (let clazz = 0; clazz < 4; clazz++) {
    const clip = clientSkillClip(clazz,1)
    assert.equal(clip.internalSkillId,one.internalIds[clazz])
    assert.equal(clip.plashType,one.plashTypes[clazz])
    assert.equal(clip.effectTick,one.effectTicks[clazz])
    const windup = one.windupTicks[clazz]
    assert.equal(clip.frames.length,windup+5)
    assert.deepEqual(clientSkillPhase(clazz,1,windup-1),{bodyFrame:4,weaponFrame:4})
    assert.deepEqual(clientSkillPhase(clazz,1,windup),{bodyFrame:5,weaponFrame:4})
    assert.deepEqual(clientSkillPhase(clazz,1,windup+3),{bodyFrame:5,weaponFrame:7})
    assert.deepEqual(clientSkillPhase(clazz,1,windup+4),{bodyFrame:0,weaponFrame:0})
    assert.deepEqual(clientSkillPhase(clazz,1,31),{bodyFrame:0,weaponFrame:0})
  }
  assert.throws(() => clientSkillClip(0,2),/Unverified/)
})

test('effect PNGs retain locked hashes and exact logical vertical-strip geometry at x4', async () => {
  for (const texture of Object.values(one.textures)) {
    const png = await readFile(new URL(`../reference/hso403/${texture.image}`,import.meta.url))
    assert.equal(createHash('sha256').update(png).digest('hex'),texture.sha256)
    assert.equal(png.readUInt32BE(16),texture.frameWidth*4)
    assert.equal(png.readUInt32BE(20),texture.frameHeight*texture.nFrame*4)
  }
})

test('primary effects begin at their client trigger and complete for all four directions', () => {
  for (let clazz = 0; clazz < 4; clazz++) for (const direction of ['up','down','left','right']) {
    const trigger = one.effectTicks[clazz]
    assert.equal(skillOneScene(clazz,direction,trigger-1,one).sprites.length,0)
    const first = skillOneScene(clazz,direction,trigger,one)
    assert.ok(first.sprites.length>0)
    assert.equal(first.sprites[0].asset.source.split('/').at(-1),`110_${[53,51,17,47][clazz]}`)
    for (let tick = 0; tick < 32; tick++) {
      const scene = skillOneScene(clazz,direction,tick,one)
      for (const sprite of scene.sprites) {
        assert.ok(sprite.frame>=0 && sprite.frame<sprite.asset.nFrame)
        assert.ok(Number.isFinite(sprite.x) && Number.isFinite(sprite.y))
      }
    }
    const last = skillOneScene(clazz,direction,31,one)
    assert.equal(last.sprites.length+last.lines.length,0)
  }
  // Real client: earthquake at target, mage projectile followed by a separate g24 impact.
  assert.equal(skillOneScene(0,'right',9,one).sprites[0].x,40)
  assert.equal(skillOneScene(2,'right',9,one).sprites[0].x,14)
  assert.equal(skillOneScene(2,'right',16,one).sprites[0].asset.source.split('/').at(-1),'110_24')
  const assassin = skillOneScene(1,'right',13,one)
  assert.ok(assassin.lines.length>0)
  assert.deepEqual(assassin,skillOneScene(1,'right',13,one))
})
