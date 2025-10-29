import Phaser from 'phaser'
import { addXP, createXPBar } from './utils/xp.js'
import { updateInventoryUI, getUpgradeCost, recomputeAllUpgradeCosts } from './main.js'

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001"

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
        nodeHealth: 250,
        xpReward: 6000,
        oreMultiplier: 1.85
    },
    {
        name: "gold",
        unlockLevel: 10,
        texture: "goldOre",
        nodeHealth: 450,
        xpReward: 120,
        oreMultiplier: 2.85
    }
]

export class MiningScene extends Phaser.Scene {
    constructor() {
        super("scene-mining")
        this.baseCosts = {
            oreMultiplier: 50,
            oreDpsMultiplier: 45,
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
        const miningBg = this.add.image(0, 0, "miningBackground").setOrigin(0, 0);
        miningBg.setDisplaySize(this.scale.width, this.scale.height);
        this.ores = this.physics.add.group()

        // Combat nav button 
        document.getElementById("miningButton").style.display = "none"
        const combatButton = document.getElementById("combatButton")
        if (combatButton) {
            combatButton.style.display = "block"
            combatButton.onclick = () => {
                this.scene.start("scene-game", { player: this.player })
            }
        }

        const upgradeMenuButton = document.getElementById("upgradeMenuButton")
        if (upgradeMenuButton) {
            upgradeMenuButton.style.display = "block"
            upgradeMenuButton.onclick = () => {
                this.player.lastScene = "scene-mining"
                document.getElementById("combatButton").style.display = "none"
                document.getElementById("miningButton").style.display = "none"
                this.player.lastScene = "scene-mining"
                this.scene.start("scene-shop", { player: this.player })
            }
        }

        // Mining node
        const currentOre = this.getCurrentOreType()
        this.activeNode = this.spawnOreNode(currentOre)

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

        // DPS system
        this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                if (this.activeNode && this.activeNode.health > 0) {
                    this.swingPickaxe()
                    this.activeNode.takeDamage(this.player.dps * this.player.oreDpsMultiplier)
                }
            }
        })
        this.miningXPBar.update(this.player)
    }
    update() {
        const pointer = this.input.activePointer
        this.ores.children.each(ore => {
            if (!ore.active) {
                return
            }
            const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, ore.x, ore.y)
            if (dist < 40) {
                this.pickupOre(ore, this.getCurrentOreType().name)
            }
        })
    }
    swingPickaxe() {
        if(this.isSwinging) {
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
    // generates the proper ore based on player mining level
    spawnOreNode(oreData) {
        const container = this.add.container(464, 600);

        // create ore sprite
        const oreSprite = this.add.image(0, 0, oreData.texture).setOrigin(0.5, 1);
        oreSprite.setScale(3);
        oreSprite.setInteractive();
        container.add(oreSprite);

        // ore stats
        const ore = {
            container,
            sprite: oreSprite,
            maxHealth: oreData.nodeHealth,
            health: oreData.nodeHealth,
            xpReward: oreData.xpReward,
            oreMultiplier: oreData.oreMultiplier,
            name: oreData.name
        };

        // hp bar bg
        const hpBarY = -oreSprite.displayHeight - 30;
        const hpBarBg = this.add.graphics();
        hpBarBg.fillStyle(0xff0000, 1);
        hpBarBg.fillRect(-100, hpBarY, 200, 20);
        container.add(hpBarBg);

        // fill ore hp bar 
        const hpBar = this.add.graphics();
        hpBar.fillStyle(0x33ff33, 1);
        hpBar.fillRect(-100, hpBarY, 200, 20);
        container.add(hpBar);

        // ore node HP text
        const hpText = this.add.text(0, hpBarY + 10, `${ore.health}/${ore.maxHealth}`, {
            fontSize: "16px",
            color: "#ffffff",
            fontStyle: "bold"
        }).setOrigin(0.5);
        container.add(hpText);

        // ore mining click event
        oreSprite.on("pointerdown", () => {
            this.mineOre(ore, this.player.dps * this.player.oreClickMultiplier);
        });

        // ore health visual updates
        ore.updateHealth = () => {
            const percent = Phaser.Math.Clamp(ore.health / ore.maxHealth, 0, 1);
            hpBar.clear();
            hpBar.fillStyle(0x33ff33, 1);
            hpBar.fillRect(-100, hpBarY, 200 * percent, 20);
            hpText.setText(`${Math.round(ore.health)}/${ore.maxHealth}`);
        };

        // ore damage text
        ore.showDamage = (amount) => {
            const dmg = this.add.text(0, -oreSprite.displayHeight - 50, `-${Math.floor(amount)}`, {
                fontSize: "22px",
                color: "#ff0000",
                fontStyle: "bold"
            }).setOrigin(0.5);
            container.add(dmg);
            this.tweens.add({
                targets: dmg,
                y: dmg.y - 50,
                alpha: 0,
                duration: 800,
                ease: "Cubic.easeOut",
                onComplete: () => dmg.destroy()
            });
        };

        // ore damage handler
        ore.takeDamage = (amount) => {
            ore.health -= amount;
            ore.health = Math.max(ore.health, 0);
            ore.showDamage(amount);
            ore.updateHealth();

            if (ore.health <= 0) {
                this.breakOre(ore);
            }
        };

        this.add.existing(container);
        return ore;
    }

    mineOre(ore, damage) {
        ore.takeDamage(damage)
    }

    breakOre(ore) {
        addXP(this.player, "mining", ore.xpReward, this, this.miningXPBar.update.bind(this.miningXPBar), [], ORES)

        const oreTypeKey = ore.sprite.texture.key.replace("Ore", "").toLowerCase()
        const dropQuantity = Phaser.Math.Between(1, 3)
        this.dropOre(ore.container.x, ore.container.y, oreTypeKey, dropQuantity)

        ore.container.destroy()

        const xpText = this.add.text(
            ore.container.x,
            ore.container.y - 100,
            `+${ore.xpReward} XP`,
            { fontSize: '18px', color: '#00ffcc', fontStyle: 'bold'}
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
            const nextOre = this.getCurrentOreType()
            this.activeNode = this.spawnOreNode(nextOre)
        })

        // persist data
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
                    woodcuttingLevel: this.player.skills.woodcutting?.level ?? 0,
                    logMultLevel: this.player.upgrades.logMultiplier?.level ?? 0,
                    logDpsMultLevel: this.player.upgrades.logDpsMultiplier?.level ?? 0,
                    logClickMultLevel: this.player.upgrades.logClickMultiplier?.level ?? 0
                },
                inventory: {
                    coins: this.player.inventory.coins ?? 0,
                    copperOre: this.player.inventory.copperOre ?? 0,
                    ironOre: this.player.inventory.ironOre ?? 0,
                    goldOre: this.player.inventory.goldOre ?? 0,
                    logs: this.player.inventory.logs ?? 0,
                    axe: this.player.inventory.axe ?? 0,
                    pickaxe: this.player.inventory.pickaxe ?? 0,
                    sword: this.player.inventory.sword ?? 0
                }
            })
        }).catch(err => console.error("Failed to save progress:", err));
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
            oreSprite.setBounce(0.5)
            oreSprite.setCollideWorldBounds(true)
            oreSprite.setVelocity(
                Phaser.Math.Between(-40, 40),
                Phaser.Math.Between(-25, -80)
            )
            this.ores.add(oreSprite)
            this.time.delayedCall(6000, () => {
                if (oreSprite.active) {
                    this.pickupOre(oreSprite, oreType)
                }
            })
        }
    }
    //picks ore up via cursor or automatically after time
    pickupOre(oreSprite, oreType) {
        if (!oreSprite.active) {
            return
        }
        oreSprite.destroy()

        const keyMap = {
            copper: "copperOre",
            iron: "ironOre",
            gold: "goldOre",
        }
        const itemKey = keyMap[oreType]
        this.player.inventory[itemKey] = (this.player.inventory[itemKey] ?? 0) + 1
        updateInventoryUI(this)

        const pickupText = this.add.text(
            oreSprite.x,
            oreSprite.y - 20,
            `+1 ${oreType} ore`,
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
                    woodcuttingLevel: this.player.skills.woodcutting?.level ?? 0,
                    logMultLevel: this.player.upgrades.logMultiplier?.level ?? 0,
                    logDpsMultLevel: this.player.upgrades.logDpsMultiplier?.level ?? 0,
                    logClickMultLevel: this.player.upgrades.logClickMultiplier?.level ?? 0
                },
                inventory: {
                    coins: this.player.inventory.coins ?? 0,
                    copperOre: this.player.inventory.copperOre ?? 0,
                    ironOre: this.player.inventory.ironOre ?? 0,
                    goldOre: this.player.inventory.goldOre ?? 0,
                    logs: this.player.inventory.logs ?? 0,
                    axe: this.player.inventory.axe ?? 0,
                    pickaxe: this.player.inventory.pickaxe ?? 0,
                    sword: this.player.inventory.sword ?? 0
                }
            })
        }).catch(err => console.error("Failed to save progress:", err));
    }
}
