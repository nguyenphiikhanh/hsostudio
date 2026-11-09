import Phaser from 'phaser'
import { loadImage } from '../lib/export'
import { DIRECTIONS, IDLE_CYCLE, WALK_CYCLE, IDLE_FPS, WALK_FPS, paintLayers, resolvePose } from '../lib/characterPose'

const WORLD = { width: 1280, height: 900 }
const START = { x: 640, y: 450 }
const SPAWNS = [{ x: 720, y: 450 }, { x: 870, y: 540 }, { x: 530, y: 580 }]
const ROCKS = [{ x: 390, y: 300, w: 130, h: 60 }, { x: 850, y: 300, w: 100, h: 70 }, { x: 350, y: 650, w: 90, h: 65 }, { x: 920, y: 700, w: 140, h: 55 }]

export async function createPlayableGame(parent, layers, onState) {
  const images = await Promise.all(layers.map(layer => loadImage(layer.asset)))
  const textureDensity = Math.max(1, ...layers.map(layer => layer.asset.density || 1))
  let activeScene
  let ready
  const initialized = new Promise(resolve => { ready = resolve })

  class Arena extends Phaser.Scene {
    constructor() { super('arena') }
    create() {
      activeScene = this
      this.hp = 100
      this.kills = 0
      this.mode = 'ready'
      this.elapsed = 0
      this.attackAt = 0
      this.hurtAt = 0
      this.lastFacing = 'down'
      this.enemies = []
      this.physics.world.setBounds(32, 32, WORLD.width - 64, WORLD.height - 64)
      this.drawGround()
      this.createTextures()
      const obstacles = this.physics.add.staticGroup()
      for (const rock of ROCKS) {
        const sprite = this.add.rectangle(rock.x, rock.y, rock.w, rock.h, 0x626d66).setStrokeStyle(4, 0x37453d)
        this.add.rectangle(rock.x - 10, rock.y - 7, rock.w - 24, rock.h - 25, 0x849083)
        this.physics.add.existing(sprite, true)
        obstacles.add(sprite)
      }
      this.player = this.physics.add.sprite(START.x, START.y, 'hero-down-0').setOrigin(0.5, 0.75).setScale(2 / textureDensity).setCollideWorldBounds(true)
      this.player.body.setSize(12 * textureDensity, 8 * textureDensity).setOffset(26 * textureDensity, 44 * textureDensity)
      this.physics.add.collider(this.player, obstacles)
      for (const point of SPAWNS) this.spawnEnemy(point.x, point.y, obstacles)
      this.obstacles = obstacles
      this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height).startFollow(this.player, true, 0.12, 0.12)
      this.keys = this.input.keyboard.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D', attack: 'SPACE', pause: 'ESC' })
      this.arrows = this.input.keyboard.createCursorKeys()
      this.input.keyboard.on('keydown-SPACE', () => { if (this.mode === 'playing') this.attack(this.time.now) })
      this.input.keyboard.on('keydown-ESC', () => this.pause())
      this.input.keyboard.addCapture(['W', 'A', 'S', 'D', 'SPACE', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'ESC'])
      this.physics.pause()
      this.publish()
      ready()
    }
    drawGround() {
      const ground = this.add.graphics()
      ground.fillStyle(0x344b38).fillRect(0, 0, WORLD.width, WORLD.height)
      for (let y = 0; y < WORLD.height; y += 48) {
        for (let x = 0; x < WORLD.width; x += 48) {
          ground.fillStyle(((x + y) / 48) % 2 ? 0x3c563e : 0x38513b).fillRect(x + 1, y + 1, 46, 46)
          ground.fillStyle(0x53704a).fillRect(x + 9, y + 13, 3, 5).fillRect(x + 33, y + 30, 2, 4)
        }
      }
      ground.fillStyle(0x77694b).fillRect(32, 409, WORLD.width - 64, 88).fillRect(599, 32, 82, WORLD.height - 64)
      ground.lineStyle(16, 0x263b2e).strokeRect(24, 24, WORLD.width - 48, WORLD.height - 48)
      this.add.text(START.x, 365, 'BÃI TẬP TÂN THỦ', { fontFamily: 'monospace', fontSize: '18px', color: '#dbe9ba', backgroundColor: '#263b2e', padding: { x: 10, y: 6 } }).setOrigin(0.5)
    }
    createTextures() {
      for (const direction of DIRECTIONS) {
        for (let pose = 0; pose < 3; pose++) {
          const key = `hero-${direction.key}-${pose}`
          if (this.textures.exists(key)) continue
          const texture = this.textures.createCanvas(key, 64 * textureDensity, 64 * textureDensity)
          texture.context.scale(textureDensity, textureDensity)
          texture.context.imageSmoothingEnabled = false
          paintLayers(texture.context, resolvePose(layers, direction.key, pose, 0, {clientBodyFrame:[0,2,3][pose]}), images, 32, 48)
          texture.refresh()
        }
        for (const offset of new Set(IDLE_CYCLE.filter(value => value !== 0))) {
          const key = `hero-${direction.key}-breath-${offset}`
          if (this.textures.exists(key)) continue
          const texture = this.textures.createCanvas(key, 64 * textureDensity, 64 * textureDensity)
          texture.context.scale(textureDensity, textureDensity)
          texture.context.imageSmoothingEnabled = false
          paintLayers(texture.context, resolvePose(layers, direction.key, 0, offset), images, 32, 48)
          texture.refresh()
        }
      }
      if (!this.textures.exists('slime')) {
        const brush = this.make.graphics({ x: 0, y: 0 })
        brush.fillStyle(0x182e28, 0.4).fillEllipse(16, 25, 29, 10)
        brush.fillStyle(0x9ecf65).fillRoundedRect(3, 6, 26, 20, 7)
        brush.fillStyle(0xc4e391).fillEllipse(12, 11, 12, 6)
        brush.fillStyle(0x223329).fillRect(9, 15, 3, 4).fillRect(21, 15, 3, 4)
        brush.generateTexture('slime', 32, 32)
        brush.destroy()
      }
    }
    spawnEnemy(x, y, obstacles) {
      const sprite = this.physics.add.sprite(x, y, 'slime').setScale(1.7).setCollideWorldBounds(true)
      sprite.body.setSize(24, 18).setOffset(4, 8)
      this.physics.add.collider(sprite, obstacles)
      const label = this.add.text(x, y - 40, 'Slime · 3/3', { fontFamily: 'monospace', fontSize: '12px', color: '#ecf5dc', backgroundColor: '#263b2e', padding: { x: 4, y: 2 } }).setOrigin(0.5)
      this.enemies.push({ sprite, hp: 3, label })
    }
    publish() { onState({ hp: this.hp, kills: this.kills, mode: this.mode, x: Math.round(this.player.x), y: Math.round(this.player.y), elapsed: Math.floor(this.elapsed / 1000) }) }
    play() {
      if (this.mode !== 'ready' && this.mode !== 'paused') return
      this.mode = 'playing'
      this.input.keyboard.resetKeys()
      this.physics.resume()
      this.game.canvas.focus()
      this.publish()
    }
    pause() {
      if (this.mode !== 'playing') return
      this.mode = 'paused'
      this.physics.pause()
      this.input.keyboard.resetKeys()
      this.publish()
    }
    finish(mode) {
      this.mode = mode
      this.physics.pause()
      this.player.setVelocity(0, 0)
      this.publish()
    }
    attack(time) {
      if (time < this.attackAt) return
      this.attackAt = time + 280
      const targets = this.enemies.filter(enemy => enemy.sprite.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.sprite.x, enemy.sprite.y) < 110)
      targets.sort((a, b) => Phaser.Math.Distance.Between(this.player.x, this.player.y, a.sprite.x, a.sprite.y) - Phaser.Math.Distance.Between(this.player.x, this.player.y, b.sprite.x, b.sprite.y))
      const target = targets[0]
      const ring = this.add.circle(this.player.x, this.player.y - 18, 50, 0xf6dc82, 0.12).setStrokeStyle(3, 0xf6dc82).setDepth(3000)
      this.tweens.add({ targets: ring, alpha: 0, scale: 1.5, duration: 180, onComplete: () => ring.destroy() })
      if (!target) return
      target.hp--
      target.sprite.setTint(0xffb27f)
      this.time.delayedCall(100, () => { if (target.sprite.active) target.sprite.clearTint() })
      if (target.hp === 0) {
        target.sprite.destroy()
        target.label.destroy()
        this.kills++
        if (this.kills === 5) this.finish('won')
        else {
          // Respawn outside obstacles, within reachable bounds.
          const spawn = SPAWNS[this.kills % SPAWNS.length]
          this.spawnEnemy(spawn.x, spawn.y, this.obstacles)
        }
      }
      this.publish()
    }
    update(time, delta) {
      if (!this.player || this.mode !== 'playing') return
      this.elapsed += Math.min(delta, 50)
      const x = Number(this.keys.right.isDown || this.arrows.right.isDown) - Number(this.keys.left.isDown || this.arrows.left.isDown)
      const y = Number(this.keys.down.isDown || this.arrows.down.isDown) - Number(this.keys.up.isDown || this.arrows.up.isDown)
      const velocity = new Phaser.Math.Vector2(x, y).normalize().scale(180)
      this.player.setVelocity(velocity.x, velocity.y)
      if (x || y) this.lastFacing = x ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up')
      const tick = Math.floor(this.elapsed * (x || y ? WALK_FPS : IDLE_FPS) / 1000)
      const pose = x || y ? WALK_CYCLE[tick % WALK_CYCLE.length] : IDLE_CYCLE[tick % IDLE_CYCLE.length] ? `breath-${IDLE_CYCLE[tick % IDLE_CYCLE.length]}` : 0
      this.player.setTexture(`hero-${this.lastFacing}-${pose}`).setDepth(this.player.y)
      if (this.mode !== 'playing') return
      for (const enemy of this.enemies) {
        if (!enemy.sprite.active) continue
        const distance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y)
        if (distance > 45 && distance < 330) this.physics.moveToObject(enemy.sprite, this.player, 45)
        else enemy.sprite.setVelocity(0, 0)
        enemy.sprite.setDepth(enemy.sprite.y)
        enemy.label.setPosition(enemy.sprite.x, enemy.sprite.y - 38).setText(`Slime · ${enemy.hp}/3`).setDepth(enemy.sprite.y + 1)
        if (distance < 48 && time > this.hurtAt) {
          this.hp = Math.max(0, this.hp - 10)
          this.hurtAt = time + 1000
          this.cameras.main.shake(70, 0.003)
          if (this.hp === 0) { this.finish('lost'); return }
        }
      }
      this.publish()
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width: 960, height: 600,
    backgroundColor: '#263b2e', pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scene: Arena, audio: { noAudio: true },
  })
  game.canvas.tabIndex = 0
  game.canvas.setAttribute('aria-label', 'Bãi tập H5: WASD hoặc phím mũi tên, Space để đánh, Escape để tạm dừng')
  await initialized
  const onHidden = () => { if (document.hidden) activeScene.pause() }
  document.addEventListener('visibilitychange', onHidden)
  return {
    start: () => activeScene.play(), pause: () => activeScene.pause(),
    restart: () => activeScene.scene.restart(),
    destroy: () => { document.removeEventListener('visibilitychange', onHidden); game.destroy(true) },
  }
}
