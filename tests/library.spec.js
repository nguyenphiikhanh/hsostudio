import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import { unzipSync, strFromU8 } from 'fflate'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const run = promisify(execFile)

test('library ZIP contains all supported parts and runs equipment swapping in real Phaser', async ({ page }) => {
  test.setTimeout(90000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.getByLabel('Tên bản xuất', { exact: true }).fill('Thư viện Hiệp sĩ')
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Xuất thư viện part', exact: true }).click()
  const download = await pending
  expect(download.suggestedFilename()).toBe('thu-vien-hiep-si-library.zip')
  await download.saveAs('/tmp/hso-part-library.zip')
  const entries = unzipSync(await fs.readFile(await download.path()))
  const json = name => JSON.parse(strFromU8(entries[name]))
  const manifest = json('library.json'), equipment = json('equipment.json'), outfit = json('character.json')
  expect(Object.keys(manifest.parts)).toHaveLength(415)
  expect(manifest.layout).toBe('per-part-folders')
  expect(manifest.resolution).toBe('x4')
  expect(Object.values(manifest.parts).filter(part => part.density === 4)).toHaveLength(412)
  expect(manifest.qualityNotes.filter(note => note.slot !== 'eyes').map(note => `${note.slot}-${note.partId}`)).toEqual(['pants-44', 'shirt-92'])
  expect(manifest.atlases).toHaveLength(415)
  expect(Object.keys(entries).some(path => path.startsWith('atlases/'))).toBe(false)
  expect(manifest.directions.sort()).toEqual(['down', 'left', 'right', 'up'])
  expect(Object.keys(outfit.equipment)).toHaveLength(5)
  expect(Object.keys(equipment.items).length).toBeGreaterThan(100)
  expect(entries['runtime.js']).toBeTruthy()
  expect(entries['example.js']).toBeTruthy()
  expect(Object.keys(entries).some(path => path.startsWith('original-assets/'))).toBe(false)
  const atlases = new Map()
  for (const atlas of manifest.atlases) {
    expect(Buffer.from(entries[atlas.image]).subarray(1, 4).toString()).toBe('PNG')
    atlases.set(atlas.key, json(atlas.data))
  }
  for (const part of Object.values(manifest.parts)) {
    const prefix = `parts/${part.slot}/${part.partId}`
    expect(part.directory).toBe(prefix)
    expect(part.files).toEqual({ image: `${prefix}/sheet.png`, data: `${prefix}/atlas.json`, definition: `${prefix}/part.json` })
    for (const path of Object.values(part.files)) expect(entries[path]).toBeTruthy()
    expect(Buffer.from(entries[part.files.image]).equals(await fs.readFile(join(process.cwd(), 'public/game/images', part.source + (part.source.endsWith('.png') ? '' : '.png'))))).toBe(true)
    for (const entry of [...part.frames, ...(part.sideFrame ? [part.sideFrame] : [])]) {
      const atlas = atlases.get(entry.texture)
      const frame = atlas.frames[entry.frame].frame
      expect(frame.x + frame.w).toBeLessThanOrEqual(atlas.meta.size.w)
      expect(frame.y + frame.h).toBeLessThanOrEqual(atlas.meta.size.h)
      expect(frame.w).toBe(entry.crop.w * (part.density || 1))
      expect(frame.h).toBe(entry.crop.h * (part.density || 1))
    }
  }
  for (const item of Object.values(equipment.items)) expect(manifest.parts[item.partKey].slot).toBe(item.slot)
  expect(json('animations.json').states.idle.fps).toBe(8)
  expect(json('animations.json').states.idle.frames.map(frame => frame.idleOffset)).toEqual([0, -0.5, -1, -0.5])
  expect(json('animations.json').states.walk.frames.map(frame => frame.pose)).toEqual([0, 1, 0, 2])
  // Add an original design by copying a single folder, then run the tool shipped in the ZIP.
  const root = await fs.mkdtemp(join(tmpdir(), 'hso-part-folders-'))
  for (const [path, bytes] of Object.entries(entries)) {
    await fs.mkdir(dirname(join(root, path)), { recursive: true })
    await fs.writeFile(join(root, path), bytes)
  }
  await fs.cp(join(root, 'parts/shirt/0'), join(root, 'parts/shirt/9000'), { recursive: true })
  const definition = json('parts/shirt/0/part.json')
  Object.assign(definition, { partId: 9000, label: 'Custom shirt', provenance: 'custom-design' })
  const pixels = await page.evaluate(({ width, height }) => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ff00ff'; ctx.fillRect(0, 0, width, height)
    return canvas.toDataURL('image/png').split(',')[1]
  }, definition)
  await fs.writeFile(join(root, 'parts/shirt/9000/sheet.png'), Buffer.from(pixels, 'base64'))
  const definitionPath = join(root, 'parts/shirt/9000/part.json')
  const originalCrop = { ...definition.frames[0] }
  definition.frames[0].w = definition.width + 1
  await fs.writeFile(definitionPath, JSON.stringify(definition))
  const before = await fs.readFile(join(root, 'library.json'), 'utf8')
  await expect(run(process.execPath, [join(root, 'reindex-library.mjs')])).rejects.toThrow('Invalid crop')
  expect(await fs.readFile(join(root, 'library.json'), 'utf8')).toBe(before)
  definition.frames[0] = originalCrop
  await fs.writeFile(definitionPath, JSON.stringify(definition))
  const indexed = await run(process.execPath, [join(root, 'reindex-library.mjs')])
  expect(indexed.stdout).toContain('Indexed 416 parts')
  for (const path of ['library.json', 'parts/shirt/9000/sheet.png', 'parts/shirt/9000/part.json', 'parts/shirt/9000/atlas.json']) entries[path] = new Uint8Array(await fs.readFile(join(root, path)))
  expect(Object.keys(json('library.json').parts)).toHaveLength(416)
  expect(JSON.parse(await fs.readFile(join(root, 'parts/shirt/1/atlas.json'), 'utf8'))).toEqual(json('parts/shirt/1/atlas.json'))
  await page.route('**/export-smoke/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/export-smoke/', '')
    if (path === 'index.html') return route.fulfill({ contentType: 'text/html', body: '<html><body><script type="module" src="/tests/libraryHarness.js"></script></body></html>' })
    if (!entries[path]) return route.fulfill({ status: 404, body: path })
    return route.fulfill({ contentType: path.endsWith('.png') ? 'image/png' : path.endsWith('.js') ? 'text/javascript' : 'application/json', body: Buffer.from(entries[path]) })
  })
  await page.goto('/export-smoke/index.html')
  await expect.poll(() => page.evaluate(() => Boolean(window.libraryHarness)), { timeout: 40000 }).toBe(true)
  const result = await page.evaluate(() => {
    const { character, scene, equipment } = window.libraryHarness
    character.setState('walk', 'right').equip('shirt', 1)
    character.elapsed = 125
    character.render()
    const shirt = character.images.get('shirt')
    const swapped = { name: shirt.frame.name, flip: shirt.flipX, y: shirt.y, densityScale: shirt.scaleX, worldWidth: shirt.displayWidth, frameWidth: shirt.frame.width }
    character.equip('shirt', 9000)
    const custom = { frame: character.images.get('shirt').frame.name, flip: character.images.get('shirt').flipX }
    const item = Object.values(equipment.items).find(item => item.slot === 'shirt' && item.partKey !== 'shirt-1')
    character.equipItem(item.id)
    const itemKey = character.outfit.shirt.partKey
    let rejected = false
    try { character.equip('shirt', 99999) } catch { rejected = true }
    const preserved = character.outfit.shirt.partKey === itemKey
    character.equip('helmet', 0)
    const helmet = character.images.has('helmet')
    character.equip('helmet', null)
    const removed = !character.images.has('helmet')
    character.setState('idle', 'up')
    const hiddenEyes = !character.images.get('eyes').visible
    character.elapsed = 0
    character.render()
    const top = character.images.get('shirt')
    const waist = character.images.get('pants').y
    const waistFraction = (waist - top.y) / top.displayHeight
    const hem = top.y + top.displayHeight * waistFraction
    character.elapsed = 250
    character.render()
    const breathingHem = top.y + top.displayHeight * waistFraction
    const breathingLift = top.scaleY > top.scaleX
    const before = scene.events.listenerCount('update')
    character.destroy()
    const cleaned = scene.events.listenerCount('update') === before - 1
    return { swapped, custom, itemKey, expectedItem: item.partKey, rejected, preserved, helmet, removed, hiddenEyes, cleaned, hem, breathingHem, breathingLift }
  })
  expect(result.swapped.name).toBe('shirt-1-frame-11')
  expect(result.swapped.flip).toBe(true)
  expect(result.swapped.densityScale).toBe(0.25)
  expect(result.swapped.worldWidth).toBe(result.swapped.frameWidth / 4)
  expect(result.custom).toEqual({ frame: 'shirt-9000-frame-11', flip: true })
  expect(result.itemKey).toBe(result.expectedItem)
  expect(result.breathingHem).toBeCloseTo(result.hem, 8)
  expect(result.breathingLift).toBe(true)
  for (const key of ['rejected', 'preserved', 'helmet', 'removed', 'hiddenEyes', 'cleaned']) expect(result[key]).toBe(true)
  expect(await page.evaluate(() => window.libraryError)).toBeUndefined()
  expect(errors).toEqual([])
})

test('library export rejects HTML assets instead of downloading a corrupt ZIP', async ({ page }) => {
  const downloads = []
  page.on('download', download => downloads.push(download))
  await page.route('**/game/images/part_char/imgver/x4/0_1.png', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html></html>' }))
  await page.goto('/')
  const button = page.getByRole('button', { name: 'Xuất thư viện part', exact: true })
  await expect(button).toBeEnabled({ timeout: 30000 })
  await button.click()
  await expect(page.getByRole('alert')).toContainText('Không tải được ảnh part:')
  await expect(page.getByRole('alert')).toContainText('part_char/imgver/x4/0_1')
  await expect(button).toBeEnabled()
  expect(downloads).toHaveLength(0)
})
