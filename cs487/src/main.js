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
    this.load.image("coins", "/assets/coins.png") 
  }
  create(){
    this.player = {
      damage: 2,
      coins: 0
    }
    //Background + Spawn enemy
    this.add.image(0, 0, "bg").setOrigin(0,0)
    this.coins = this.physics.add.group()
    this.spawnWasp()
  
  }
  spawnWasp() {
    const waspMaxHealth = 10  
    let waspSprite = this.add.image(464,596.5, "wasp").setOrigin(0,0)
    waspSprite.setScale(2.3)
    waspSprite.flipX = true
    waspSprite.setInteractive()
    waspSprite.setData("health", waspMaxHealth)

    let waspHealthBarBg = this.makeBar(waspSprite.x, waspSprite.y -30, 0x000000)
    waspHealthBarBg.displayWidth = 200
    waspHealthBarBg.displayWidth = 20

    let waspHealthBar = this.makeBar(waspSprite.x, waspSprite.y -30, 0x2ecc71)
    this.setValue(waspHealthBar, 100) // health bar starts at 100% (5 in this case)
  
    waspSprite.on("pointerdown", () => {
      const waspNewHealth = waspSprite.getData("health") - this.player.damage;
      waspSprite.setData('health', waspNewHealth)
      // healthText.setText(`Health: ${newHealth} `) used for text health

      let waspHealthPercent = (waspNewHealth / waspMaxHealth) * 100
      this.setValue(waspHealthBar, waspHealthPercent)

      console.log(`Hit, health remaining: ${waspNewHealth}`)

      if (waspNewHealth <= 0) {
        console.log("enemy defeated")
        waspSprite.disableInteractive()
        this.coinDrop(waspSprite.x, waspSprite.y)
        waspSprite.destroy()
        waspHealthBar.destroy()
        waspHealthBarBg.destroy()

        //after a delay, respawn wasp
        this.time.delayedCall(5000, () => {
          this.spawnWasp()
        })
        
      }
    })
  }
  makeBar(x,y,color){
    let bar = this.add.graphics()
    bar.fillStyle(color, 1)
    bar.fillRect(0,0,200,20)
    bar.x=x
    bar.y=y
    return bar
  }
  setValue(bar, percentage){
    bar.scaleX = percentage / 100
  }

  coinDrop(x,y){
    if(Phaser.Math.Between(1,1) === 1){
      const xOffset = Phaser.Math.Between(-20, 20)
      const yOffset = Phaser.Math.Between(-20,20)

      const coin = this.physics.add.sprite(x + xOffset, y + yOffset, "coins")
      coin.setBounce(0.6)
      coin.setVelocity(Phaser.Math.Between(-5, 5), Phaser.Math.Between(-1, -5))
      coin.setCollideWorldBounds(true)

      this.coins.add(coin);
    }
  }

  update(){
    const pointer = this.input.activePointer

    this.coins.children.each(coin =>{
      if (!coin.active) return
      const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, coin.x, coin.y)

      if(dist<30){
        coin.destroy()
        this.player.coins++
        console.log(`Coins: ${this.player.coins}`)
      }
    })
  }
}

const config = {
  type:Phaser.WEBGL,
  width:sizes.width,
  height:sizes.height,
  canvas:gameCanvas,
  debug: true,
  scene:[MainScene],
  physics: {
    default: "arcade",
    arcade: {
      debug: false
    }
  },
}

const game = new Phaser.Game(config)