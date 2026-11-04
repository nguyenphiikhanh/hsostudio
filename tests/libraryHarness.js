import Phaser from 'phaser'

const runtimeUrl = '/export-smoke/runtime.js'
const { EquipmentCharacter, preloadLibrary } = await import(/* @vite-ignore */ runtimeUrl)
const [manifest, equipment, animations, outfit] = await Promise.all(['library', 'equipment', 'animations', 'character'].map(async name => (await fetch(`/export-smoke/${name}.json`)).json()))
class Smoke extends Phaser.Scene {
  preload() {
    this.load.on('loaderror', file => { window.libraryError = `Missing ${file.key}` })
    preloadLibrary(this, '/export-smoke', manifest)
  }
  create() {
    const character = new EquipmentCharacter(this, manifest, equipment, animations, outfit, 200, 160)
    character.container.setScale(3)
    window.libraryHarness = { character, scene: this, manifest, equipment }
  }
}
window.libraryGame = new Phaser.Game({ type: Phaser.CANVAS, width: 400, height: 300, backgroundColor: '#374536', pixelArt: true, scene: Smoke, audio: { noAudio: true } })
