import {createReadStream} from 'node:fs'
import {readdir,readFile,writeFile,stat,realpath,utimes,rm} from 'node:fs/promises'
import {extname,join,resolve,sep} from 'node:path'
import {promisify} from 'node:util'
import {gzip,brotliCompress,constants} from 'node:zlib'
const gzipAsync=promisify(gzip),brotliAsync=promisify(brotliCompress)
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.wasm':'application/wasm','.sqlite':'application/vnd.sqlite3'}
async function filesIn(root){
 const entries=await readdir(root,{withFileTypes:true}),files=[]
 for(const e of entries){if(e.isDirectory())files.push(...await filesIn(join(root,e.name)));else if(e.isFile()&&types[extname(e.name)])files.push(join(root,e.name))}
 return files
}
export async function compressDirectory(root){
 const files=await filesIn(root),report={files:0,original:0,gzip:0,br:0};let cursor=0
 async function worker(){
  while(cursor<files.length){
   const file=files[cursor++],info=await stat(file)
   if(info.size<256){await Promise.all(['.gz','.br'].map(s=>rm(file+s,{force:true})));continue}
   const source=await readFile(file)
   const variants=[['gzip','.gz',await gzipAsync(source,{level:9})],['br','.br',await brotliAsync(source,{params:{[constants.BROTLI_PARAM_QUALITY]:9}})]]
   report.files++;report.original+=source.length
   for(const [name,suffix,bytes] of variants){
    report[name]+=Math.min(bytes.length,source.length)
    if(bytes.length<source.length){await writeFile(file+suffix,bytes);await utimes(file+suffix,info.atime,info.mtime)}
    else await rm(file+suffix,{force:true})
   }
  }
 }
 await Promise.all(Array.from({length:4},worker));return report
}
function acceptedEncodings(header){
 const values=new Map()
 for(const item of String(header??'').toLowerCase().split(',')){
  const [name,...params]=item.trim().split(';');if(!name)continue
  const q=params.find(p=>p.trim().startsWith('q=')),weight=q?Number(q.trim().slice(2)):1
  values.set(name,Number.isFinite(weight)&&weight>=0&&weight<=1?weight:0)
 }
 return ['br','gzip'].map((name,index)=>({name,q:values.get(name)??values.get('*')??0,index})).filter(e=>e.q>0).sort((a,b)=>b.q-a.q||a.index-b.index)
}
export function compressedPreview(root,base='/'){
 const prefix=base.endsWith('/')?base:base+'/'
 return async(req,res,next)=>{
  if(!['GET','HEAD'].includes(req.method)||req.headers.range)return next()
  try{
   const pathname=new URL(req.url,'http://localhost').pathname
   if(!pathname.startsWith(prefix))return next()
   let relative=decodeURIComponent(pathname.slice(prefix.length))
   if(['','character-lab','catalog','maps'].includes(relative))relative='index.html'
   const type=types[extname(relative)];if(!type)return next()
   const candidate=resolve(root,relative),actualRoot=await realpath(root)
   if(!candidate.startsWith(resolve(root)+sep))return next()
   const original=await realpath(candidate)
   if(!original.startsWith(actualRoot+sep)||!(await stat(original)).isFile())return next()
   const vary=String(res.getHeader('Vary')??'').split(',').map(s=>s.trim()).filter(Boolean)
   res.setHeader('Vary',[...new Set([...vary,'Accept-Encoding'])].join(', '))
   for(const {name} of acceptedEncodings(req.headers['accept-encoding'])){
    const file=original+(name==='br'?'.br':'.gz')
    let actual,info
    try{actual=await realpath(file);if(!actual.startsWith(actualRoot+sep))continue;info=await stat(actual);if(!info.isFile())continue}catch{continue}
    res.setHeader('Content-Type',type);res.setHeader('Content-Encoding',name);res.setHeader('Content-Length',info.size)
    res.setHeader('Cache-Control','no-cache');res.setHeader('X-Content-Type-Options','nosniff')
    if(req.method==='HEAD')return res.end()
    createReadStream(actual).on('error',e=>res.destroy(e)).pipe(res);return
   }
   return next()
  }catch{return next()}
 }
}
export function compressionPlugin(){
 let config
 return {name:'studio-precompressed-assets',apply:(_config,{command,isPreview})=>command==='build'||Boolean(isPreview),configResolved(value){config=value},
  async closeBundle(){
   if(config.command!=='build')return
   const report=await compressDirectory(resolve(config.root,config.build.outDir))
   const kb=n=>(n/1024).toFixed(1)+' KiB'
   config.logger.info(`[compression] ${report.files} files: ${kb(report.original)} → gzip ${kb(report.gzip)} / Brotli ${kb(report.br)}`)
  },
  configurePreviewServer(server){server.middlewares.use(compressedPreview(resolve(server.config.root,server.config.build.outDir),server.config.base))},
 }
}
