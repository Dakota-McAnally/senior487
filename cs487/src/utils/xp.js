import Phaser from 'phaser';

export function getXPForNextLevel(level) {
    return Math.floor(50 * Math.pow(level, 1.5))
}

export function addXP(player, skill, amount, updateUI) {
    const skillData = player.skills[skill]
    skillData.xp += amount

    while(skillData.xp >= getXPForNextLevel(skillData.level)) {
        skillData.xp -= getXPForNextLevel(skillData.level)
        skillData.level++
        console.log(`${skill} leveled up! Now level ${skillData.level}`)
    }
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

