import './style.css'
import Phaser from 'phaser';
import { addXP, createXPBar, getXPForNextLevel } from './utils/xp.js'
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001"

//global functions (multiple scenes can/will use)
export function getUpgradeCost(baseCost, level) {
  return Math.floor(baseCost * Math.pow(1.25, level));
}

export function recomputeAllUpgradeCosts(player, baseCosts) {
  if(!player.upgrades) {
    return
  }
  const keys = ["coinMultiplier", "dpsMultiplier", "clickMultiplier",]
  keys.forEach(k => {
    const lvl = player.upgrades[k]?.level?? 0
    player.upgrades[k].cost = getUpgradeCost(baseCosts[k], lvl + 1)
  })
}

export function updateInventoryUI(scene) {
      const inventoryUI = document.getElementById("inventoryUI")
      const player = scene.player
      if(!inventoryUI) {
        return
      }
      inventoryUI.innerHTML = ""

      const inv = scene.player.inventory;

      const items = [
        { name: "Coins", quantity: inv.coins, icon: "coins.png"},
        { name: "Logs", quantity: inv.logs },
        { name: "Ore", quantity: inv.ore },
        { name: "Axe", quantity: inv.axe ?? "Not equipped" },
        { name: "Pickaxe", quantity: inv.pickaxe ?? "Not equipped" },
        { name: "Sword", quantity: inv.sword ?? "Not equipped" },
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

export function startGame(user) {
  console.log("startGame called with user: ", user)
  console.log(user)

  const sizes = {
    //background size
    width:928,
    height:793
  }
  const MONSTERS = [
    {
      name: "wasp",
      unlockLevel: 0,
      texture: "wasp",
      baseHealth: 80,
      xpReward: 25,
      coinMultiplier: 1.0,
      yOffset: -120,
    },
    {
      name: "goblin",
      unlockLevel: 5,
      texture: "goblin",
      baseHealth: 200,
      xpReward: 40,      
      coinMultiplier: 1.75,
      yOffset: 0,
    },
    {
      name: "skeleton",
      unlockLevel: 10,
      texture: "skeleton",
      baseHealth: 320,
      xpReward: 64,
      coinMultiplier: 2.85,
      yOffset: 0,
    }
  ]
  class Enemy {
    constructor(scene, x, y, texture, maxHealth = 50, xpReward = null, name = "Unknown") {
      this.scene = scene;
      this.maxHealth = maxHealth;
      this.health = maxHealth;
      this.xpReward = xpReward;
      this.name = name;
      this.lastTintTime = 0
      this.tintCooldown = 400

      this.container = scene.add.container(x, y + 60);

      // enemy sprites
      this.sprite = scene.add.image(0, 0, texture).setOrigin(0.5, 1);
      this.sprite.setScale(2.3);
      this.sprite.flipX = true;
      this.sprite.setInteractive();
      this.container.add(this.sprite);

      // height of displayed sprite
      const spriteHeight = this.sprite.displayHeight;
      const hpBarY = -spriteHeight - 20;     // health bar sits just above the sprite
      const nameTextY = hpBarY - 25;         // name sits just above HP bar

      // Enemy name text
      this.nameText = scene.add.text(0, nameTextY, this.name.charAt(0).toUpperCase() + this.name.slice(1), {
        fontSize: '20px',
        fill: '#ffff00',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center'
      }).setOrigin(0.5);
      this.container.add(this.nameText);

      // Health bar background
      this.healthBarBg = scene.add.graphics();
      this.healthBarBg.fillStyle(0xff0000, 1);
      this.healthBarBg.fillRect(-100, hpBarY, 200, 20);
      this.container.add(this.healthBarBg);

      // Health bar
      this.healthBar = scene.add.graphics();
      this.healthBar.fillStyle(0x2ecc71, 1);
      this.healthBar.fillRect(-100, hpBarY, 200, 20);
      this.container.add(this.healthBar);

      // HP text 
      this.hpText = scene.add.text(0, hpBarY + 10, `${this.health}/${this.maxHealth}`, {
        fontSize: '16px',
        fill: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      this.container.add(this.hpText);

      // Bobbing animation
      this.idleTween = scene.tweens.add({
        targets: this.container,
        y: this.container.y - 10,
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });

      this.sprite.on("pointerdown", () => {
        this.takeDamage(scene.getClickDamage());
      });
    }
    updateHealthBar() {
      const hpBarY = -this.sprite.displayHeight - 20;
      const maxWidth = 200;
      const percent = Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);
      const filledWidth = maxWidth * percent;

      // Redraw the green HP bar only
      this.healthBar.clear();
      this.healthBar.fillStyle(0x2ecc71, 1);

      // Draw from left edge, fixed width background
      this.healthBar.fillRect(-100, hpBarY, filledWidth, 20);
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

        this.scene.tweens.add ({
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

      if (this.health <= 0){
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
          this.container.x,
          this.scene.groundY + (monster.yOffset ?? 0),
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
    constructor(){
      super("scene-game")

      this.baseCosts = {
        coinMultiplier: 150,
        dpsMultiplier: 100,
        clickMultiplier: 60,
      }
    }
    init (data) {
      if (data.player) {
        this.player = data.player
      } else {
        this.player = {
          username: user.username,
          //multipliers start at a base of 15%
          coins: user.coins ?? 0,
          coinMultiplier: 1.15,
          dps: 8,
          dpsMultiplier: 1.15,
          clickMultiplier: 1.15,
          upgrades: {
            coinMultiplier: { level: user.stats.coinMultLevel ?? 0, cost: 150},
            dpsMultiplier: { level: user.stats.dpsMultLevel ?? 0, cost: 100},
            clickMultiplier: { level: user.stats.clickMultLevel ?? 0, cost: 60},
          },
          skills: {
            combat : {
              level: user.stats.combatLevel ?? 1,
              xp: user.stats.combatXP ?? 0,
            }
          }
        }
        recomputeAllUpgradeCosts(this.player, this.baseCosts)
      }
    }
    preload(){
      // Load all sprites
      this.load.image("bg", "/assets/Background.png")
      this.load.image("wasp", "/assets/wasp.png")
      this.load.image("coins", "/assets/coins.png") 
      this.load.image("goblin", "/assets/goblin.png")
      this.load.image("skeleton", "/assets/skeleton.png")
    }

    create(){
      this.groundY = 670
      //events
      this.events.on("coinsUpdated", (newCointAmount) => {
        this.player.coins = newCointAmount
        updateInventoryUI(this)
        const inventoryUI = document.getElementById("inventoryUI")
        if(inventoryUI && inventoryUI.style.display != "none")
          updateInventoryUI(this)
      })
      //inventory structure
      if(!this.player.inventory) {
        this.player.inventory = {
          coins: user.coins ?? 0,
          logs: 0,
          ore: 0,
          axe: null,
          pickaxe: null,
          sword: null,
        }
      }
  
      //cost scaling for upgrades based on level + base cost
      if(!this.player.upgrades) {
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
        }
      }
      //multiplier scaling per level of multiplier
      this.player.coinMultiplier = 1.15 + 0.05 * this.player.upgrades.coinMultiplier.level;
      this.player.dpsMultiplier = 1.15 + 0.10 * this.player.upgrades.dpsMultiplier.level;
      this.player.clickMultiplier = 1.15 + 0.10 * this.player.upgrades.clickMultiplier.level;
      // console.log("Player initialized", this.player.username)
      //Background + Spawn sprites
      this.add.image(0, 0, "bg").setOrigin(0,0)
      this.coins = this.physics.add.group()

      //inventory's toggle button
      const inventoryButton = document.getElementById("inventoryToggle")
      inventoryButton.replaceWith(inventoryButton.cloneNode(true))
      const newInventoryButton = document.getElementById("inventoryToggle")


      //inventory's UI
      const inventoryUI = document.getElementById("inventoryUI");
      inventoryUI.id = "inventoryUI";
      inventoryUI.style.display = "none"

      
      newInventoryButton.addEventListener("click", (e) => {
        e.stopPropagation()
        inventoryUI.style.display = inventoryUI.style.display == "none" ? "grid" : "none"
      })
      updateInventoryUI(this)

      //upgrade button
      const upgradeMenuButton = document.getElementById("upgradeMenuButton")
      // upgradeMenuButton.id = "upgradeMenuButton"
      // upgradeMenuButton.textContent = ("Upgrade Shop")

      //upgrade ui
      // const upgradeUI = document.getElementById("upgradeMenu")
      // upgradeUI.id = "upgradeMenu"
      // upgradeUI.style.display = "none"

      upgradeMenuButton.onclick = (e) => {
        e.stopPropagation()
        this.scene.start("scene-shop", { player: this.player })
      }

      // const upgrades = [
      //   { id: "upgradeCoinMult", label: "Coin Multiplier" },
      //   { id: "upgradeDPSMult", label: "Dps Multiplier" },
      //   { id: "upgradeClickMult", label: "Click Multiplier" },
      // ]

      // upgrades.forEach (upg => {
      //   const button = document.createElement("button")
      //   button.id = upg.id
      //   button.textContent = `${upg.label} - Level: 0`
      //   upgradeUI.appendChild(button)

      //   button.onclick = () => {
      //     this.buyUpgrade(upg.id.replace("upgrade", "").toLowerCase())
      //   }
      // })

      // const upgradeMessage = document.createElement("p");
      // upgradeMessage.id = "upgradeMessage";
      // upgradeUI.appendChild(upgradeMessage);

      // this.updateUpgradeUI()

      // const userInfo = document.createElement("div")
      // // userInfo.id = "userInfo"
      // // userInfo.textContent = `Username: ${this.player.username}`
      // gameUI.appendChild(userInfo)

      // const coinDisplay = document.createElement("div");
      // coinDisplay.id = "coinInfo";
      // coinDisplay.textContent = `Coins: ${this.player.coins.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
      // gameUI.appendChild(coinDisplay);

      // document.getElementById("upgradeMenuButton")
      // upgradeMenuButton.style.display = "block"
      // upgradeMenuButton.onclick = () => {
      //   upgradeUI.style.display = upgradeUI.style.display == "none" ? "block" : "none"
      // }
      // //upgrade buttons
      // document.getElementById("upgradeCoinMult").onclick = () => this.buyUpgrade("coinMultiplier")
      // document.getElementById("upgradeDPSMult").onclick = () => this.buyUpgrade("dpsMultiplier")
      // document.getElementById("upgradeClickMult").onclick = () => this.buyUpgrade("clickMultiplier")

      //spawn enemy using "Enemy" class
      if(!this.enemies) {
        this.enemies = []
      }
      const monster = this.getCurrentMonsterType()
      const enemy = new Enemy(
        this,
        464,
        this.groundY + (monster.yOffset ?? 0),
        monster.texture,
        monster.baseHealth,
        monster.xpReward,
        monster.name
      )
      this.enemies.push(enemy)

      this.combatXPBar = createXPBar(this, "combat", 0x00ff00, 20)
      this.combatXPBar.update(this.player)

      //DPS function
      this.time.addEvent({
        delay: 1000, //1s
        loop: true,
        callback: () => {
          console.log("DPS hit")
          this.enemies.forEach((enemy) => {
            if (enemy.health > 0 && enemy.container.active) {
              enemy.takeDamage(this.player.dps * this.player.dpsMultiplier)
            }
          })
        },
      })
    
    }
    spawnNewMonster(monsterName) {
      // Remove old enemies
      this.enemies.forEach(e => e.container.destroy());
      this.enemies = [];

      const monsterData = this.monsters.find(m => m.name === monsterName);
      if (!monsterData) return;

      const newEnemy = new Enemy(this, 464, 396.5, monsterData.texture,
        monsterData.maxHealth, monsterData.xpReward);
      this.enemies.push(newEnemy);
      console.log(`${monsterName} spawned!`);
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
    // buyUpgrade(upgradeType) {
    //   const upgrade = this.player.upgrades[upgradeType]
    //   const upgradeNames = {
    //     coinMultiplier: "Coin Multiplier",
    //     dpsMultiplier: "Dps Multiplier",
    //     clickMultiplier: "Click Damage Multiplier"
    //   }
    //   const message = document.getElementById("upgradeMessage")

    //   if (this.player.coins < upgrade.cost) {
    //     message.textContent = "Not enough coins!"
    //     return
    //   }
    //   this.player.coins -= upgrade.cost
    //   upgrade.level++
    //   //Scale the cost of the upgrades
    //   upgrade.cost = getUpgradeCost(this.baseCosts[upgradeType], upgrade.level)   

    //   if (upgradeType == "coinMultiplier") {
    //     this.player.coinMultiplier = 1.15 + 0.05 * upgrade.level //add X% to the mult
    //   } else if (upgradeType == "dpsMultiplier") {
    //     this.player.dps = 8 
    //     this.player.dpsMultiplier = 1.15 + 0.10 * upgrade.level //add X% to the mult
    //   } else if (upgradeType == "clickMultiplier") {
    //     this.player.clickMultiplier = 1.15 + 0.10 * upgrade.level //add X% to the mult
    //   }

    //   this.updateCoinDisplay()
    //   this.updateUpgradeUI()
    //   message.textContent = `${upgradeNames[upgradeType]} upgraded to level ${upgrade.level}!`

    //   //database
    //   fetch(`${API_BASE}/saveProgress`, {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({
    //       username: this.player.username,
    //       coins: this.player.coins,
    //       stats: {
    //         coinMultLevel: this.player.upgrades.coinMultiplier.level,
    //         dpsMultLevel: this.player.upgrades.dpsMultiplier.level,
    //         clickMultLevel: this.player.upgrades.clickMultiplier.level,
    //       }
    //     })
    //   }).catch(err => console.error("Failed to update upgrades:", err))
    // }

    //makes the hp bar
    makeBar(x,y,color) {
      let bar = this.add.graphics()
      bar.fillStyle(color, 1)
      bar.fillRect(0,0,200,20)
      bar.x=x
      bar.y=y
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
      this.player.coins += coinsGained
      this.player.inventory.coins = this.player.coins
      updateInventoryUI(this)
      this.showCoinText(coin.x, coin.y, `+${coinsGained} Coin${coinsGained > 1 ? 's' : ''}`, "#ffffff") //Coin${coinsGained > 1 ? 's' : ''}` Determine if coins are plural or singular (1 coin or 2 coin(s))

      //save progress (coins)
      fetch(`${API_BASE}/saveProgress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: this.player.username,
          coins: Math.floor(this.player.coins),
          stats: {
            coinMultLevel: this.player.upgrades.coinMultiplier.level,
            dpsMultLevel: this.player.upgrades.dpsMultiplier.level,
            clickMultLevel: this.player.upgrades.clickMultiplier.level,
            combatLevel: this.player.skills.combat.level,
            combatXP: this.player.skills.combat.xp
          }
        })
      }).catch(err => console.error("Failed to save coins: ", err))
    }
    // updateCoinDisplay() {
    //   const coinInfo = document.getElementById("coinInfo")
    //   if (coinInfo) 
    //     coinInfo.textContent = `Coins: ${Math.floor(this.player.coins).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    // }
    // updateUpgradeUI() {
    //   const { coinMultiplier, dpsMultiplier, clickMultiplier } = this.player.upgrades
    //   document.getElementById("upgradeCoinMult").textContent = `Increase Coin Multiplier (Cost: ${this.player.upgrades.coinMultiplier.cost.toLocaleString("en-US", { maximumFractionDigits: 0 })}) - Level: ${this.player.upgrades.coinMultiplier.level}`;
    //   document.getElementById("upgradeDPSMult").textContent = `Increase DPS Multiplier (Cost: ${this.player.upgrades.dpsMultiplier.cost.toLocaleString("en-US", { maximumFractionDigits: 0 })}) - Level: ${this.player.upgrades.dpsMultiplier.level}`;
    //   document.getElementById("upgradeClickMult").textContent = `Increase Click Multiplier (Cost: ${this.player.upgrades.clickMultiplier.cost.toLocaleString("en-US", { maximumFractionDigits: 0 })}) - Level: ${this.player.upgrades.clickMultiplier.level}`;
    // }

    //drop coins from monster, with variance
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
            this.pickupCoin(coin)
          }
        })
      }
      return coinsDropped
    }
    getClickDamage() {
      return this.player.dps * this.player.clickMultiplier
    }
      update() {
      const pointer = this.input.activePointer

      this.coins.children.each(coin =>{
        if (!coin.active) return
        const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, coin.x, coin.y)
        //manually pickup coins using mouse pointer
        if(dist < 30){
          this.pickupCoin(coin)
        }
      })
    }
  }

  class ShopScene extends Phaser.Scene {
  constructor() {
    super("scene-shop");
    this.baseCosts = { coinMultiplier: 150, dpsMultiplier: 100, clickMultiplier: 60 };
  }

  init(data) {
    // Receive player data from MainScene
    this.player = data.player;
    recomputeAllUpgradeCosts(this.player, this.baseCosts)

  }

  create() {
    this.add.rectangle(0, 0, 928, 793, 0x222222).setOrigin(0, 0);

    this.add.text(464, 50, "Upgrade Shop", { fontSize: '32px', color: '#ffffff' })
        .setOrigin(0.5);

    const backButton = this.add.text(20, 740, "Back", { fontSize: '24px', color: '#ffffff', backgroundColor: '#000', padding: {x:15, y:8}, fontStyle: 'bold' })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        //ensure data is saved to DB when going back to MainScene
        fetch(`${API_BASE}/saveProgress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: this.player.username,
            coins: this.player.coins,
            stats: {
              coinMultLevel: this.player.upgrades.coinMultiplier.level,
              dpsMultLevel: this.player.upgrades.dpsMultiplier.level,
              clickMultLevel: this.player.upgrades.clickMultiplier.level,
              combatLevel: this.player.skills.combat.level,
              combatXP: this.player.skills.combat.xp
            }
          })
        }).catch(err => console.error("Failed to update upgrades:", err));
        this.scene.start("scene-game", { player: this.player }); // back to main scene
      });

    // Upgrades
    const upgrades = [
      { key: "coinMultiplier", label: "Coin Multiplier" },
      { key: "dpsMultiplier", label: "DPS Multiplier" },
      { key: "clickMultiplier", label: "Click Multiplier" },
      //TODO: ADD ALL UPGRADES IN ERD
    ];

    //"shelf" parameters for upgrade shop
    const startX = 100
    const startY = 120
    const colSpacing = 250
    const rowSpacing = 180
    const itemsPerRow = 3
    this.upgradeTexts = {}
    // Display upgrade buttons
    upgrades.forEach((upg, index) => {
      const col = index % itemsPerRow
      const row = Math.floor(index / itemsPerRow)
      const x = startX + col * colSpacing
      const y = startY + row * rowSpacing

      // Card background
      const card = this.add.rectangle(x, y, 220, 180, 0x333333, 0.8)
        .setStrokeStyle(2, 0xffffff)
        .setOrigin(0, 0)

      // Upgrade name
      const nameText = this.add.text(x + 110, y + 20, upg.label,
        { fontSize: '22px', color: '#ffff00', fontStyle: 'bold', align: 'center', wordWrap: { width: 200 } })
        .setOrigin(0.5, 0)

      // Upgrade level and cost text
      const level = this.player.upgrades[upg.key].level
      const cost = this.player.upgrades[upg.key].cost
      const costText = this.add.text(x + 110, y + 70, `Level: ${level}\nCost: ${cost} coins`,
        { fontSize: '18px', color: '#ffffff', align: 'center', wordWrap: { width: 200 }, lineSpacing: 4 })
        .setOrigin(0.5, 0)
      this.upgradeTexts[upg.key] = costText

      // Upgrade button
      const buttonY = y + 150
      const button = this.add.rectangle(x + 110, buttonY, 180, 40, 0xffff00, 0.8)
        .setStrokeStyle(2, 0xffffff)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.buyUpgrade(upg.key))

      this.add.text(x + 110, buttonY, "Upgrade", { fontSize: '18px', color: '#000', fontStyle: 'bold' })
        .setOrigin(0.5, 0.5)
    })

    // Upgrade feedback message
    this.upgradeMessage = this.add.text(464, 680, "", { fontSize: '20px', color: '#ff0', align: 'center' })
      .setOrigin(0.5)
}

  buyUpgrade(upgradeType) {
    const upgrade = this.player.upgrades[upgradeType];
    const upgradeNames = { coinMultiplier: "Coin Multiplier", dpsMultiplier: "DPS Multiplier", clickMultiplier: "Click Damage Multiplier" };
    const currentCost = upgrade.cost

    if (this.player.coins < currentCost) {
      this.upgradeMessage.setText("Not enough coins!");
      return;
    }

    this.player.coins -= currentCost
    this.player.inventory.coins = this.player.coins
    upgrade.level++;
    const nextCost = getUpgradeCost(this.baseCosts[upgradeType], upgrade.level + 1)

    // Update multipliers
    if (upgradeType === "coinMultiplier") {
      this.player.coinMultiplier = 1.15 + 0.05 * upgrade.level;
    } else if (upgradeType === "dpsMultiplier") {
      this.player.dpsMultiplier = 1.15 + 0.10 * upgrade.level;
    } else if (upgradeType === "clickMultiplier") {
      this.player.clickMultiplier = 1.15 + 0.10 * upgrade.level;
    }

    upgrade.cost = nextCost
    updateInventoryUI(this)
    if(this.upgradeTexts[upgradeType]) {
      this.upgradeTexts[upgradeType].setText(`Level: ${upgrade.level} | Cost: ${nextCost} coins`)
    }

    this.upgradeMessage.setText(`${upgradeNames[upgradeType]} upgraded to level ${upgrade.level}! Coins Remaining: ${this.player.coins} `);

    this.events.emit("coinsUpdated", this.player.coins) //emits an event to other scenes (in this case to update coins within inventory)

    // Save to backend
    fetch(`${API_BASE}/saveProgress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: this.player.username,
        coins: this.player.coins,
        stats: {
          coinMultLevel: this.player.upgrades.coinMultiplier.level,
          dpsMultLevel: this.player.upgrades.dpsMultiplier.level,
          clickMultLevel: this.player.upgrades.clickMultiplier.level,
          combatLevel: this.player.skills.combat.level,
          combatXP: this.player.skills.combat.xp
        }
      })
    }).catch(err => console.error("Failed to update upgrades:", err));
  }
}




  const config = {
    type:Phaser.WEBGL,
    width:sizes.width,
    height:sizes.height,
    debug: true,
    parent: "gameContainer",
    scene:[MainScene, ShopScene],
    physics: {
      default: "arcade",
      arcade: {
        debug: false
      }
    },
    canvasStyle: "position: absolute; top: 0; left: 0; z-index: 0;"
  }

  const game = new Phaser.Game(config)
  game.userData = window.currentUser;
}