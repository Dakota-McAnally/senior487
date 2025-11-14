import './style.css'
import Phaser from 'phaser'
import { addXP, createXPBar, getXPForNextLevel } from './utils/xp.js'
import { showUI, setupGlobalButtons } from './utils/uiManager.js'
import { MiningScene } from './miningScene.js'
import { ShopScene } from './shopScene.js'
import { SmithingScene } from './smithingScene.js'
const API_BASE = import.meta.env.VITE_API_BASE || ""

//global functions (multiple scenes can/will use)
export function getUpgradeCost(baseCost, level) {
  return Math.floor(baseCost * Math.pow(1.25, level))
}

export function recomputeAllUpgradeCosts(player, baseCosts) {
  if (!player.upgrades) {
    return
  }
  const keys = ["coinMultiplier", "dpsMultiplier", "clickMultiplier",]
  keys.forEach(k => {
    const lvl = player.upgrades[k]?.level ?? 0
    player.upgrades[k].cost = getUpgradeCost(baseCosts[k], lvl)
  })
}

export function updateInventoryUI(scene) {
  const inventoryUI = document.getElementById("inventoryUI")
  const player = scene.player
  if (!inventoryUI) {
    return
  }
  inventoryUI.innerHTML = ""

  const inv = scene.player.inventory

  const swordStats = getToolStats(player, "sword")
  const pickaxeStats = getToolStats(player, "pickaxe")

  const items = [
    { name: "Coins", quantity: inv.coins, icon: "coins.png" },
    { name: "Copper Bar", quantity: inv.copperBar, icon: "copper_bar.png" },
    { name: "Iron Bar", quantity: inv.ironBar, icon: "iron_bar.png" },
    { name: "Gold Bar", quantity: inv.goldBar, icon: "gold_bar.png" },
    { name: "Copper Ore", quantity: inv.copperOre, icon: "copper_item.png" },
    { name: "Iron Ore", quantity: inv.ironOre, icon: "iron_item.png" },
    { name: "Gold Ore", quantity: inv.goldOre, icon: "gold_item.png" },
    { name: swordStats.name, quantity: `DPS -- ${swordStats.dps}`, icon: swordStats.sprite },
    { name: pickaxeStats.name, quantity: `Power -- ${pickaxeStats.miningPower}`, icon: pickaxeStats.sprite },

  ]

  items.forEach(item => {
    const slot = document.createElement("div")
    slot.style.display = "flex"
    slot.style.alignItems = "center"
    slot.style.border = "1px solidf #fff"
    slot.style.padding = "5px"
    slot.style.textAlign = "center"
    slot.style.borderRadius = "4px"
    slot.style.backgroundColor = "rgba(255,255,255,0.1)"
    slot.style.gap = "8px"

    const img = document.createElement("img")
    img.src = `/assets/${item.icon}`
    img.style.width = "24px"
    img.style.height = "24px"
    slot.appendChild(img)

    const text = document.createElement("span")
    text.textContent = `${item.name}: ${item.quantity}`
    slot.appendChild(text)

    inventoryUI.appendChild(slot)
  })
}
export const TOOL_TIERS = {
  sword: {
    1: { name: "Wooden Sword", dps: 10, sprite: "wooden_sword_inventory.png" },
    2: { name: "Copper Sword", dps: 15, sprite: "copper_sword_inventory.png" },
    3: { name: "Iron Sword", dps: 22.5, sprite: "iron_sword_inventory.png" },
    4: { name: "Gold Sword", dps: 35, sprite: "gold_sword_inventory.png" },
  },
  pickaxe: {
    1: { name: "Wooden Pickaxe", miningPower: 10, sprite: "wooden_pickaxe_inventory.png" },
    2: { name: "Copper Pickaxe", miningPower: 15, sprite: "copper_pickaxe_inventory.png" },
    3: { name: "Iron Pickaxe", miningPower: 22.5, sprite: "iron_pickaxe_inventory.png" },
    4: { name: "Gold Pickaxe", miningPower: 35, sprite: "gold_pickaxe_inventory.png" },
  }
}
export function getToolStats(player, type) {
  const tier = player.stats?.[`${type}Tier`] ?? 1
  const toolData = TOOL_TIERS[type][tier] ?? TOOL_TIERS[type][1]
  return toolData
}
export function getRequiredOreForUpgrade(level) {
  if (level < 10) {
    return "copperOre"
  }
  if (level < 20) {
    return "ironOre"
  }
  return "goldOre"
}

export function startGame(user) {
  console.log("startGame called with user: ", user)
  console.log(user)
  console.log("LOGIN INVENTORY:", user.inventory);
  console.log("LOGIN COINS:", user.inventory?.coins);

  const sizes = {
    //background size
    width: 928,
    height: 793
  }
  const MONSTERS = [
    {
      name: "wasp",
      unlockLevel: 0,
      texture: "wasp",
      baseHealth: 200,
      xpReward: 25,
      coinMultiplier: 1.0,
    },
    {
      name: "goblin",
      unlockLevel: 5,
      texture: "goblin",
      baseHealth: 400,
      xpReward: 40,
      coinMultiplier: 2,
    },
    {
      name: "skeleton",
      unlockLevel: 10,
      texture: "skeleton",
      baseHealth: 960,
      xpReward: 64,
      coinMultiplier: 3,
    }
  ]
  class Enemy {
    constructor(scene, x, y, texture, maxHealth = 50, xpReward = null, name = "Unknown") {
      this.scene = scene
      this.maxHealth = maxHealth
      this.health = maxHealth
      this.xpReward = xpReward
      this.name = name
      this.lastTintTime = 0
      this.tintCooldown = 400

      this.container = scene.add.container(x, y + 60)

      // enemy sprites
      this.sprite = scene.add.image(0, 0, texture).setOrigin(0.5, 1)
      this.sprite.setScale(2.3)
      this.sprite.flipX = true
      this.sprite.setInteractive()
      this.container.add(this.sprite)

      // height of displayed sprite
      const spriteHeight = this.sprite.displayHeight
      const hpBarY = -spriteHeight - 20     // health bar sits just above the sprite
      const nameTextY = hpBarY - 25         // name sits just above HP bar

      // Enemy name text
      this.nameText = scene.add.text(0, nameTextY, this.name.charAt(0).toUpperCase() + this.name.slice(1), {
        fontSize: '20px',
        fill: '#ffff00',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center'
      }).setOrigin(0.5)
      this.container.add(this.nameText)

      // Health bar background
      this.healthBarBg = scene.add.graphics()
      this.healthBarBg.fillStyle(0xff0000, 1)
      this.healthBarBg.fillRect(-100, hpBarY, 200, 20)
      this.container.add(this.healthBarBg)

      // Health bar
      this.healthBar = scene.add.graphics()
      this.healthBar.fillStyle(0x2ecc71, 1)
      this.healthBar.fillRect(-100, hpBarY, 200, 20)
      this.container.add(this.healthBar)

      // HP text 
      this.hpText = scene.add.text(0, hpBarY + 10, `${this.health}/${this.maxHealth}`, {
        fontSize: '16px',
        fill: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5)
      this.container.add(this.hpText)

      // Bobbing animation
      this.idleTween = scene.tweens.add({
        targets: this.container,
        y: this.container.y - 10,
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      })

      this.sprite.on("pointerdown", () => {
        this.takeDamage(scene.getClickDamage())
      })
    }
    updateHealthBar() {
      const hpBarY = -this.sprite.displayHeight - 20
      const maxWidth = 200
      const percent = Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1)
      const filledWidth = maxWidth * percent

      // Redraw the green HP bar only
      this.healthBar.clear()
      this.healthBar.fillStyle(0x2ecc71, 1)

      // Draw from left edge, fixed width background
      this.healthBar.fillRect(-100, hpBarY, filledWidth, 20)
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
      this.health = parseFloat(this.health.toFixed(2))
      //update hp bar
      this.updateHealthBar()
      //update hp bar text
      this.hpText.setText(`${Math.round(this.health)}/${this.maxHealth}`)
      //damage numbers
      this.showDamage(amount)
      //response to enemy taking dmg tick --> makes sprite red
      const now = this.scene.time.now
      if (now - this.lastTintTime >= this.tintCooldown) {
        this.lastTintTime = now

        this.scene.tweens.add({
          targets: this.sprite,
          tint: 0xff0000,
          duration: 100,
          yoyo: true,
          repeat: 0,
          onComplete: () => this.sprite.clearTint()
        })
      }


      console.log(`Hit, health remaining: ${this.health}`)
      //enemy 'flinches upon taking damage'
      if (this.idleTween && !this._isTweenPaused) {
        this._isTweenPaused = true
        this.idleTween.pause()
        //resume idle animation after short delay, unless user is "spam" clicking to deal dmg
        this.scene.time.delayedCall(250, () => {
          this.idleTween.resume()
          this._isTweenPaused = false
        })
      }

      if (this.health <= 0) {
        this.killEnemy()
      }
    }

    killEnemy() {
      console.log("Enemy killed")
      this.sprite.disableInteractive()
      const result = addXP(this.scene.player, "combat", this.xpReward, this.scene, this.scene.combatXPBar.update.bind(this.scene.combatXPBar), MONSTERS)
      if (result.leveledUp && result.unlocked) {
        console.log(`Unlocked new monster: ${result.unlocked}`)
        this.spawnNewMonster(result.unlocked)
      }
      this.scene.combatXPBar.update(this.scene.player)
      this.scene.coinDrop(this.container.x, this.container.y)

      const xpText = this.scene.add.text(
        this.container.x + this.sprite.width / 2,
        this.container.y - 40,
        `+${this.xpReward} XP`,
        { fontSize: "16px", color: "#00ff00", fontStyle: "bold" }
      ).setOrigin(0.5)

      this.scene.tweens.add({
        targets: xpText,
        y: xpText.y - 40,
        alpha: 0,
        duration: 1000,
        ease: "Cubic.easeOut",
        onComplete: () => xpText.destroy()
      })

      this.container.destroy()

      const index = this.scene.enemies.indexOf(this)
      if (index > -1) {
        this.scene.enemies.splice(index, 1)
      }
      this.scene.time.delayedCall(2000, () => {
        const monster = this.scene.getCurrentMonsterType()
        const newEnemy = new Enemy(
          this.scene,
          464,
          400,
          monster.texture,
          monster.baseHealth,
          monster.xpReward,
          monster.name,
        )
        this.scene.enemies.push(newEnemy)
      })
    }
  }

  class MainScene extends Phaser.Scene {
    constructor() {
      super("scene-main")

      this.baseCosts = {
        coinMultiplier: 150,
        dpsMultiplier: 100,
        clickMultiplier: 60,
        oreMultiplier: 50,
        oreDpsMultiplier: 40,
        oreClickMultiplier: 25
      }
    }
    init(data) {
      this.player = data.player || window.currentUser
      recomputeAllUpgradeCosts(this.player, this.baseCosts)
    }
    preload() {
      // Load all sprites
      this.load.image("bg", "/assets/Background.png")
      this.load.image("wasp", "/assets/wasp.png")
      this.load.image("coins", "/assets/coins.png")
      this.load.image("goblin", "/assets/goblin.png")
      this.load.image("skeleton", "/assets/skeleton.png")
      this.load.image("copper_item", "/assets/copper_item.png")
      this.load.image("iron_item", "/assets/iron_item.png")
      this.load.image("gold_item", "/assets/gold_item.png")
      this.load.image("copper_bar", "/assets/copper_bar.png")
      this.load.image("iron_bar", "/assets/iron_bar.png")
      this.load.image("gold_bar", "/assets/gold_bar.png")
      this.load.image("sword", "/assets/sword.png")
      this.load.image("wooden_sword_inventory", "/assets/wooden_sword_inventory.png")
      this.load.image("copper_sword_inventory", "/assets/copper_sword_inventory.png")
      this.load.image("iron_sword_inventory", "/assets/iron_sword_inventory.png")
      this.load.image("gold_sword_inventory", "/assets/gold_sword_inventory.png")
      this.load.image("wooden_pickaxe_inventory", "/assets/wooden_pickaxe_inventory.png")
      this.load.image("copper_pickaxe_inventory", "/assets/copper_pickaxe_inventory.png")
      this.load.image("iron_pickaxe_inventory", "/assets/iron_pickaxe_inventory.png")
      this.load.image("gold_pickaxe_inventory", "/assets/gold_pickaxe_inventory.png")
    }

    create() {
      showUI(this.scene.key)
      this.groundY = 670
      //events
      this.events.on("coinsUpdated", (newCointAmount) => {
        this.player.inventory.coins = newCointAmount
        updateInventoryUI(this)
        const inventoryUI = document.getElementById("inventoryUI")
        if (inventoryUI && inventoryUI.style.display != "none")
          updateInventoryUI(this)
      })

      //cost scaling for upgrades based on level + base cost
      if (!this.player.upgrades) {
        this.player.upgrades = {
          coinMultiplier: {
            level: user.stats.coinMultLevel ?? 0,
            cost: getUpgradeCost(this.baseCosts.coinMultiplier, (user.stats.coinMultLevel) ?? 0) + 1,
          },
          dpsMultiplier: {
            level: user.stats.dpsMultLevel ?? 0,
            cost: getUpgradeCost(this.baseCosts.dpsMultiplier, (user.stats.dpsMultLevel) ?? 0) + 1,
          },
          clickMultiplier: {
            level: user.stats.clickMultLevel ?? 0,
            cost: getUpgradeCost(this.baseCosts.clickMultiplier, (user.stats.clickMultLevel) ?? 0) + 1,
          },
          oreMultiplier: {
            level: user.stats.oreMultLevel ?? 0,
            cost: getUpgradeCost(this.baseCosts.oreMultiplier, (user.stats.oreMultLevel) ?? 0) + 1
          },
          oreDpsMultiplier: {
            level: user.stats.oreDpsMultLevel ?? 0,
            cost: getUpgradeCost(this.baseCosts.oreDpsMultiplier, (user.stats.oreDpsMultLevel) ?? 0) + 1
          },
          oreClickMultiplier: {
            level: user.stats.oreClickMultLevel ?? 0,
            cost: getUpgradeCost(this.baseCosts.oreDpsMultiplier, (user.stats.oreDpsMultiplier) ?? 0) + 1
          }
        }
      }
      //multiplier scaling per level of multiplier
      //combat
      this.player.coinMultiplier = 1.00 + 0.12 * this.player.upgrades.coinMultiplier.level
      this.player.dpsMultiplier = 1.00 + 0.12 * this.player.upgrades.dpsMultiplier.level
      this.player.clickMultiplier = 1.00 + 0.12 * this.player.upgrades.clickMultiplier.level
      //mining
      this.player.oreMultiplier = 1.00 + 0.20 * this.player.upgrades.oreMultiplier.level
      this.player.oreDpsMultiplier = 1.00 + 0.12 * this.player.upgrades.oreDpsMultiplier.level
      this.player.oreClickMultiplier = 1.00 + 0.12 * this.player.upgrades.oreClickMultiplier.level
      // console.log("Player initialized", this.player.username)
      //Background + Spawn sprites
      this.add.image(0, 0, "bg").setOrigin(0, 0)
      this.coins = this.physics.add.group()

      // inventory's toggle button
      const inventoryUI = document.getElementById("inventoryUI")
      if (inventoryUI) {
        inventoryUI.style.display = "none"
      }
      updateInventoryUI(this)

      //spawn enemy using "Enemy" class
      if (!this.enemies) {
        this.enemies = []
      }
      const monster = this.getCurrentMonsterType()
      const enemy = new Enemy(
        this,
        464,
        400,
        monster.texture,
        monster.baseHealth,
        monster.xpReward,
        monster.name
      )
      this.enemies.push(enemy)

      const enemyBounds = enemy.sprite.getBounds()
      const swordY = enemyBounds.top - 20
      const swordX = enemyBounds.centerX + 80

      this.sword = this.add.image(464 + 90, 335, "sword")
        .setOrigin(0.9, 0.4)
        .setScale(2.2)
        .setAngle(45)
        .setDepth(10)


      this.combatXPBar = createXPBar(this, "combat", 0x00ff00, 20)
      this.combatXPBar.update(this.player)
      // Scene title
        this.add.text(464, 60, "Dark Forest", {
            fontSize: "32px",
            color: "#ffffcc",
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 3
        }).setOrigin(0.5);

      //DPS function
      this.time.addEvent({
        delay: 1000, //1s
        loop: true,
        callback: () => {
          console.log("DPS hit")
          this.enemies.forEach((enemy) => {
            if (enemy.health > 0 && enemy.container.active) {
              this.swingSword()
              const swordStats = getToolStats(this.player, "sword")
              enemy.takeDamage(swordStats.dps * this.player.dpsMultiplier)
            }
          })
        },
      })
      this.cameras.main.fadeIn(300, 0, 0, 0)
    }

    swingSword() {
      if (this.isSwinging) {
        return
      }
      this.isSwinging = true

      this.tweens.add({
        targets: this.sword,
        angle: { from: 45, to: -30 },
        duration: 160,
        yoyo: true,
        ease: "Cubic.easeInOut",
        onYoyo: () => {
          if (this.getCurrentMonsterType && this.getCurrentMonsterType.container) {
            this.tweens.add({
              targets: this.getCurrentMonsterType.container,
              x: `+=${Phaser.Math.Between(-4, 4)}`,
              duration: 50,
              yoyo: true,
              ease: "Sine.easeInOut"
            })
          }
        },
        onComplete: () => {
          this.isSwinging = false
        }
      })
    }
    spawnNewMonster(monsterName) {
      // Remove old enemies
      this.enemies.forEach(e => e.container.destroy())
      this.enemies = []

      const monsterData = this.monsters.find(m => m.name === monsterName)
      if (!monsterData) return

      const newEnemy = new Enemy(this, 464, 400, monsterData.texture,
        monsterData.maxHealth, monsterData.xpReward)
      this.enemies.push(newEnemy)
      console.log(`${monsterName} spawned!`)
    }
    //retrieves current monster type (Depends on players combat lvl)
    getCurrentMonsterType() {
      const level = this.player.skills.combat.level
      let current = MONSTERS[0]
      for (const m of MONSTERS) {
        if (level >= m.unlockLevel) {
          current = m
        }
      }
      return current
    }

    //makes the hp bar
    makeBar(x, y, color) {
      let bar = this.add.graphics()
      bar.fillStyle(color, 1)
      bar.fillRect(0, 0, 200, 20)
      bar.x = x
      bar.y = y
      return bar
    }
    //sets the value of the hp bar as a percentage
    setValue(bar, percentage) {
      bar.scaleX = Phaser.Math.Clamp(percentage / 100, 0, 1)
      bar.x = -100
    }
    //coin "+X" text
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
    //coin pickup logic
    pickupCoin(coin) {
      if (!coin.active) return

      coin.destroy()
      const monster = this.getCurrentMonsterType()
      const baseCoinValue = 15 * monster.coinMultiplier
      const coinsGained = Math.floor(baseCoinValue * this.player.coinMultiplier)
      this.player.inventory.coins += coinsGained
      this.player.inventory.coins = this.player.inventory.coins
      updateInventoryUI(this)
      this.showCoinText(coin.x, coin.y, `+${coinsGained} Coin${coinsGained > 1 ? 's' : ''}`, "#ffffff") //Coin${coinsGained > 1 ? 's' : ''}` Determine if coins are plural or singular (1 coin or 2 coin(s))

      //save progress (coins)
      fetch(`${API_BASE}/saveProgress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: this.player.username,
          stats: {
            combatLevel: this.player.skills.combat.level,
            combatXP: this.player.skills.combat.xp,
            coinMultLevel: this.player.upgrades.coinMultiplier.level,
            dpsMultLevel: this.player.upgrades.dpsMultiplier.level,
            clickMultLevel: this.player.upgrades.clickMultiplier.level,
            miningLevel: this.player.skills.mining.level,
            miningXP: this.player.skills.mining.xp,
            oreMultLevel: this.player.upgrades.oreMultiplier.level,
            oreDpsMultLevel: this.player.upgrades.oreDpsMultiplier.level,
            oreClickMultLevel: this.player.upgrades.oreClickMultiplier.level,
            smithingLevel: this.player.skills.smithing.level,
            smithingXP: this.player.skills.smithing.xp,
            swordTier: this.player.stats.swordTier ?? 1,
            pickaxeTier: this.player.stats.pickaxeTier ?? 1,
          },
          inventory: {
            coins: this.player.inventory.coins ?? 0,
            copperOre: this.player.inventory.copperOre ?? 0,
            ironOre: this.player.inventory.ironOre ?? 0,
            goldOre: this.player.inventory.goldOre ?? 0,
            copperBar: this.player.inventory.copperBar ?? 0,
            ironBar: this.player.inventory.ironBar ?? 0,
            goldBar: this.player.inventory.goldBar ?? 0,
          }
        })
      })
        .catch(err => console.error("Failed to save progress:", err))
    }

    //drop coins from monster, with variance
    coinDrop(x, y) {
      const coinsDropped = Phaser.Math.Between(3, 7)

      for (let i = 0; i < coinsDropped; i++) {
        const xOffset = Phaser.Math.Between(-20, 20)
        const yOffset = Phaser.Math.Between(-20, 20)

        const coin = this.physics.add.sprite(x + xOffset, y + yOffset, "coins")
        coin.setBounce(0.6)
        coin.setVelocity(Phaser.Math.Between(-50, 50), Phaser.Math.Between(-10, -50))
        coin.setCollideWorldBounds(true)
        this.coins.add(coin)

        //automatically pick up coins after set time
        this.time.delayedCall(8500, () => {
          if (coin.active) {
            this.pickupCoin(coin)
          }
        })
      }
      return coinsDropped
    }
    getClickDamage() {
      const sword = getToolStats(this.player, "sword")
      return sword.dps * this.player.clickMultiplier
    }
    update() {
      const pointer = this.input.activePointer

      this.coins.children.each(coin => {
        if (!coin.active) return
        const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, coin.x, coin.y)
        //manually pickup coins using mouse pointer
        if (dist < 30) {
          this.pickupCoin(coin)
        }
      })
    }
  }

  // class ShopScene extends Phaser.Scene {
  //   constructor() {
  //     super("scene-shop")
  //     this.baseCosts = { coinMultiplier: 150, dpsMultiplier: 100, clickMultiplier: 60, oreMultiplier: 50, oreDpsMultiplier: 40, oreClickMultiplier: 25 }
  //   }

  //   init(data) {
  //     // Receive player data from MainScene
  //     this.player = data.player
  //     recomputeAllUpgradeCosts(this.player, this.baseCosts)

  //   }

  //   create() {
  //     showUI(this.scene.key)
  //     // const combatButton = document.getElementById("combatButton")
  //     // const miningButton = document.getElementById("miningButton")
  //     // if (combatButton) {
  //     //   combatButton.style.display = "none"
  //     // }
  //     // if (miningButton) {
  //     //   miningButton.style.display = "none"
  //     // }
  //     this.add.rectangle(0, 0, 928, 793, 0x222222).setOrigin(0, 0)
  //     this.add.text(464, 50, "Shop", {
  //       fontSize: '32px',
  //       color: '#ffffff',
  //       fontStyle: 'bold',
  //     }).setOrigin(0.5)
  //     // Back button
  //     const backButton = this.add.text(20, 740, "Back", {
  //       fontSize: '24px',
  //       color: '#ffffff',
  //       backgroundColor: '#000',
  //       padding: { x: 15, y: 8 },
  //       fontStyle: 'bold'
  //     })
  //       .setInteractive({ useHandCursor: true })
  //       .on('pointerdown', () => {
  //         fetch(`${API_BASE}/saveProgress`, {
  //           method: "POST",
  //           headers: { "Content-Type": "application/json" },
  //           body: JSON.stringify({
  //             username: this.player.username,
  //             stats: {
  //               combatLevel: this.player.skills.combat.level,
  //               combatXP: this.player.skills.combat.xp,
  //               coinMultLevel: this.player.upgrades.coinMultiplier.level,
  //               dpsMultLevel: this.player.upgrades.dpsMultiplier.level,
  //               clickMultLevel: this.player.upgrades.clickMultiplier.level,
  //               miningLevel: this.player.skills.mining.level,
  //               miningXP: this.player.skills.mining.xp,
  //               oreMultLevel: this.player.upgrades.oreMultiplier.level,
  //               oreDpsMultLevel: this.player.upgrades.oreDpsMultiplier.level,
  //               oreClickMultLevel: this.player.upgrades.oreClickMultiplier.level,
  //               smithingLevel: this.player.skills.smithing.level,
  //               smithingXP: this.player.skills.smithing.xp,
  //               swordTier: this.player.stats.swordTier ?? 1,
  //               pickaxeTier: this.player.stats.pickaxeTier ?? 1,
  //             },
  //             inventory: {
  //               coins: this.player.inventory.coins ?? 0,
  //               copperOre: this.player.inventory.copperOre ?? 0,
  //               ironOre: this.player.inventory.ironOre ?? 0,
  //               goldOre: this.player.inventory.goldOre ?? 0,
  //               copperBar: this.player.inventory.copperBar ?? 0,
  //               ironBar: this.player.inventory.ironBar ?? 0,
  //               goldBar: this.player.inventory.goldBar ?? 0,
  //             }
  //           })
  //         }).catch(err => console.error("Failed to save progress:", err))

  //         const lastScene = this.player.lastScene || "scene-main"

  //         // Smooth fade-out + fade-in chain
  //         this.cameras.main.fadeOut(300, 0, 0, 0)
  //         this.cameras.main.once("camerafadeoutcomplete", () => {
  //           this.scene.stop("scene-shop")

  //           const targetScene = this.scene.get(lastScene) ? lastScene : "scene-main"
  //           this.scene.start(targetScene, { player: this.player })

  //           const nextScene = this.scene.get(targetScene)
  //           if (nextScene && nextScene.cameras && nextScene.cameras.main) {
  //             nextScene.cameras.main.fadeIn(300, 0, 0, 0)
  //           }
  //         })
  //       })


  //     // Combat + Mining upgrades
  //     const upgrades = [
  //       { key: "coinMultiplier", label: "Coin Multiplier", row: 0 },
  //       { key: "dpsMultiplier", label: "DPS Multiplier", row: 0 },
  //       { key: "clickMultiplier", label: "Click Multiplier", row: 0 },

  //       { key: "oreMultiplier", label: "Ore Multiplier", row: 1 },
  //       { key: "oreDpsMultiplier", label: "Ore DPS Multiplier", row: 1 },
  //       { key: "oreClickMultiplier", label: "Ore Click Multiplier", row: 1 },
  //     ];

  //     const startX = 100;
  //     const startY = 120;
  //     const colSpacing = 250;
  //     const rowSpacing = 210;
  //     const itemsPerRow = 3;
  //     this.upgradeTexts = {};

  //     const oreLabelFromKey = (k) => {
  //       if (k === "copperOre") return "Copper Ore";
  //       if (k === "ironOre") return "Iron Ore";
  //       return "Gold Ore";
  //     };
  //     const oreKeyForLevel = (lvl) => (lvl < 10 ? "copperOre" : (lvl < 20 ? "ironOre" : "goldOre"));
  //     const oreAmtForLevel = (lvl) => Math.floor(5 + 1.5 * lvl);

  //     upgrades.forEach((upg, index) => {
  //       const col = index % itemsPerRow;
  //       const x = startX + col * colSpacing;
  //       const y = startY + upg.row * rowSpacing;

  //       const card = this.add.rectangle(x, y, 220, 200, 0x333333, 0.8)
  //         .setStrokeStyle(2, 0xffffff)
  //         .setOrigin(0, 0);

  //       // Title
  //       this.add.text(x + 110, y + 18, upg.label, {
  //         fontSize: "22px",
  //         color: "#ffff00",
  //         fontStyle: "bold",
  //         align: "center",
  //         wordWrap: { width: 200 }
  //       }).setOrigin(0.5, 0);

  //       // Level + Cost block
  //       const u = this.player.upgrades[upg.key];
  //       const level = u?.level ?? 0;
  //       const coinCost = u?.cost ?? getUpgradeCost(this.baseCosts[upg.key] || 100, level + 1);

  //       let costDisplay = `Level: ${level}\nCost: ${coinCost} coins`;
  //       if (upg.key.startsWith("ore")) {
  //         const oreKey = oreKeyForLevel(level);
  //         const oreAmt = oreAmtForLevel(level);
  //         costDisplay = `Level: ${level}\nCost:\n${coinCost} coins\n${oreAmt} ${oreLabelFromKey(oreKey)}`;
  //       }

  //       const costText = this.add.text(x + 110, y + 64, costDisplay, {
  //         fontSize: "15px",
  //         color: "#ffffff",
  //         align: "center",
  //         lineSpacing: 2,
  //         wordWrap: { width: 190 }
  //       }).setOrigin(0.5, 0);
  //       this.upgradeTexts[upg.key] = costText;

  //       // Button
  //       const buttonY = y + 160;
  //       this.add.rectangle(x + 110, buttonY, 180, 40, 0xffff00, 0.8)
  //         .setStrokeStyle(2, 0xffffff)
  //         .setOrigin(0.5)
  //         .setInteractive({ useHandCursor: true })
  //         .on("pointerdown", () => this.buyUpgrade(upg.key));

  //       this.add.text(x + 110, buttonY, "Upgrade", {
  //         fontSize: "18px",
  //         color: "#000",
  //         fontStyle: "bold"
  //       }).setOrigin(0.5);
  //     });
  //   }
  //   //shop notifications
  //   toast(msg, color = "#ffff99") {
  //     const t = this.add.text(464, 720, msg, {
  //       fontSize: "20px",
  //       color,
  //       stroke: "#000",
  //       strokeThickness: 3
  //     }).setOrigin(0.5);

  //     this.tweens.add({
  //       targets: t,
  //       y: 690,
  //       alpha: 0,
  //       duration: 1800,
  //       ease: "Cubic.easeOut",
  //       onComplete: () => t.destroy()
  //     });
  //   }
  //   buyUpgrade(upgradeType) {
  //     const upgrade = this.player.upgrades[upgradeType];
  //     const names = {
  //       coinMultiplier: "Coin Multiplier",
  //       dpsMultiplier: "DPS Multiplier",
  //       clickMultiplier: "Click Damage Multiplier",
  //       oreMultiplier: "Ore Multiplier",
  //       oreDpsMultiplier: "Ore DPS Multiplier",
  //       oreClickMultiplier: "Ore Click Multiplier",
  //     };

  //     const level = upgrade.level ?? 0;
  //     const currentCoinCost = upgrade.cost ?? getUpgradeCost(this.baseCosts[upgradeType], level + 1);

  //     const isOreUpgrade = upgradeType.startsWith("ore");
  //     const oreKeyForLevel = (lvl) => (lvl < 10 ? "copperOre" : (lvl < 20 ? "ironOre" : "goldOre"));
  //     const oreLabelFromKey = (k) => (k === "copperOre" ? "Copper Ore" : k === "ironOre" ? "Iron Ore" : "Gold Ore");
  //     const oreAmtForLevel = (lvl) => Math.floor(5 + 1.5 * lvl);

  //     let requiredOreKey = null;
  //     let requiredOreAmount = 0;
  //     if (isOreUpgrade) {
  //       requiredOreKey = oreKeyForLevel(level);
  //       requiredOreAmount = oreAmtForLevel(level);
  //     }

  //     // Missing resources check (subtract what the player has) 
  //     const coinsShort = Math.max(0, currentCoinCost - (this.player.inventory.coins ?? 0));
  //     const haveOre = isOreUpgrade ? (this.player.inventory?.[requiredOreKey] ?? 0) : 0;
  //     const oreShort = isOreUpgrade ? Math.max(0, requiredOreAmount - haveOre) : 0;

  //     if (coinsShort > 0 || oreShort > 0) {
  //       const parts = [];
  //       if (coinsShort > 0) parts.push(`${coinsShort} more coins`);
  //       if (oreShort > 0) parts.push(`${oreShort} ${oreLabelFromKey(requiredOreKey)}`);
  //       this.toast(`You need: ${parts.join(" and ")}!`, "#ffcccc");
  //       return;
  //     }

  //     // Take resources
  //     this.player.inventory.coins = Number(this.player.inventory.coins) || 0
  //     this.player.inventory.coins -= currentCoinCost;
  //     this.player.inventory.coins = this.player.inventory.coins;

  //     if (isOreUpgrade) {
  //       this.player.inventory[requiredOreKey] -= requiredOreAmount;
  //       if (this.player.inventory[requiredOreKey] < 0) this.player.inventory[requiredOreKey] = 0; // safety
  //     }

  //     // Apply upgrade
  //     upgrade.level++;
  //     const nextCost = getUpgradeCost(this.baseCosts[upgradeType], upgrade.level + 1);
  //     upgrade.cost = nextCost;

  //     // Recompute multipliers
  //     if (upgradeType === "coinMultiplier") {
  //       this.player.coinMultiplier = 1.00 + 0.12 * upgrade.level;
  //     } else if (upgradeType === "dpsMultiplier") {
  //       this.player.dpsMultiplier = 1.00 + 0.12 * upgrade.level;
  //     } else if (upgradeType === "clickMultiplier") {
  //       this.player.clickMultiplier = 1.00 + 0.12 * upgrade.level;
  //     } else if (upgradeType === "oreMultiplier") {
  //       this.player.oreMultiplier = 1.00 + 0.12 * upgrade.level;
  //     } else if (upgradeType === "oreDpsMultiplier") {
  //       this.player.oreDpsMultiplier = 1.00 + 0.12 * upgrade.level;
  //     } else if (upgradeType === "oreClickMultiplier") {
  //       this.player.oreClickMultiplier = 1.00 + 0.12 * upgrade.level;
  //     }

  //     // Refresh specific card’s text so it shows the new level & costs
  //     const oreKeyNext = isOreUpgrade ? oreKeyForLevel(upgrade.level) : null;
  //     const oreAmtNext = isOreUpgrade ? oreAmtForLevel(upgrade.level) : 0;

  //     if (this.upgradeTexts[upgradeType]) {
  //       if (isOreUpgrade) {
  //         this.upgradeTexts[upgradeType].setText(
  //           `Level: ${upgrade.level}\nCost:\n${upgrade.cost} coins\n${oreAmtNext} ${oreLabelFromKey(oreKeyNext)}`
  //         );
  //       } else {
  //         this.upgradeTexts[upgradeType].setText(
  //           `Level: ${upgrade.level}\nCost: ${upgrade.cost} coins`
  //         );
  //       }
  //     }

  //     updateInventoryUI(this);
  //     this.toast(`${names[upgradeType]} upgraded!`, "#ffff99")

  //     // Let other scenes know (for the inventory panel)
  //     this.events.emit("coinsUpdated", this.player.inventory.coins);

  //     // save to db
  //     fetch(`${API_BASE}/saveProgress`, {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({
  //         username: this.player.username,
  //         stats: {
  //           combatLevel: this.player.skills.combat.level,
  //           combatXP: this.player.skills.combat.xp,
  //           coinMultLevel: this.player.upgrades.coinMultiplier.level,
  //           dpsMultLevel: this.player.upgrades.dpsMultiplier.level,
  //           clickMultLevel: this.player.upgrades.clickMultiplier.level,
  //           miningLevel: this.player.skills.mining.level,
  //           miningXP: this.player.skills.mining.xp,
  //           oreMultLevel: this.player.upgrades.oreMultiplier.level,
  //           oreDpsMultLevel: this.player.upgrades.oreDpsMultiplier.level,
  //           oreClickMultLevel: this.player.upgrades.oreClickMultiplier.level,
  //           smithingLevel: this.player.skills.smithing.level,
  //           smithingXP: this.player.skills.smithing.xp,
  //           swordTier: this.player.stats.swordTier ?? 1,
  //           pickaxeTier: this.player.stats.pickaxeTier ?? 1,
  //         },
  //         inventory: {
  //           coins: this.player.inventory.coins ?? 0,
  //           copperOre: this.player.inventory.copperOre ?? 0,
  //           ironOre: this.player.inventory.ironOre ?? 0,
  //           goldOre: this.player.inventory.goldOre ?? 0,
  //           copperBar: this.player.inventory.copperBar ?? 0,
  //           ironBar: this.player.inventory.ironBar ?? 0,
  //           goldBar: this.player.inventory.goldBar ?? 0,
  //         }
  //       })
  //     }).catch(err => console.error("Failed to save progress:", err));
  //   }


  // }
  const swordTier = user.stats?.swordTier ?? 1
  const pickaxeTier = user.stats?.pickaxeTier ?? 1
  const swordData = TOOL_TIERS.sword[swordTier]
  const pickaxeData = TOOL_TIERS.pickaxe[pickaxeTier]
  window.currentUser = {
    username: user.username,
    coins: user.inventory?.coins ?? 0,
    coinMultiplier: 1.00,
    dps: swordData.dps,
    dpsMultiplier: 1.00,
    clickMultiplier: 1.00,
    miningPower: pickaxeData.dps,
    oreMultiplier: 1.00,
    oreDpsMultiplier: 1.00,
    oreClickMultiplier: 1.00,

    // Player inventory
    inventory: {
      coins: user.inventory?.coins ?? 0,
      copperOre: user.inventory?.copperOre ?? 0,
      ironOre: user.inventory?.ironOre ?? 0,
      goldOre: user.inventory?.goldOre ?? 0,
      copperBar: user.inventory?.copperBar ?? 0,
      ironBar: user.inventory?.ironBar ?? 0,
      goldBar: user.inventory?.goldBar ?? 0,
      pickaxe: user.inventory?.pickaxe ?? null,
      sword: user.inventory?.sword ?? null,
    },

    // Upgrades
    upgrades: {
      coinMultiplier: {
        level: user.stats?.coinMultLevel ?? 0,
        cost: getUpgradeCost(150, (user.stats?.coinMultLevel ?? 0) + 1)
      },
      dpsMultiplier: {
        level: user.stats?.dpsMultLevel ?? 0,
        cost: getUpgradeCost(100, (user.stats?.dpsMultLevel ?? 0) + 1)
      },
      clickMultiplier: {
        level: user.stats?.clickMultLevel ?? 0,
        cost: getUpgradeCost(60, (user.stats?.clickMultLevel ?? 0) + 1)
      },
      oreMultiplier: {
        level: user.stats?.oreMultLevel ?? 0,
        cost: getUpgradeCost(50, (user.stats?.oreMultLevel ?? 0) + 1)
      },
      oreDpsMultiplier: {
        level: user.stats?.oreDpsMultLevel ?? 0,
        cost: getUpgradeCost(40, (user.stats?.oreDpsMultLevel ?? 0) + 1)
      },
      oreClickMultiplier: {
        level: user.stats?.oreClickMultLevel ?? 0,
        cost: getUpgradeCost(25, (user.stats?.oreClickMultLevel ?? 0) + 1)
      },
    },

    // Skills
    skills: {
      combat: { level: user.stats?.combatLevel ?? 1, xp: user.stats?.combatXP ?? 0 },
      mining: { level: user.stats?.miningLevel ?? 1, xp: user.stats?.miningXP ?? 0 },
      smithing: { level: user.stats?.smithingLevel ?? 1, xp: user.stats?.smithingXP ?? 0 },
    },
    stats: {
      swordTier,
      pickaxeTier
    },
    lastScene: "scene-main"
  }


  const config = {
    type: Phaser.WEBGL,
    width: sizes.width,
    height: sizes.height,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: sizes.width,
      height: sizes.height,
    },
    debug: true,
    parent: "gameContainer",
    scene: [MainScene, ShopScene, MiningScene, SmithingScene],
    physics: {
      default: "arcade",
      arcade: {
        debug: false
      }
    },
    canvasStyle: "position: absolute top: 0 left: 0 z-index: 0"
  }

  const game = new Phaser.Game(config)
  game.userData = window.currentUser
  setupGlobalButtons(game)
  return game
}

