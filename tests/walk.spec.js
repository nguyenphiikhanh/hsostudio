import {test,expect} from '@playwright/test'
import fs from 'node:fs/promises'
import {unzipSync,strFromU8} from 'fflate'
const bodyFrames=[2,2,2,0,0,3,3,3,0,0]
async function pose(page){
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Xuất cho Phaser',exact:false}).click()
 const files=unzipSync(await fs.readFile(await(await pending).path()))
 return JSON.parse(strFromU8(files['character-composition.json']))
}
async function start(page){
 await page.getByRole('tab',{name:'Animation',exact:true}).click()
 await page.getByLabel('Trạng thái nhân vật',{exact:true}).selectOption('walk')
 await page.getByRole('button',{name:'Tạm dừng',exact:true}).click()
 for(let i=0;i<10&&!(await page.locator('.frame-status').textContent()).includes('Đi bộ 1/10');i++)await page.getByRole('button',{name:'Frame tiếp →',exact:true}).click()
 await expect(page.locator('.frame-status')).toContainText('Đi bộ 1/10')
}
const body=doc=>doc.layers.filter(l=>l.slot!=='weapon').map(({frame,name,source,slot,partId,x,y,density,visible,flipX})=>({frame,name,source,slot,partId,x,y,density,visible,flipX}))

test('unarmed walk follows native held frames, and equipping/removing a weapon leaves body geometry unchanged',async({page})=>{
 test.setTimeout(90000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/character-lab');await expect(page.getByLabel('Phái nhân vật',{exact:true})).toBeVisible({timeout:30000})
 await start(page)
 await expect(page.getByTestId('client-walk-status')).toContainText('10 tick × 40 ms')
 await expect(page.getByLabel('Tốc độ animation',{exact:true})).toHaveValue('25')
 await expect(page.getByLabel('Tốc độ animation',{exact:true})).toBeDisabled()
 const snapshots=new Map()
 for(let tick=0;tick<10;tick++){
  await expect(page.locator('.direction-views canvas').first()).toHaveAttribute('data-client-body-frame',String(bodyFrames[tick]))
  await expect(page.locator('.direction-views canvas').first()).toHaveAttribute('data-pose',String([0,0,1,2,3,4][bodyFrames[tick]]))
  if([0,3,5].includes(tick))for(const dir of ['Nhìn trước','Nhìn sau','Sang trái','Sang phải']){
   await page.getByRole('button',{name:`Xem hướng ${dir}`,exact:true}).click()
   const doc=await pose(page);expect(doc.preview.clientWalk).toBe(true);expect(doc.preview.attackOptions.clientBodyFrame).toBe(bodyFrames[tick])
   expect(doc.layers.some(l=>l.slot==='weapon')).toBe(false)
   snapshots.set(`${tick}:${dir}`,body(doc))
  }
  if(tick===5)await page.screenshot({path:'/tmp/hso-unarmed-native-walk.png',fullPage:true})
  await page.getByRole('button',{name:'Frame tiếp →',exact:true}).click()
 }
 await expect(page.locator('.frame-status')).toContainText('Đi bộ 1/10')
 await page.getByRole('tab',{name:'Trang bị',exact:true}).click()
 await page.getByLabel('Vũ khí thường HSO',{exact:true}).selectOption('0')
 await page.getByRole('tab',{name:'Animation',exact:true}).click()
 for(let tick=0;tick<=5;tick++){
  if([0,3,5].includes(tick))for(const dir of ['Nhìn trước','Nhìn sau','Sang trái','Sang phải']){
   await page.getByRole('button',{name:`Xem hướng ${dir}`,exact:true}).click()
   const doc=await pose(page);expect(doc.layers.some(l=>l.slot==='weapon')).toBe(true)
   expect(body(doc)).toEqual(snapshots.get(`${tick}:${dir}`))
  }
  if(tick<5)await page.getByRole('button',{name:'Frame tiếp →',exact:true}).click()
 }
 await page.getByRole('tab',{name:'Trang bị',exact:true}).click()
 await page.getByLabel('Vũ khí thường HSO',{exact:true}).selectOption('')
 await page.getByRole('tab',{name:'Animation',exact:true}).click()
 expect(body(await pose(page))).toEqual(snapshots.get('5:Sang phải'))
 // A companion must not resample the footstep clock using the idle/breathing FPS.
 await page.getByRole('tab',{name:'Trang bị',exact:true}).click()
 await page.getByLabel('Thú cưng',{exact:true}).selectOption('3')
 await page.getByRole('tab',{name:'Animation',exact:true}).click()
 for(let tick=0;tick<10;tick++){
  await expect(page.locator('.direction-views canvas').first()).toHaveAttribute('data-client-body-frame',String(bodyFrames[tick]))
  await page.getByRole('button',{name:'Frame tiếp →',exact:true}).click()
 }
 expect(errors).toEqual([])
})
