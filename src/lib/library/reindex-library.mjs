import { readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { compileTitle } from './titlePose.js'
import { compileCompanion } from './companionPose.js'
import { compilePart, PART_SLOTS } from './partSchema.js'

const root = fileURLToPath(new URL('.', import.meta.url))
const readJSON = async path => JSON.parse(await readFile(join(root, path), 'utf8'))

async function main() {
  const manifest = await readJSON('library.json')
  const equipment = await readJSON('equipment.json')
  const character = await readJSON('character.json')
  const parts = {}, atlases = [], generated = []
  for (const slot of PART_SLOTS) {
    let directories
    try { directories = await readdir(join(root, 'parts', slot), { withFileTypes: true }) }
    catch (error) { if (error.code === 'ENOENT') continue; throw error }
    for (const directory of directories.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))) {
      if (!directory.isDirectory()) continue
      const definition = await readJSON(`parts/${slot}/${directory.name}/part.json`)
      if (definition.slot !== slot || String(definition.partId) !== directory.name) throw new Error(`Folder must match slot/partId: parts/${slot}/${directory.name}`)
      const result = compilePart(definition, manifest.name)
      const png = await readFile(join(root, result.paths.image))
      if (png.length < 24 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.toString('ascii', 12, 16) !== 'IHDR' || png.readUInt32BE(16) !== definition.width || png.readUInt32BE(20) !== definition.height) throw new Error(`PNG size does not match part.json: ${result.paths.image}`)
      parts[result.key] = result.part
      atlases.push(result.atlasEntry)
      generated.push([result.paths.data, result.atlas])
    }
  }
  const companions={mount:{},pet:{}}, companionAtlases=[]
  for(const [slot,folder] of [['mount','mounts'],['pet','pets']]) {
    let directories
    try {directories=await readdir(join(root,folder),{withFileTypes:true})}
    catch(error){if(error.code==='ENOENT')continue;throw error}
    for(const directory of directories){
      if(!directory.isDirectory())continue
      const d=await readJSON(`${folder}/${directory.name}/companion.json`)
      if(d.slot!==slot || d.id!==directory.name)throw new Error('Companion folder must match ID/slot')
      const result=compileCompanion(d,manifest.name)
      const png=await readFile(join(root,result.paths.image))
      if(png.length<24 || png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a' || png.readUInt32BE(16)!==d.asset.width || png.readUInt32BE(20)!==d.asset.height)throw new Error('Companion PNG dimensions do not match metadata')
      companions[slot][d.id]=result.part;companionAtlases.push(result.atlasEntry);generated.push([result.paths.data,result.atlas])
    }
  }
  const titles={}, titleAtlases=[]
  let titleDirectories=[]
  try {titleDirectories=await readdir(join(root,'titles'),{withFileTypes:true})}
  catch(error){if(error.code!=='ENOENT')throw error}
  for(const directory of titleDirectories) {
    if(!directory.isDirectory())continue
    const d=await readJSON(`titles/${directory.name}/title.json`)
    if(d.id!==directory.name)throw new Error('Title folder must match ID')
    const result=compileTitle(d,manifest.name), png=await readFile(join(root,result.paths.image))
    if(png.length<24 || png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a' || png.readUInt32BE(16)!==d.asset.width || png.readUInt32BE(20)!==d.asset.height)throw new Error('Title PNG dimensions do not match metadata')
    titles[d.id]=result.part;titleAtlases.push(result.atlasEntry);generated.push([result.paths.data,result.atlas])
  }
  if(character.title && !titles[character.title.id])throw new Error('Character references missing title')
  for(const [slot,id] of Object.entries(character.companions||{}))if(!companions[slot]?.[id])throw new Error('Character references missing companion')
  if (!Object.keys(parts).length) throw new Error('No part folders found')
  for (const [id, item] of Object.entries(equipment.items)) {
    if(item.slot==='title'){if(!titles[item.titleId])throw new Error(`Item ${id} references missing title`);continue}
    if (!parts[item.partKey] || parts[item.partKey].slot !== item.slot) throw new Error(`Item ${id} references missing or mismatched part ${item.partKey}`)
  }
  for (const [slot, selection] of Object.entries(character.equipment)) {
    if (!parts[selection.partKey] || parts[selection.partKey].slot !== slot) throw new Error(`Character references missing or mismatched part ${selection.partKey}`)
  }
  // Validate every folder and cross-reference before writing any generated files.
  for (const [path, data] of generated) await writeFile(join(root, path), JSON.stringify(data, null, 2) + '\n')
  await writeFile(join(root, 'library.json'), JSON.stringify({ ...manifest, layout: 'per-part-folders', parts, atlases, companions, companionAtlases, titles, titleAtlases }, null, 2) + '\n')
  console.log(`Indexed ${Object.keys(parts).length} parts. Updated atlas.json files and library.json.`)
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
