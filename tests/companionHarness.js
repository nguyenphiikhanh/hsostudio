import Phaser from 'phaser'
const runtimePath='/companion-smoke/runtime.js'
const {preloadLibrary,EquipmentCharacter}=await import(/* @vite-ignore */ runtimePath)
const [manifest,equipment,animations,outfit]=await Promise.all(['library','equipment','animations','character'].map(p=>fetch(`/companion-smoke/${p}.json`).then(r=>r.json())))
new Phaser.Game({type:Phaser.AUTO,width:800,height:600,pixelArt:true,scene:{
 preload(){preloadLibrary(this,'/companion-smoke',manifest)},
 create(){window.companionCharacter=new EquipmentCharacter(this,manifest,equipment,animations,outfit,300,340);window.companionCharacter.container.setScale(4);window.companionReady=true},
}})
