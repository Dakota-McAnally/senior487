import Phaser from 'phaser'
import { addXP, createXPBar } from './utils/xp.js'
import { updateInventoryUI, getUpgradeCost, recomputeAllUpgradeCosts, getToolStats } from './main.js'
import { showUI, setupGlobalButtons } from './utils/uiManager.js'


const API_BASE = import.meta.env.local.VITE_API_BASE || ""

const ORES = [
    {
        name: "copper",
        unlockLevel: 0,
        texture: "copperOre",
        nodeHealth: 120,
        xpReward: 25,
        oreMultiplier: 1.0
    },
    {
        name: "iron",
        unlockLevel: 5,
        texture: "ironOre",
        nodeHealth: 290,
        xpReward: 60,
        oreMultiplier: 2
    },
    {
        name: "gold",
        unlockLevel: 10,
        texture: "goldOre",
        nodeHealth: 680,
        xpReward: 120,
        oreMultiplier: 3
    }
]

export class MiningScene extends Phaser.Scene {
    constructor() {
        super("scene-mining")
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
        this.player = data.player
        recomputeAllUpgradeCosts(this.player, this.baseCosts)
    }

    preload() {
        this.load.image("miningBackground", "/assets/mining_bg.png")
        this.load.image("copperOre", "/assets/copper_ore.png")
        this.load.image("ironOre", "/assets/iron_ore.png")
        this.load.image("goldOre", "/assets/gold_ore.png")
        this.load.image("copper_item", "/assets/copper_item.png")
        this.load.image("iron_item", "/assets/iron_item.png")
        this.load.image("gold_item", "/assets/gold_item.png")
        this.load.image("pickaxe", "/assets/pickaxe.png")
    }

    create() {
        showUI(this.scene.key)
        const miningBg = this.add.image(0, 0, "miningBackground").setOrigin(0, 0)
        miningBg.setDisplaySize(this.scale.width, this.scale.height)
        this.ores = this.physics.add.group()
        // Mining node
        const savedOre = localStorage.getItem("selectedOre")
        const currentOre = this.getCurrentOreType()
        const foundOre = ORES.find(o => o.name === savedOre)
        if(foundOre && this.player.skills.mining.level >= foundOre.unlockLevel) {
            this.activeOreName = foundOre.name
        } else {
            this.activeOreName = currentOre.name
        }
        this.activeNode = this.spawnOreNode(ORES.find(o => o.name === this.activeOreName || currentOre)
        )
        // Pickaxe sprite
        this.pickaxe = this.add.image(534, 400, "pickaxe")
            .setOrigin(0.85, 0.2)
            .setScale(1.2)
            .setFlipX(true)
            .setAngle(-25)
            .setDepth(10)

        // XP bar
        this.miningXPBar = createXPBar(this, "mining", 0x9999ff, 20)
        this.miningXPBar.update(this.player)
        // Scene title
        this.add.text(464, 60, "Bountiful Cave", {
            fontSize: "32px",
            color: "#ffffcc",
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 3
        }).setOrigin(0.5);
        //Ore selection buttons
        this.orePanel = this.add.container(464, 120)
        this.createOreIcons()

        // DPS system
        this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                if (this.activeNode && this.activeNode.health > 0) {
                    this.swingPickaxe()
                    const pickaxeStats = getToolStats(this.player, "pickaxe")
                    this.activeNode.takeDamage(pickaxeStats.miningPower * this.player.oreDpsMultiplier)
                }
            }
        })
        this.miningXPBar.update(this.player)
        this.cameras.main.fadeIn(300, 0, 0, 0)
    }
    update() {
        const pointer = this.input.activePointer
        this.ores.children.each(ore => {
            if (!ore.active) {
                return
            }
            const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, ore.x, ore.y)
            if (dist < 40) {
                this.pickupOre(ore)
            }
        })
    }
    swingPickaxe() {
        if (this.isSwinging) {
            return
        }
        this.isSwinging = true
        this.tweens.add({
            targets: this.pickaxe,
            angle: { from: -25, to: 55 },
            duration: 100,
            yoyo: true,
            ease: "Cubic.easeInOut",
            onYoyo: () => {
                this.tweens.add({
                    targets: this.activeNode,
                    x: `+=${Phaser.Math.Between(-6, 6)}`,
                    duration: 60,
                    yoyo: true,
                    ease: "Sine.easeInOut"
                })
            },
            onComplete: () => {
                this.isSwinging = false
            }
        })
    }
    getCurrentOreType() {
        const level = this.player.skills.mining.level ?? 1
        let current = ORES[0]
        for (const ore of ORES) {
            if (level >= ore.unlockLevel) current = ore
        }
        return current
    }
    getUnlockedOres() {
        const level = this.player.skills.mining.level ?? 1
        return ORES.filter(ore => level >= ore.unlockLevel)
    }
    createOreIcons() {
        const unlockedOres = this.getUnlockedOres()

        // Clear old icons if re-rendering
        if (this.orePanel.list.length) {
            this.orePanel.removeAll(true)
        }

        const iconSpacing = 90
        const startX = -(unlockedOres.length - 1) * (iconSpacing / 2)

        unlockedOres.forEach((ore, i) => {
            const icon = this.add.image(startX + i * iconSpacing, 0, `${ore.name}_item`)
                .setScale(1.5)
                .setInteractive({ useHandCursor: true })
                .setAlpha(ore.name === this.activeOreName ? 1 : 0.6)

            const frame = this.add.rectangle(startX + i * iconSpacing, 0, 64, 64)
                .setStrokeStyle(2, 0xffffff)
                .setOrigin(0.5)
                .setAlpha(ore.name === this.activeOreName ? 1 : 0.4)

            const container = this.add.container(0, 0, [frame, icon])

            icon.on("pointerover", () => {
                frame.setStrokeStyle(2, 0xffff66)
                icon.setScale(1.7)
            })
            icon.on("pointerout", () => {
                frame.setStrokeStyle(2, 0xffffff)
                icon.setScale(1.5)
            })
            icon.on("pointerdown", () => {
                this.changeActiveOre(ore)
                this.activeOreName = ore.name
                this.player.selectedOre = ore.name
                //very rare instance of localStorage (no need to store the lastSelected ore in DB)
                localStorage.setItem("selectedOre", ore.name)
                this.createOreIcons() 
            })
            this.orePanel.add(container)
        })
    }

    changeActiveOre(oreData) {
        if(this.isChangingOre) {
            return
        }
        if(this.isSwinging) {
            return
        }
        if(this.activeNode && this.activeNode.container) {
            this.activeNode.container.destroy()
            this.activeNode = null
        }

        this.time.delayedCall(150, () => {
            this.activeOreName = oreData.name
            this.activeNode = this.spawnOreNode(oreData)
            
            const text = this.add.text(464, 160, `Mining ${oreData.name}!`, {
                fontSize: '18px', color: '#ffffcc', fontStyle: 'bold'
            }).setOrigin(0.5)

            this.tweens.add({
                targets: text,
                y: text.y - 30,
                alpha: 0,
                duration: 1000,
                ease: "Cubic.easeOut",
                onComplete: () => text.destroy()
            })
            this.createOreIcons()
            this.isChangingOre = false
        })
    }
    // generates the proper ore based on player mining level
    spawnOreNode(oreData) {
        //guarantee only one ore node exists at a time
        if(this.activeNode && this.activeNode.container) {
            this.activeNode.container.destroy()
        }
        const container = this.add.container(464, 600)

        // create ore sprite
        const oreSprite = this.add.image(0, 0, oreData.texture).setOrigin(0.5, 1)
        oreSprite.setScale(3)
        oreSprite.setInteractive()
        container.add(oreSprite)

        // ore stats
        const ore = {
            container,
            sprite: oreSprite,
            maxHealth: oreData.nodeHealth,
            health: oreData.nodeHealth,
            xpReward: oreData.xpReward,
            oreMultiplier: oreData.oreMultiplier,
            name: oreData.name
        }

        // hp bar bg
        const hpBarY = -oreSprite.displayHeight - 30
        const hpBarBg = this.add.graphics()
        hpBarBg.fillStyle(0xff0000, 1)
        hpBarBg.fillRect(-100, hpBarY, 200, 20)
        container.add(hpBarBg)

        // fill ore hp bar 
        const hpBar = this.add.graphics()
        hpBar.fillStyle(0x33ff33, 1)
        hpBar.fillRect(-100, hpBarY, 200, 20)
        container.add(hpBar)

        // ore node HP text
        const hpText = this.add.text(0, hpBarY + 10, `${ore.health}/${ore.maxHealth}`, {
            fontSize: "16px",
            color: "#ffffff",
            fontStyle: "bold"
        }).setOrigin(0.5)
        container.add(hpText)

        // ore mining click event
        oreSprite.on("pointerdown", () => {
            const pickaxeStats = getToolStats(this.player, "pickaxe")
            this.mineOre(ore, pickaxeStats.miningPower * this.player.oreClickMultiplier)
        })

        // ore health visual updates
        ore.updateHealth = () => {
            const percent = Phaser.Math.Clamp(ore.health / ore.maxHealth, 0, 1)
            hpBar.clear()
            hpBar.fillStyle(0x33ff33, 1)
            hpBar.fillRect(-100, hpBarY, 200 * percent, 20)
            hpText.setText(`${Math.round(ore.health)}/${ore.maxHealth}`)
        }

        // ore damage text
        ore.showDamage = (amount) => {
            const dmg = this.add.text(0, -oreSprite.displayHeight - 50, `-${Math.floor(amount)}`, {
                fontSize: "22px",
                color: "#ff0000",
                fontStyle: "bold"
            }).setOrigin(0.5)
            container.add(dmg)
            this.tweens.add({
                targets: dmg,
                y: dmg.y - 50,
                alpha: 0,
                duration: 800,
                ease: "Cubic.easeOut",
                onComplete: () => dmg.destroy()
            })
        }

        // ore damage handler
        ore.takeDamage = (amount) => {
            ore.health -= amount
            ore.health = Math.max(ore.health, 0)
            ore.showDamage(amount)
            ore.updateHealth()

            if (ore.health <= 0) {
                this.breakOre(ore)
            }
        }

        this.add.existing(container)
        return ore
    }

    mineOre(ore, damage) {
        ore.takeDamage(damage)
    }

    breakOre(ore) {
        addXP(this.player, "mining", ore.xpReward, this, this.miningXPBar.update.bind(this.miningXPBar), [], ORES)
        this.createOreIcons()

        const oreTypeKey = ore.sprite.texture.key.replace("Ore", "").toLowerCase()
        const dropQuantity = Phaser.Math.Between(3, 6)
        this.dropOre(ore.container.x, ore.container.y, oreTypeKey, dropQuantity)

        ore.container.destroy()

        const xpText = this.add.text(
            ore.container.x,
            ore.container.y - 100,
            `+${ore.xpReward} XP`,
            { fontSize: '18px', color: '#00ffcc', fontStyle: 'bold' }
        ).setOrigin(0.5)

        this.tweens.add({
            targets: xpText,
            y: xpText.y - 40,
            alpha: 0,
            duration: 1000,
            ease: "Cubic.easeOut",
            onComplete: () => xpText.destroy()
        })

        // respawn
        this.time.delayedCall(2000, () => {
            const nextOre = ORES.find(o => o.name === this.activeOreName)
            this.activeNode = this.spawnOreNode(nextOre)
        })

        // persist data
        this.saveProgress()
        this.createOreIcons()
    }
    // ore item logic after ore is broken
    dropOre(x, y, oreType, quantity = 1) {
        const textureMap = {
            copper: "copper_item",
            iron: "iron_item",
            gold: "gold_item",
        }
        for (let i = 0; i < quantity; i++) {
            const xOffset = Phaser.Math.Between(-25, 25)
            const yOffset = Phaser.Math.Between(-25, 25)

            const oreSprite = this.physics.add.sprite(
                x + xOffset,
                y + yOffset,
                textureMap[oreType]
            )
            oreSprite.oreType = oreType
            oreSprite.setBounce(0.5)
            oreSprite.setCollideWorldBounds(true)
            oreSprite.setVelocity(
                Phaser.Math.Between(-40, 40),
                Phaser.Math.Between(-25, -80)
            )
            this.ores.add(oreSprite)
            this.time.delayedCall(6000, () => {
                if (oreSprite.active) {
                    this.pickupOre(oreSprite)
                }
            })
        }
    }
    //picks ore up via cursor or automatically after time
    pickupOre(sprite) {
        if (!sprite.active) {
            return
        }
        const oreType = sprite.oreType
        if(!oreType) {
            return
        }
        sprite.destroy()

        const keyMap = {
            copper: "copperOre",
            iron: "ironOre",
            gold: "goldOre",
        }
        const itemKey = keyMap[oreType]
        const baseAmount = 1
        const totalAmount = Math.max(1, Math.floor(baseAmount* (this.player.oreMultiplier || 1)))
        this.player.inventory[itemKey] = (this.player.inventory[itemKey] ?? 0) + totalAmount
        updateInventoryUI(this)

        const pickupText = this.add.text(
            sprite.x,
            sprite.y - 20,
            `+${totalAmount} ${oreType} ore`,
            { fontSize: '18px', color: '#ffcc00', fontStyle: 'bold' }
        ).setOrigin(0.5)

        this.tweens.add({
            targets: pickupText,
            y: pickupText.y - 50,
            alpha: 0,
            duration: 900,
            ease: "Cubic.easeOut",
            onComplete: () => pickupText.destroy()
        })
       this.saveProgress()
    }
    saveProgress() {
        fetch(`${API_BASE}/saveProgress`, {
        method: "POST",
        headers: { "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
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
}
