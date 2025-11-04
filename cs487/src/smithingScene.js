import Phaser from 'phaser';
import { createXPBar } from './utils/xp.js';
import { showUI, setupGlobalButtons } from './utils/uiManager.js';
import { updateInventoryUI, getUpgradeCost, recomputeAllUpgradeCosts } from './main.js'


export class SmithingScene extends Phaser.Scene {
  constructor() {
    super("scene-smithing");
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
    this.load.image("smithingBg", "/assets/smithing_bg.png");
  }

  create() {
    showUI(this.scene.key)

    // Background
    const smithingBg = this.add.image(0, 0, "smithingBg").setOrigin(0, 0);
    smithingBg.setDisplaySize(this.scale.width, this.scale.height);

    // Ensure smithing skill exists
    if (!this.player.skills.smithing) {
      this.player.skills.smithing = { level: 1, xp: 0 };
    }

    // XP bar (orange)
    this.smithingXPBar = createXPBar(this, "smithing", 0xffa500, 20);
    this.smithingXPBar.update(this.player);

    // Scene title
    this.add.text(464, 60, "Smithing Forge", {
      fontSize: "32px",
      color: "#ffffcc",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 3
    }).setOrigin(0.5);

    this.add.text(464, 100, "Coming soon...", {
      fontSize: "22px",
      color: "#cccccc"
    }).setOrigin(0.5);
    this.cameras.main.fadeIn(300, 0, 0, 0)
  }
}
