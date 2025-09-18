import './style.css'
import Phaser from 'phaser';

const sizes = {
  width:928,
  height:793
}

class MainScene extends Phaser.Scene {
  constructor(){
    super("scene-game")
  }
  preload(){
    this.load.image("bg", "/assets/Background.png")
    this.load.image("wasp", "/assets/wasp.png")
  }
  create(){
    this.add.image(0, 0, "bg").setOrigin(0,0)
    let waspSprite = this.add.image(750,650, "wasp").setOrigin(0,0)
    waspSprite.setScale(1.5)
    waspSprite.flipX = true
  }

  update(){

  }
}

const config = {
  type:Phaser.WEBGL,
  width:sizes.width,
  height:sizes.height,
  canvas:gameCanvas,
  debug: true,
  scene:[MainScene]
}

const game = new Phaser.Game(config)