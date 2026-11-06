import {test,expect} from '@playwright/test'
import fs from 'node:fs/promises'
import {unzipSync,strFromU8} from 'fflate'
test('original client eyes replace the placeholder in previews and the v1 library',async({page})=>{
 test.setTimeout(90000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/')
 const eye=page.getByLabel('Bộ phận Mắt gốc',{exact:true})
 await expect(eye).toBeVisible({timeout:30000});await expect(eye.locator('option')).toHaveCount(17)
 await expect(eye).toHaveValue('jar:x1/c/eye/b8_eye.png')
 await expect(page.getByText('Mắt preview là placeholder x1',{exact:false})).toHaveCount(0)
 await page.getByRole('button',{name:'Tạm dừng',exact:true}).click()
 for(const id of [0,3,8,15]){
  await eye.selectOption(`jar:x1/c/eye/b${id}_eye.png`)
  await expect(page.getByRole('alert')).toHaveCount(0)
 }
 await eye.selectOption('jar:x1/c/eye/b8_eye.png')
 await page.locator('.direction-views').screenshot({path:'/tmp/hso-original-eyes.png'})
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Xuất thư viện part',exact:true}).click()
 const files=unzipSync(await fs.readFile(await(await pending).path()))
 const manifest=JSON.parse(strFromU8(files['library.json']))
 const eyes=Object.values(manifest.parts).filter(p=>p.slot==='eyes')
 expect(eyes).toHaveLength(16)
 expect(eyes.every(p=>p.provenance==='official-client-4.0.3'&&p.density===1&&p.frames.length===3&&p.offsets.length===24)).toBe(true)
 expect(JSON.parse(strFromU8(files['character.json'])).equipment.eyes.partKey).toBe('eyes-8')
 expect(eyes.some(p=>p.provenance==='editor-placeholder')).toBe(false)
 expect(errors).toEqual([])
})
