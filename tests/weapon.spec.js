import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import { unzipSync, strFromU8 } from 'fflate'

test('real HSO weapons render from verified class/part and animate with the official WPS basic attack', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  const ordinary = page.getByLabel('Vũ khí thường HSO', { exact: true })
  const cosmetic = page.getByLabel('Vũ khí thời trang HSO', { exact: true })
  await expect(ordinary).toBeEnabled({ timeout: 30000 })
  await expect(ordinary.locator('option')).toHaveCount(142)
  await expect(cosmetic.locator('option[value="4691"]')).toHaveJSProperty('disabled', true)
  await ordinary.selectOption('0')
  await expect(page.locator('.layer-row')).toHaveCount(6)
  await expect(page.getByTestId('weapon-visual-status')).toContainText('Đang vẽ vũ khí thường')
  await expect(page.getByTestId('verified-weapon-facts')).toContainText('wear[0]')
  await page.getByLabel('Trạng thái nhân vật', { exact: true }).selectOption('attack')
  await expect(page.getByTestId('client-weapon-animation')).toContainText('25 FPS')
  await expect(page.getByLabel('Tốc độ animation', { exact: true })).toHaveValue('25')
  await expect(page.getByLabel('Tốc độ animation', { exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click()
  // Return to a deterministic first attack tick without racing autoplay.
  for (let i = 0; i < 9 && !(await page.locator('.frame-status').textContent()).includes('tick 1/9'); i++) {
    await page.getByRole('button', { name: 'Frame tiếp →', exact: true }).click()
  }
  const canvases = page.locator('.direction-views canvas')
  const before = await canvases.evaluateAll(cs => cs.map(c => c.toDataURL()))
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Frame tiếp →', exact: true }).click()
  await expect.poll(() => canvases.evaluateAll(cs => cs.map(c => c.toDataURL()))).not.toEqual(before)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Xuất cho Phaser', exact: false }).click()
  const files = unzipSync(await fs.readFile(await (await download).path()))
  const config = JSON.parse(strFromU8(files['character-composition.json']))
  const weapon = config.layers.find(layer => layer.slot === 'weapon')
  expect(weapon.source).toBe('jar:x1/wps/kiem/0.png')
  expect(config.preview).toMatchObject({ clientBasic: true, fps: 25 })
  expect(config.preview.attackOptions).toMatchObject({ clientAttack: true, clientBodyFrame: 5, clientWeaponFrame: 5 })
  const libDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Xuất thư viện part', exact: true }).click()
  const lib = unzipSync(await fs.readFile(await (await libDownload).path()))
  const attack = JSON.parse(strFromU8(lib['animations.json'])).states.attack
  expect(attack).toMatchObject({ clientBasic: true, experimental: false, provenance: 'official-client-4.0.3', fps: 25 })
  expect(attack.frames.map(frame => frame.clientBodyFrame)).toEqual([4, 4, 4, 4, 5, 5, 5, 5, 0])
  expect(JSON.parse(strFromU8(lib['character.json'])).omittedLayers.some(layer => layer.name.includes('Gươm đá'))).toBe(true)
  await page.screenshot({ path: '/tmp/hso-client-weapon-attack.png', fullPage: true })
  // The other three classes choose their actual item, not an arbitrary sheet list.
  for (const [clazz, id] of [[1, 5], [2, 10], [3, 15]]) {
    await page.getByLabel('Phái nhân vật', { exact: true }).selectOption(String(clazz))
    await expect(ordinary).toHaveValue('')
    await ordinary.selectOption(String(id))
    await expect(page.getByTestId('client-weapon-animation')).toBeVisible()
    await expect(page.getByLabel('Phái tấn công', { exact: true })).toHaveValue(String(clazz))
    await expect(page.locator('.layer-row')).toHaveCount(6)
  }
  await page.getByLabel('Kỹ năng tấn công', { exact: true }).selectOption('9')
  await expect(page.getByTestId('client-weapon-animation')).toHaveCount(0)
  await expect(page.getByLabel('Pose tấn công A', { exact: true })).toBeVisible()
  await page.getByLabel('Cấp nhân vật để đối chiếu', { exact: true }).fill('150')
  await cosmetic.selectOption('4691')
  await expect(page.getByTestId('verified-weapon-facts').last()).toContainText('61 (part + 41)')
  // A cached pre-client catalog must produce a recovery message, not a Vue/SQLite exception.
  await ordinary.selectOption('')
  await page.evaluate(async () => { const { query } = await import('/src/lib/catalog.js'); query('DROP TABLE hso_weapon_sheets') })
  await ordinary.selectOption('15')
  await expect(page.getByTestId('weapon-visual-status')).toContainText('bộ dữ liệu đóng gói')
  await expect(page.locator('.layer-row')).toHaveCount(5)
  expect(errors).toEqual([])
})
