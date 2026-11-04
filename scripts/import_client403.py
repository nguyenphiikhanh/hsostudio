from pathlib import Path
from zipfile import ZipFile
import hashlib,json,struct,sys
from prepare_catalog import pngs
BASE=Path(__file__).resolve().parents[1]
if len(sys.argv) != 2:
 raise SystemExit('Usage: python3 scripts/import_client403.py /path/to/KnightOnline_v403.jar')
jar=Path(sys.argv[1]);digest=hashlib.sha256(jar.read_bytes()).hexdigest()
assert digest=='f023b34e0ba0a3dcf44249ed5f90b78f0427deee4668562b8e3a0e9e349b18c6'
out=BASE / 'reference/hso403';out.mkdir(parents=True,exist_ok=True)
reference={'version':'4.0.3','jarSha256':digest,'publisherPage':'https://gomobi.vn/home/game/Knight-Age-7.html','jarUrl':'http://dl.teamobi.com/wap/bin/KnightOnline_v403.jar','verifiedMethods':['CRes.getFromRms','CRes.GetWPSplashInfo','CRes.getImgWeaPone','MainObject.setWearingEquip','MainObject.paintWeapon','CharPartInfo.paint','MainListSkill.mSkillAllClasses','SplashSkill.update','TemCanvas.run'],'tickMs':40,'directions':{'down':0,'up':1,'left':2,'right':3},'bodyCropByFrame':[0,0,1,2,3,4],'basicSkillIds':[15,15,31,31],'basicPlashTypes':[0,0,0,0],'classBytecodeSha256':{},'classes':[]}
with ZipFile(jar) as z:
 for cls in ['Model/CRes','GameObjects/MainObject','GameObjects/CharPartInfo','Skill/MainListSkill','Skill/ListSkill','Skill/SplashSkill','com/silverknight/TemCanvas','GameEffect/EffectSkill','GameEffect/EffectEnd','Main/ImageEffect','Model/FrameImage']:
  reference['classBytecodeSha256'][cls]=hashlib.sha256(z.read(cls+'.class')).hexdigest()
 for clazz,folder in enumerate(['kiem','songkiem','phapsu','sung']):
  matches=[]; weapons=[]
  for i in range(18):
   d=(BASE.parent / f'hso/data/part_char/imgver/x1/{50+clazz}_{i}').read_bytes();png,w,h=next(pngs(d));tail=d[d.index(png)+len(png):]
   assert tail==z.read(f'weapon/{folder}/{i}_data')
   assert png==z.read(f'x1/weapon/{folder}/{i}.png')
   matches.append(i)
   weapons.append({'part':i,'metadataHex':tail.hex(),'pngSha256':hashlib.sha256(png).hexdigest()})
  image=z.read(f'x1/wps/{folder}/0.png');png,w,h=next(pngs(image));assert png==image
  raw=z.read(f'wps/{folder}/0_data');assert len(raw)==192
  frames=[]
  for direction in range(4):
   row=[]
   for frame in range(8):
    sx,sy,x,y,fw,fh=struct.unpack_from('>BBbbBB',raw,(direction*8+frame)*6)
    assert sx+fw<=w and sy+fh<=h
    row.append({'sx':sx,'sy':sy,'w':fw,'h':fh,'x':x,'y':y})
   frames.append(row)
  path=f'wps-{clazz}.png';(out/path).write_bytes(image)
  reference['classes'].append({'clazz':clazz,'folder':folder,'weaponFamily':50+clazz,'identicalServerPngAndMetadataParts':matches,'weaponReferences':weapons,'splash':{'image':path,'width':w,'height':h,'density':1,'sha256':hashlib.sha256(image).hexdigest(),'metadataHex':raw.hex(),'frames':frames}})
# Constants traced through MainListSkill -> ListSkill -> SplashSkill/EffectSkill.
reference['skillOne'] = {
 'internalIds': [23,44,46,19], 'rawPlashTypes': [1,1,1,16],
 'plashTypes': [1,1,1,8], 'windupTicks': [6,6,6,10],
 'effectTicks': [9,9,9,4], 'effectIds': [28,55,59,23],
 'textures': {}, 'verifiedMethods': ['MainListSkill.mEffectKill','ListSkill.setFireSkill','ListSkill.updateEffSkill','EffectSkill.set_New_Effect','EffectSkill.create_Kiem_Lv2','EffectSkill.create_Sung_Lv3','EffectSkill.paint','EffectSkill.update','ImageEffect.getEffectImgFromRMS','FrameImage.drawFrameEffectSkill']
}
for effect_id, fw, fh, count in [(17,20,20,4),(24,38,38,3),(47,15,15,3),(51,70,70,3),(53,62,64,3),(60,30,32,4)]:
 for density in [4,1]:
  source=f'part_char/imgver/x{density}/110_{effect_id}'
  packet=(BASE.parent/'hso/data'/source).read_bytes()
  png,w,h=next(pngs(packet))
  if (w,h) != (fw*density,fh*count*density):
   continue
  path=f'fx-{effect_id}.png'; (out/path).write_bytes(png)
  reference['skillOne']['textures'][str(effect_id)] = {'id': source, 'source': source, 'image': path, 'width': w, 'height': h, 'density': density, 'frameWidth': fw, 'frameHeight': fh, 'nFrame': count, 'sha256': hashlib.sha256(png).hexdigest()}
  break
 else:
  raise ValueError(f'No verified geometry for effect {effect_id}')
(out/'client.json').write_text(json.dumps(reference,ensure_ascii=False,indent=2)+'\n')
print('Imported locked client 4.0.3 reference: 72 exact PNG + metadata matches, 4 original WPS sheets, 6 server skill #1 textures.')
