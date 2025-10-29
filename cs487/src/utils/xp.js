import Phaser from 'phaser';
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001"

export function getXPForNextLevel(level) {
    return Math.floor(50 * Math.pow(level, 1.5))
}

export function addXP(player, skill, amount, scene, updateUI, monsters = [], ores = []) {
    const skillData = player.skills[skill]
    const prevLevel = skillData.level
    skillData.xp += amount

    while(skillData.xp >= getXPForNextLevel(skillData.level)) {
        skillData.xp -= getXPForNextLevel(skillData.level)
        skillData.level++
        console.log(`${skill} leveled up! Now level ${skillData.level}`)
    }
    let unlockedName = null
    //combat unlock notification
    const leveledUp = skillData.level > prevLevel
    if (leveledUp && scene && skill === "combat" && monsters.length > 0) {
      const unlockedName = getUnlockedMonsterName(skillData.level, monsters)
      if (unlockedName) {
        console.log(`Unlocked new monster: ${unlockedName}`)
        showUnlockNotification(scene, "Combat", unlockedName);
      }
    }
    //mining unlock notification
    if (leveledUp && scene && skill === "mining" && ores.length > 0) {
        const unlockedName = getUnlockedOreName(skillData.level, ores);
        if (unlockedName) {
            showUnlockNotification(scene, "Mining", unlockedName);
        }
    }
    if(updateUI) {
        updateUI(player)
    }
    fetch(`${API_BASE}/saveProgress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            username: player.username,
            coins: Math.floor(player.coins),
            stats: {
                coinMultLevel: player.upgrades.coinMultiplier.level,
                dpsMultLevel: player.upgrades.dpsMultiplier.level,
                clickMultLevel: player.upgrades.clickMultiplier.level,
                combatLevel: player.skills.combat.level,
                combatXP: player.skills.combat.xp,
                miningLevel: player.skills.mining.level,
                miningXP: player.skills.mining.xp
            }
        })
    }).catch(err => console.error("Failed to save coins: ", err))
    return { leveledUp, unlocked: unlockedName }
}

export function createXPBar(scene, skillName, color = 0x00ff00, y = 20) {
    const barWidth = 400
    const barHeight = 20
    const barX = scene.cameras.main.centerX - barWidth / 2

    const bg = scene.add.rectangle(barX, y, barWidth, barHeight, 0x555555).setOrigin(0, 0)
    const fill = scene.add.rectangle(barX, y, 0, barHeight, color).setOrigin(0, 0)
    const text = scene.add.text(scene.cameras.main.centerX, y - 5, '', {
        fontSize: "18px", color: "#ffffff"
    }).setOrigin(0.5, 1)

    return {
        update(player) {
            const skill = player.skills[skillName]
            const nextXP = getXPForNextLevel(skill.level)
            const progress = skill.xp / nextXP
            fill.width = barWidth * progress
            text.setText(`${skillName.charAt(0).toUpperCase() + skillName.slice(1)} Lv. ${skill.level} - ${skill.xp}/${nextXP} XP`)

        }
    }
}

export function showUnlockNotification(scene, skill, unlockedEntity) {
    const formattedName = unlockedEntity.charAt(0).toUpperCase() + unlockedEntity.slice(1)
    const bg = scene.add.rectangle(464, 396, 600, 200, 0x000000, 0.7)
    .setStrokeStyle(3, 0xffff00)
    .setDepth(999)
    .setOrigin(0.5)

    const text = scene.add.text(464, 396, `${skill} Level Up!`,
        { fontSize: '32px', color: '#ffff00', fontStyle: 'bold', align: 'center' })
        .setOrigin(0.5)
        .setDepth(1000)
    const subText = scene.add.text(464, 440, `New ${skill === "Combat" ? "Enemy" : "Resource"} Unlocked: ${formattedName}`,
    { fontSize: '20px', color: '#ffffff', align: 'center' })
    .setOrigin(0.5)
    .setDepth(1000)

    scene.tweens.add({
        targets: [bg, text, subText],
        alpha: { from: 0, to: 1 },
        duration: 400,
        yoyo: true,
        hold: 2000,
        ease: 'Sine.easeInOut',
        onComplete: () => {
            bg.destroy()
            text.destroy()
            subText.destroy()
        }
    })
}

export function getUnlockedMonsterName(level, monsters) {
    const unlocked = monsters.find(m=> m.unlockLevel === level)
    return unlocked ? unlocked.name : null
}
export function getUnlockedOreName(level, ores) {
    const unlocked = ores.find(o => o.unlockLevel === level)
    return unlocked ? unlocked.name : null
}

