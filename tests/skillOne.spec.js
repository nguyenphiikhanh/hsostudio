import {inCharacterTab} from './workspaceTabs.js'
import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import { unzipSync, strFromU8 } from 'fflate'

test('skill one restores class-specific body/WPS and original primary FX in a target preview',async ({page}) => {
  test.setTimeout(90000)
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.on('response',response=>{ if(response.url().includes('/game/') && response.status()>=400) errors.push(response.url()) })
  await page.goto('/')
  const weapon=page.getByLabel('Vũ khí thường HSO',{exact:true})
  await expect(weapon).toBeEnabled({timeout:30000})
  await inCharacterTab(page,'Animation',()=>page.getByLabel('Trạng thái nhân vật',{exact:true}).selectOption('attack'))
  await inCharacterTab(page,'Animation',()=>page.getByRole('button',{name:'Tạm dừng',exact:true}).click())
  for(const [clazz,item,name,trigger] of [[0,0,'Búa địa chấn',9],[1,5,'Nhát chém chí mạng',9],[2,10,'Quả cầu nội lực',9],[3,15,'Phát súng công phá',4]]) {
    await inCharacterTab(page,'Trang bị',()=>page.getByLabel('Phái nhân vật',{exact:true}).selectOption(String(clazz)))
    await inCharacterTab(page,'Trang bị',()=>weapon.selectOption(String(item)))
    await inCharacterTab(page,'Animation',()=>page.getByLabel('Kỹ năng tấn công',{exact:true}).selectOption('1'))
    await expect(page.getByTestId('attack-evidence')).toContainText(name)
    await expect(page.getByLabel('Pose tấn công A',{exact:true})).toHaveCount(0)
    const canvas=page.getByLabel('Preview chiêu 1 và mục tiêu mẫu',{exact:true})
    await expect(canvas).toHaveAttribute('data-tick','0')
    await expect(canvas).toHaveAttribute('data-sprites','0')
    for(let tick=0;tick<trigger;tick++) await inCharacterTab(page,'Animation',()=>page.getByRole('button',{name:'Frame tiếp →',exact:true}).click())
    await expect(canvas).toHaveAttribute('data-effect-frame','0')
    await expect(canvas).toHaveAttribute('data-sprites',clazz===3?'4':'1')
    await page.getByRole('button',{name:'Xem hướng Nhìn trước',exact:true}).click()
    await expect(canvas).toHaveAttribute('data-direction','down')
    await expect(canvas).toHaveAttribute('data-effect-frame','0')
    const down=await canvas.evaluate(c=>c.toDataURL())
    for(const label of ['Sang phải','Sang trái','Nhìn sau']) {
      await page.getByRole('button',{name:`Xem hướng ${label}`,exact:true}).click()
      await expect.poll(()=>canvas.evaluate((c,before)=>c.toDataURL()!==before,down)).toBe(true)
    }
    await canvas.screenshot({path:`/tmp/hso-skill1-class-${clazz}.png`})
  }
  const pending=page.waitForEvent('download')
  await page.getByRole('button',{name:'Xuất thư viện part',exact:true}).click()
  const files=unzipSync(await fs.readFile(await (await pending).path()))
  const attack=JSON.parse(strFromU8(files['animations.json'])).states.attack
  expect(attack).toMatchObject({clientSkill:true,skillId:1,clazz:3,internalSkillId:19,plashType:8,effectTick:4,fps:25,experimental:false})
  expect(attack.frames).toHaveLength(15)
  expect(errors).toEqual([])
})
