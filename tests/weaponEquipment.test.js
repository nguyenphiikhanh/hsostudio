import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import initSqlJs from 'sql.js'
import { weaponEquipmentFacts } from '../src/lib/weaponEquipment.js'

const SQL = await initSqlJs()
const db = new SQL.Database(await readFile(new URL('../public/game/catalog.sqlite', import.meta.url)))
const [{ columns, values }] = db.exec('SELECT id,name,clazz,type,part,level,color FROM item3 WHERE type IN (8,9,10,11,24)')
const items = values.map(row => Object.fromEntries(columns.map((key, index) => [key, row[index]])))
const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='weapon_previews'")
db.close()

test('actual ordinary weapons retain class restrictions and wear slot 0, with no inferred texture', () => {
  assert.equal(tables.length, 0)
  for (let clazz = 0; clazz < 4; clazz++) {
    const ordinary = items.filter(item => item.clazz === clazz && item.type !== 24)
    assert.equal(ordinary.length, 141)
    assert.equal(new Set(ordinary.map(item => item.part)).size, 24)
    assert.ok(ordinary.every(item => item.part >= 0 && item.part <= 23))
    for (const item of ordinary) {
      const own = weaponEquipmentFacts(item, clazz, item.level)
      assert.equal(own.wearSlot, 0)
      assert.equal(own.eligible, true)
      assert.equal(own.cosmeticWeaponId, null)
      assert.equal(own.visualStatus, 'client403-mapping')
      assert.equal(own.texture, undefined)
      assert.equal(weaponEquipmentFacts(item, (clazz + 1) % 4, item.level).eligible, false)
      if (item.level > 1) assert.equal(weaponEquipmentFacts(item, clazz, item.level - 1).eligible, false)
    }
  }
})

test('neutral cosmetic weapons use wear slot 17 and the exact server part+41 rule', () => {
  const cosmetics = items.filter(item => item.type === 24)
  assert.equal(cosmetics.length, 9)
  for (const item of cosmetics) for (let clazz = 0; clazz < 4; clazz++) {
    const facts = weaponEquipmentFacts(item, clazz, 150)
    assert.equal(facts.wearSlot, 17)
    assert.equal(facts.cosmeticWeaponId, item.part + 41)
    assert.equal(facts.eligible, true)
    assert.equal(weaponEquipmentFacts(item, clazz, 149).eligible, false)
    assert.equal(facts.visualStatus, 'unverified')
  }
  assert.throws(() => weaponEquipmentFacts({ type: 0 }, 0, 1), /Not an HSO weapon/)
})
