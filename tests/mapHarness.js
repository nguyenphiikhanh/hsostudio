import Phaser from 'phaser'
const runtimePath='/map-smoke/runtime.js'
const {preloadMap,createMap}=await import(/* @vite-ignore */ runtimePath)
const map=await fetch('/map-smoke/map.json').then(r=>r.json())
new Phaser.Game({type:Phaser.AUTO,width:900,height:560,pixelArt:true,scene:{
 preload(){preloadMap(this,'/map-smoke',map)},
 create(){window.mapActor=createMap(this,map);this.cameras.main.setZoom(.6);this.cameras.main.centerOn(map.width*12,map.height*12);window.mapReady=true},
}})
