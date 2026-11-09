import {inCharacterTab} from './workspaceTabs.js'
import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import { join } from 'node:path'

test('WPS PNG created after Vite starts is served as image and works in attack preview', async ({ page }) => {
  const filename = `wps-live-${Date.now()}.png`
  const destination = join(process.cwd(), 'public/game/client403', filename)
  try {
    await fs.copyFile(join(process.cwd(), 'reference/hso403/wps-0.png'), destination)
    const response = await page.request.get(`/game/client403/${filename}`)
    expect(response.headers()['content-type']).toContain('image/png')
    expect(await response.body()).toEqual(await fs.readFile(destination))
    await page.goto('/')
    await expect(page.getByLabel('Vũ khí thường HSO', { exact: true })).toBeEnabled({ timeout: 30000 })
    await page.evaluate(async image => {
      const { query } = await import('/src/lib/catalog.js')
      const ref = JSON.parse(query('SELECT definition FROM hso_client_reference WHERE id=1')[0].definition)
      ref.classes[0].splash.image = image
      query('UPDATE hso_client_reference SET definition=? WHERE id=1', [JSON.stringify(ref)])
    }, `client403/${filename}`)
    await inCharacterTab(page,'Trang bị',()=>page.getByLabel('Vũ khí thường HSO', { exact: true }).selectOption('0'))
    await inCharacterTab(page,'Animation',()=>page.getByLabel('Trạng thái nhân vật', { exact: true }).selectOption('attack'))
    await expect(page.getByTestId('client-weapon-animation')).toBeVisible()
    await page.waitForTimeout(400)
    await expect(page.getByRole('alert')).toHaveCount(0)
  } finally { await fs.rm(destination, { force: true }) }
})

test('missing game assets return 404 rather than the app HTML, and symlinks cannot escape game/', async ({ page }) => {
  const { tmpdir } = await import('node:os')
  const outside = await fs.mkdtemp(join(tmpdir(), 'hso-static-test-'))
  const link = join(process.cwd(), 'public/game/client403', `outside-${Date.now()}.png`)
  try {
    await fs.writeFile(join(outside, 'outside.png'), 'outside-game-test')
    await fs.symlink(join(outside, 'outside.png'), link)
    const missing = await page.request.get('/game/client403/not-present.png')
    expect(missing.status()).toBe(404)
    expect(missing.headers()['content-type']).not.toContain('text/html')
    const blocked = await page.request.get(`/game/client403/${link.split('/').at(-1)}`)
    expect(blocked.status()).toBe(404)
    expect(await blocked.text()).not.toContain('outside-game-test')
  } finally {
    await fs.rm(link, { force: true })
    await fs.rm(outside, { recursive: true, force: true })
  }
})

test('failed WPS loads identify the actual image URL, not just the JAR resource name', async ({ page }) => {
  await page.route('**/game/client403/wps-0.png', route => route.fulfill({ status: 404, body: 'missing' }))
  await page.goto('/')
  const select = page.getByLabel('Vũ khí thường HSO', { exact: true })
  await expect(select).toBeEnabled({ timeout: 30000 })
  await inCharacterTab(page,'Trang bị',()=>select.selectOption('0'))
  await inCharacterTab(page,'Animation',()=>page.getByLabel('Trạng thái nhân vật', { exact: true }).selectOption('attack'))
  await expect(page.getByRole('alert')).toContainText('Không tải được PNG /game/client403/wps-0.png')
})
