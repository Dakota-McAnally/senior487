import './style.css'
import Phaser from 'phaser';

const sizes = {
  //background size
  width:928,
  height:793
}

class Enemy {
  constructor(scene, x, y, texture, maxHealth = 100) {
    this.scene = scene
    this.maxHealth = maxHealth
    this.health = maxHealth

    //contains sprite + health bar
    this.container = scene.add.container(x, y)

    this.sprite = scene.add.image(0, 0, texture).setOrigin(0,0)
    this.sprite.setScale(2.3)
    this.sprite.flipX = true
    this.sprite.setInteractive()
    this.container.add(this.sprite)
    //health bar background -> red, floating just above enemy sprite
    this.healthBarBg = scene.add.graphics()
    this.healthBarBg.fillStyle(0xFF0000, 1)
    this.healthBarBg.fillRect(0, 0, 200, 20)
    this.healthBarBg.x = -30
    this.healthBarBg.y = -30
    this.container.add(this.healthBarBg)
    //health bar -> what "depletes" when damage is applied
    this.healthBar = scene.add.graphics()
    this.healthBar.fillStyle(0x2ecc71, 1)
    this.healthBar.fillRect(0,0,200,20)
    this.healthBar.x = -30
    this.healthBar.y = -30
    scene.setValue(this.healthBar, 100)
    this.container.add(this.healthBar)
    //adds text to hp bar
    this.hpText = this.scene.add.text(
      50,
      -27.5,
      `${this.health}/${this.maxHealth}`,
      { fontSize: '16px', fill: '#fff', fontStyle: 'bold' }
    )
    this.container.add(this.hpText)
    //on click multiplier -> reward active play with increased dps multiplier
    this.sprite.on("pointerdown", () => {
      this.takeDamage(scene.player.dps * 1.25)
    })
  }

  showDamage(amount) {
    const dmgText = this.scene.add.text(
      this.sprite.x + 50,
      this.sprite.y - 30,
      `-${Math.floor(amount)}`,
      { fontSize: '24px', fill: '#ff0000', fontStyle: 'bold' }
    )

    this.container.add(dmgText)

    this.scene.tweens.add({
      targets: dmgText,
      y: dmgText.y - 100,
      alpha: 0,
      duration: 950,
      ease: 'Cubic.easeOut',
      onComplete: () => dmgText.destroy()
    })
  }

  takeDamage(amount) {
    this.health -= amount
    this.health = Math.max(this.health, 0)
    //update hp bar
    const percent = Phaser.Math.Clamp((this.health / this.maxHealth) * 100, 0, 100)
    this.scene.setValue(this.healthBar, percent)
    //update hp bar text
    this.hpText.setText(`${Math.floor(this.health)}/${this.maxHealth}`)
    //damage numbers
    this.showDamage(amount)

    console.log(`Hit, health remaining: ${this.health}`)

    if (this.health <= 0){
      this.killEnemy()
    }
  }

  killEnemy() {
    console.log("Enemy killed")
    this.sprite.disableInteractive()
    this.scene.coinDrop(this.container.x, this.container.y)
    this.container.destroy()

    const index = this.scene.enemies.indexOf(this)
    if (index > -1) {
      this.scene.enemies.splice(index, 1)
    }
    this.scene.time.delayedCall(2000, () => {
      const newEnemy = new Enemy(this.scene, this.container.x, this.container.y, "wasp")
      this.scene.enemies.push(newEnemy)
    })
  }
}

class MainScene extends Phaser.Scene {
  constructor(){
    super("scene-game")
  }
  preload(){
    // Load all sprites
    this.load.image("bg", "/assets/Background.png")
    this.load.image("wasp", "/assets/wasp.png")
    this.load.image("coins", "/assets/coins.png") 
  }
  create(){
    //Player 'stats'
    this.player = {
      dps: 8,
      coins: 0
    }
    //Background + Spawn sprites
    this.add.image(0, 0, "bg").setOrigin(0,0)
    this.coins = this.physics.add.group()
    this.coinCount = this.add.text(55, 55, "Coins: 0", { fontSize: "48px", fill: "#ffffff"})
    //spawn enemy using "Enemy" class
    this.enemies = []
    const wasp = new Enemy(this, 464, 396.5, "wasp")
    this.enemies.push(wasp)
  

    //DPS function
    this.time.addEvent({
      delay: 1000, //1s
      loop: true,
      callback: () => {
        console.log("DPS hit")
        this.enemies.forEach((enemy) => {
          if (enemy.health > 0 && enemy.container.active) {
            enemy.takeDamage(this.player.dps)
          }
        })
      },
    })
  
  }

  //Made obsolete -> using Enemy class to support adding more enemies without bloated code
  // spawnWasp() {
  //   const waspMaxHealth = 25 
  //   let waspSprite = this.add.image(464,396.5, "wasp").setOrigin(0,0)
  //   waspSprite.setScale(2.3)
  //   waspSprite.flipX = true
  //   waspSprite.setInteractive()

  //   waspSprite.setData("health", waspMaxHealth)
  //   waspSprite.setData("maxHealth", waspMaxHealth)

  //   let waspHealthBarBg = this.makeBar(waspSprite.x - 30, waspSprite.y -30, 0x000000)
  //   waspHealthBarBg.displayWidth = 200
  //   waspHealthBarBg.displayHeight = 20

  //   let waspHealthBar = this.makeBar(waspSprite.x -30, waspSprite.y -30, 0x2ecc71)
  //   this.setValue(waspHealthBar, 100) // health bar starts at 100%


  //   waspSprite.healthBar = waspHealthBar
  //   waspSprite.healthBarBg = waspHealthBarBg
  //   this.currentWasp = waspSprite

  
  //   waspSprite.on("pointerdown", () => {
  //     this.damageWasp(waspSprite, this.player.dps * 1.1) // deals extra damage when the player clicks TODO: add multiplier upgrade and remove hardcoded 1.1x multi
  //   })
  // }

  // damageWasp(waspSprite, amount) {

  //   if (!waspSprite.active) return //ignore if no sprite on screen
  
  //   const waspMaxHealth = waspSprite.getData("maxHealth")
  //   const currentHealth = waspSprite.getData("health")
  //   const newHealth = currentHealth - amount

  //   waspSprite.setData("health", newHealth)

  //   let waspHealthPercent = Phaser.Math.Clamp((newHealth / waspMaxHealth) * 100, 0, 100)
  //   this.setValue(waspSprite.healthBar, waspHealthPercent)

  //   console.log(`Hit, health remaining: ${newHealth}`)

  //   if (newHealth <= 0) {
  //     console.log("enemy defeated")
  //     waspSprite.disableInteractive()
  //     waspSprite.healthBar.destroy()
  //     waspSprite.healthBarBg.destroy()
  //     waspSprite.destroy()
  //     this.coinDrop(waspSprite.x, waspSprite.y)
      

  //     this.currentWasp = null

  //     // Respawn after 2s
  //     this.time.delayedCall(2000, () => this.spawnWasp())
  //   }
  // }

  makeBar(x,y,color) {
    let bar = this.add.graphics()
    bar.fillStyle(color, 1)
    bar.fillRect(0,0,200,20)
    bar.x=x
    bar.y=y
    return bar
  }
  setValue(bar, percentage) {
    bar.scaleX = percentage / 100
  }

  showCoinText(x, y, text, color = "#ffffff") {
    const floatingText = this.add.text(x, y, text, {
      fontSize: '24px', fill: color, fontStyle: 'bold'
    })
    this.tweens.add({
      targets: floatingText,
      y: y - 30,
      alpha: 0,
      duration: 950,
      ease: 'Cubic.easeOut',
      onComplete: () => floatingText.destroy()
    })
  }

  collectCoin(coin) {
    if (!coin.active) return

    coin.destroy()
    this.player.coins++
    this.coinCount.setText(`Coins: ${this.player.coins}`)
    this.showCoinText(coin.x, coin.y, "+1 Coin", "#ffffff")
  }

  coinDrop(x, y) {
    const coinsDropped = Phaser.Math.Between(3, 7)

    for(let i = 0; i < coinsDropped; i++) {
      const xOffset = Phaser.Math.Between(-20, 20)
      const yOffset = Phaser.Math.Between(-20, 20)

      const coin = this.physics.add.sprite(x + xOffset, y + yOffset, "coins")
      coin.setBounce(0.6)
      coin.setVelocity(Phaser.Math.Between(-50, 50), Phaser.Math.Between(-10, -50))
      coin.setCollideWorldBounds(true)
      this.coins.add(coin);

      //automatically pick up coins after set time
      this.time.delayedCall(8500, () => {
        if (coin.active) {
          this.collectCoin(coin)
        }
      })
    }
    return coinsDropped
  }
    update() {
    const pointer = this.input.activePointer

    this.coins.children.each(coin =>{
      if (!coin.active) return
      const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, coin.x, coin.y)

      if(dist < 30){
        coin.destroy()
        this.player.coins++
        this.coinCount.setText(`Coins: ${this.player.coins}`)

        this.showCoinText(coin.x, coin.y, "+1 Coin", "#ffffff")
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