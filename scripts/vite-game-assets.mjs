import { createReadStream } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

// public/game is excluded from watchers (20k+ files). Bypass Vite's public-file
// snapshot so freshly prepared/imported assets work without restarting Vite.
function liveGameAssets(root, base) {
  const prefix = `${base.replace(/\/$/, '')}/game/`
  const types = { '.png': 'image/png', '.json': 'application/json', '.sqlite': 'application/vnd.sqlite3', '.bin': 'application/octet-stream' }
  return async (request, response, next) => {
    const pathname = new URL(request.url, 'http://localhost').pathname
    if (!pathname.startsWith(prefix)) return next()
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end()
      return
    }
    try {
      const relative = decodeURIComponent(pathname.slice(prefix.length))
      const candidate = resolve(root, relative)
      if (!candidate.startsWith(root + sep)) throw new Error('Outside game directory')
      const [actualRoot, file] = await Promise.all([realpath(root), realpath(candidate)])
      if (!file.startsWith(actualRoot + sep)) throw new Error('Outside game directory')
      const info = await stat(file)
      if (!info.isFile()) throw new Error('Not a file')
      response.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream')
      response.setHeader('Content-Length', info.size)
      response.setHeader('Cache-Control', 'no-cache')
      response.setHeader('X-Content-Type-Options', 'nosniff')
      if (request.method === 'HEAD') return response.end()
      createReadStream(file).on('error', error => response.destroy(error)).pipe(response)
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
      response.end('Game asset not found in the bundled public/game directory. Rebuild the app after restoring its game data.')
    }
  }
}

export default function gameAssetsPlugin() {
  return {
    name: 'live-game-assets',
    configureServer(server) {
      server.middlewares.use(liveGameAssets(resolve(server.config.publicDir, 'game'), server.config.base))
    },
    configurePreviewServer(server) {
      server.middlewares.use(liveGameAssets(resolve(server.config.root, server.config.build.outDir, 'game'), server.config.base))
    },
  }
}
