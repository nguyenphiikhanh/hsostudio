import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,readFile,readdir,rm,stat,symlink,mkdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {gzipSync,gunzipSync,brotliDecompressSync} from 'node:zlib'
import {randomBytes} from 'node:crypto'
import {createServer,request} from 'node:http'
import {compressDirectory,compressedPreview,compressionPlugin} from '../build/compression.js'

test('production sidecars round-trip JS, SQLite and WASM, skip PNG/tiny/incompressible files and retain originals',async()=>{
 const root=await mkdtemp(join(tmpdir(),'studio-compression-'))
 try{
  const payload=Buffer.from('const example = "unchanged";\n'.repeat(300))
  for(const name of ['app.js','catalog.sqlite','sql.wasm'])await writeFile(join(root,name),payload)
  await writeFile(join(root,'image.png'),payload);await writeFile(join(root,'tiny.json'),'{}');await writeFile(join(root,'noise.css'),randomBytes(4096));await writeFile(join(root,'tiny.json.gz'),'stale')
  const report=await compressDirectory(root);assert.equal(report.files,4)
  for(const name of ['app.js','catalog.sqlite','sql.wasm']){
   assert.deepEqual(await readFile(join(root,name)),payload)
   assert.deepEqual(gunzipSync(await readFile(join(root,name+'.gz'))),payload)
   assert.deepEqual(brotliDecompressSync(await readFile(join(root,name+'.br'))),payload)
   assert.ok(Math.abs((await stat(join(root,name))).mtimeMs-(await stat(join(root,name+'.br'))).mtimeMs)<2)
  }
  const files=await readdir(root)
  for(const name of ['image.png','tiny.json','noise.css']){assert.ok(!files.includes(name+'.gz'));assert.ok(!files.includes(name+'.br'))}
  assert.ok(report.gzip<report.original);assert.ok(report.br<report.original)
  const plugin=compressionPlugin();assert.equal(plugin.apply({}, {command:'serve',isPreview:false}),false);assert.equal(plugin.apply({}, {command:'serve',isPreview:true}),true)
 }finally{await rm(root,{recursive:true,force:true})}
})
function get(port,path,encoding,method='GET',extra={}){
 return new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path,method,headers:{...(encoding===undefined?{}:{'Accept-Encoding':encoding}),...extra}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}))});req.on('error',reject);req.end()})
}
test('HTTP preview negotiates gzip/Brotli, preserves MIME/HEAD/base path, and leaves missing assets/ranges to the existing server',async()=>{
 const root=await mkdtemp(join(tmpdir(),'studio-encoding-')),outside=await mkdtemp(join(tmpdir(),'studio-outside-'))
 const source=Buffer.from('export const preview = true;\n'.repeat(300))
 let server
 try{
  await mkdir(join(root,'game'));await writeFile(join(root,'app.js'),source);await writeFile(join(root,'index.html'),source);await writeFile(join(root,'game/catalog.sqlite'),source)
  await writeFile(join(outside,'secret.js'),source);await writeFile(join(outside,'sidecar.gz'),gzipSync(source));await symlink(join(outside,'secret.js'),join(root,'escape.js'))
  await compressDirectory(root)
  await writeFile(join(root,'unsafe.js'),source);await symlink(join(outside,'sidecar.gz'),join(root,'unsafe.js.gz'))
  const middleware=compressedPreview(root,'/studio/')
  server=createServer((req,res)=>middleware(req,res,()=>{res.writeHead(404);res.end('fallback')}));await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});const port=server.address().port
  for(const [header,expected]of [['gzip, br','br'],['br;q=0,gzip','gzip'],['gzip;q=1,br;q=0.5','gzip'],['*;q=0.8','br']]){
   const r=await get(port,'/studio/app.js?v=1',header);assert.equal(r.status,200);assert.equal(r.headers['content-encoding'],expected);assert.match(r.headers.vary,/Accept-Encoding/);assert.match(r.headers['content-type'],/javascript/)
   assert.deepEqual(expected==='br'?brotliDecompressSync(r.body):gunzipSync(r.body),source)
  }
  const head=await get(port,'/studio/game/catalog.sqlite','br','HEAD');assert.equal(head.status,200);assert.equal(head.body.length,0);assert.equal(head.headers['content-type'],'application/vnd.sqlite3');assert.ok(Number(head.headers['content-length'])>0)
  assert.equal((await get(port,'/studio/character-lab','br')).headers['content-encoding'],'br')
  for(const path of ['/studio/game/missing.json','/studio/escape.js','/studio/unsafe.js','/studio/%2e%2e%2fsecret.js','/other/app.js'])assert.equal((await get(port,path,'gzip')).status,404)
  for(const header of [undefined,'identity','br;q=0,gzip;q=0'])assert.equal((await get(port,'/studio/app.js',header)).status,404)
  assert.equal((await get(port,'/studio/app.js','br','GET',{Range:'bytes=0-10'})).status,404)
 }finally{if(server?.listening)await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});await rm(outside,{recursive:true,force:true})}
})
