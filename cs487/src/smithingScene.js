import Phaser from 'phaser';
import { addXP, createXPBar } from './utils/xp.js';
import { showUI } from './utils/uiManager.js';
import { updateInventoryUI, recomputeAllUpgradeCosts } from './main.js';

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

// consant xp/bar conversion
const SMELT_RATE = 1; // 1 ore -> 1 bar
const SMELT_XP = { copper: 8, iron: 16, gold: 28 };      // per bar
const CRAFT_XP = { copper: 40, iron: 70, gold: 120 };    // per craft

// Tier --> material mapping
const TIER_TO_MAT = { 2: 'copper', 3: 'iron', 4: 'gold' };
const MAT_TO_BARKEY = { copper: 'copperBar', iron: 'ironBar', gold: 'goldBar' };
const MAT_TO_OREKEY = { copper: 'copperOre', iron: 'ironOre', gold: 'goldOre' };
// requirements for crafting/smelting ore/bars
const MAT_REQ_LEVEL = { copper: 1, iron: 5, gold: 10 };

// Bar costs for items
const CRAFT_COST = {
  sword: { copper: 100, iron: 300, gold: 500 },
  pickaxe: { copper: 100, iron: 300, gold: 500 },
};

// Inventory icons
function toolSprite(type, tier) {
  // type: "sword" | "pickaxe" ; tier: 1..4
  const base = tier <= 1 ? 'wooden' : TIER_TO_MAT[tier];
  return `${base}_${type}_inventory.png`;
}

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
    };
    this.activePanel = null; // only one panel (anvil/forge) can be open at once
  }

  init(data) {
    this.player = data.player;
    recomputeAllUpgradeCosts(this.player, this.baseCosts);
  }

  preload() {
    this.load.image("smithingBg", "/assets/smithing_bg.png");

    // Ore icons
    this.load.image("copper_ore", "/assets/copper_item.png");
    this.load.image("iron_ore", "/assets/iron_item.png");
    this.load.image("gold_ore", "/assets/gold_item.png");

    // Bar icons
    this.load.image("copper_bar", "/assets/copper_bar.png");
    this.load.image("iron_bar", "/assets/iron_bar.png");
    this.load.image("gold_bar", "/assets/gold_bar.png");

    // Tool inventory sprites
    this.load.image("wooden_sword_inventory", "/assets/wooden_sword_inventory.png");
    this.load.image("copper_sword_inventory", "/assets/copper_sword_inventory.png");
    this.load.image("iron_sword_inventory", "/assets/iron_sword_inventory.png");
    this.load.image("gold_sword_inventory", "/assets/gold_sword_inventory.png");

    this.load.image("wooden_pickaxe_inventory", "/assets/wooden_pickaxe_inventory.png");
    this.load.image("copper_pickaxe_inventory", "/assets/copper_pickaxe_inventory.png");
    this.load.image("iron_pickaxe_inventory", "/assets/iron_pickaxe_inventory.png");
    this.load.image("gold_pickaxe_inventory", "/assets/gold_pickaxe_inventory.png");
  }

  create() {
    showUI(this.scene.key);

    // Background
    const bg = this.add.image(0, 0, "smithingBg").setOrigin(0, 0);
    bg.setDisplaySize(this.scale.width, this.scale.height);

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

    // Click zones
    this.smeltZone = this.add.zone(200, 520, 260, 240)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.openSmeltingPanel());

    this.anvilZone = this.add.zone(464, 520, 220, 200)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.openAnvilPanel());

    // Hints
    this.makeHint(155, 520, "Smelt ores into bars");
    this.makeHint(464, 520, "Craft tools at the anvil");

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  // hints for what to interact with to smelt/craft
  makeHint(x, y, text) {
    const t = this.add.text(x, y, text, {
      fontSize: "16px",
      color: "#ffffcc",
      stroke: "#000",
      strokeThickness: 3
    }).setOrigin(0.5);
    this.tweens.add({
      targets: t,
      alpha: { from: 1, to: 0.45 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }
  disableSceneInteractive() {
    if (this.smeltZone) this.smeltZone.disableInteractive();
    if (this.anvilZone) this.anvilZone.disableInteractive();
  }

  enableSceneInteractive() {
    if (this.smeltZone) this.smeltZone.setInteractive({ useHandCursor: true });
    if (this.anvilZone) this.anvilZone.setInteractive({ useHandCursor: true });
  }
  makePanel(width = 860, height = 420) {
    if (this.activePanel) return null;

    // Disable furnace/anvil click zones
    this.disableSceneInteractive();

    const cx = 464, cy = 400;
    const container = this.add.container(0, 0).setDepth(1000);

    const bg = this.add.rectangle(cx, cy, width, height, 0x000000, 0.78)
      .setStrokeStyle(3, 0xffff99);
    container.add(bg);

    const close = this.add.text(cx + width / 2 - 18, cy - height / 2 + 15, "✕", {
      fontSize: "20px",
      color: "#ffffff"
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.closePanel());
    container.add(close);

    this.activePanel = container;
    container.setDepth(9999);
    return container;
  }

  closePanel() {
    if (!this.activePanel) return;
    // destroy everything in the container, then the container
    this.activePanel.removeAll(true);
    this.activePanel.destroy();
    this.activePanel = null;

    // re-enables furnace/anvil interactions
    this.enableSceneInteractive();
  }

  addButton(container, x, y, label, onClick, w = 180, h = 40, disabled = false) {
    const rect = this.add.rectangle(x, y, w, h, disabled ? 0x888888 : 0xffff66, disabled ? 0.6 : 0.9)
      .setStrokeStyle(2, 0x000000)
      .setOrigin(0.5);
    if (!disabled) {
      rect.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
    }
    const text = this.add.text(x, y, label, {
      fontSize: "18px",
      color: disabled ? "#222" : "#000",
      fontStyle: "bold"
    }).setOrigin(0.5);
    container.add(rect);
    container.add(text);
    return { rect, text };
  }

  addLabel(container, x, y, label, size = 18, color = "#ffffff", origin = 0.5) {
    const t = this.add.text(x, y, label, { fontSize: `${size}px`, color }).setOrigin(origin);
    container.add(t);
    return t;
  }

  addImage(container, x, y, key, scale = 1) {
    const img = this.add.image(x, y, key).setOrigin(0.5).setScale(scale);
    container.add(img);
    return img;
  }

  toast(msg, color = "#ffff99") {
    const t = this.add.text(464, 720, msg, {
      fontSize: "20px",
      color,
      stroke: "#000",
      strokeThickness: 3
    }).setOrigin(0.5);
    this.tweens.add({
      targets: t,
      y: 690,
      alpha: 0,
      duration: 1200,
      ease: "Cubic.easeOut",
      onComplete: () => t.destroy()
    });
  }

  // smelting interface
  openSmeltingPanel() {
    const panel = this.makePanel(880, 380);
    if (!panel) {
      this.toast("Close the current panel first.", "#ffcccc");
      return;
    }

    this.addLabel(panel, 464, 200, "Smelt Ores → Bars", 26, "#ffff99");

    const lvl = this.player.skills.smithing.level;

    // Build columns left to right for copper, iron, gold
    const cols = [
      { mat: 'copper', x: 250, oreIcon: 'copper_ore', barIcon: 'copper_bar' },
      { mat: 'iron', x: 464, oreIcon: 'iron_ore', barIcon: 'iron_bar' },
      { mat: 'gold', x: 678, oreIcon: 'gold_ore', barIcon: 'gold_bar' },
    ];
    cols.forEach(col => {
      const allowed = lvl >= MAT_REQ_LEVEL[col.mat];
      const oreKey = MAT_TO_OREKEY[col.mat];
      const barKey = MAT_TO_BARKEY[col.mat];

      // Header
      this.addLabel(panel, col.x, 260, col.mat.toUpperCase(), 20, "#ffffcc", 0.5);

      // Row container (keeps alignment perfect)
      const row = this.add.container(col.x, 300);
      panel.add(row);

      const addFixedText = (txt) =>
        this.add.text(0, 0, txt, {
          fontSize: "18px",
          color: "#ffffff",
          fontStyle: "bold",
          fontFamily: "monospace"  // prevents width changes
        }).setOrigin(0.5);

      if (!allowed) {
        const oreIcon = this.add.image(-80, 0, col.oreIcon).setScale(1.2);
        const oreAmt = addFixedText("?");
        oreAmt.x = -40;
        oreAmt.setColor("#777");

        const arrow = addFixedText("→");
        arrow.x = 0;
        arrow.setColor("#777");

        const barIcon = this.add.image(40, 0, col.barIcon).setScale(1.2).setTint(0x777777);
        const barAmt = addFixedText("?");
        barAmt.x = 80;
        barAmt.setColor("#777");

        row.add([oreIcon, oreAmt, arrow, barIcon, barAmt]);

        this.addButton(panel, col.x, 350, `Unlocks at Lv ${MAT_REQ_LEVEL[col.mat]}`, () => { }, 180, 42, true);
        return;
      }

      // Unlocked smelting row
      const oreAmount = this.player.inventory[oreKey] ?? 0;
      const barAmount = this.player.inventory[barKey] ?? 0;

      const oreIcon = this.add.image(-80, 0, col.oreIcon).setScale(1.2);
      const oreAmt = addFixedText(oreAmount);
      oreAmt.x = -40;

      const arrow = addFixedText("→");
      arrow.x = 0;

      const barIcon = this.add.image(40, 0, col.barIcon).setScale(1.2);
      const barAmt = addFixedText(barAmount);
      barAmt.x = 80;

      row.add([oreIcon, oreAmt, arrow, barIcon, barAmt]);

      this.addButton(panel, col.x, 350, "Smelt All", () => {
        if (oreAmount <= 0) {
          return this.toast(`No ${col.mat} ore to smelt.`, "#ffcccc");
        }
        this.smelt(oreKey, barKey, col.mat, oreAmount);
        oreAmt.setText(this.player.inventory[oreKey]);
        barAmt.setText(this.player.inventory[barKey]);
      }, 160, 42);
    });


  }

  smelt(oreKey, barKey, matName, amount) {
    const have = this.player.inventory[oreKey] ?? 0;
    const toSmelt = Math.min(have, amount);
    if (toSmelt <= 0) {
      this.toast(`Not enough ${matName} ore.`, "#ffcccc");
      return;
    }

    // Consume ore --> produce bars
    this.player.inventory[oreKey] = have - toSmelt;
    const barsMade = toSmelt * SMELT_RATE;
    this.player.inventory[barKey] = (this.player.inventory[barKey] ?? 0) + barsMade;

    // XP
    const xp = (SMELT_XP[matName] ?? 8) * barsMade;
    addXP(this.player, "smithing", xp, this, this.smithingXPBar.update.bind(this.smithingXPBar));
    this.smithingXPBar.update(this.player);

    updateInventoryUI(this);
    this.toast(`Smelted ${barsMade} ${matName} bar${barsMade !== 1 ? 's' : ''}!`);
    this.saveProgress();
  }

  // anvil panel
  openAnvilPanel() {
    const panel = this.makePanel(880, 470);
    if (!panel) {
      this.toast("Close the current panel first.", "#ffcccc");
      return;
    }

    this.addLabel(panel, 464, 200, "Anvil Crafting", 28, "#ffffaa");

    const barsText = this.addLabel(
      panel,
      464,
      235,
      `Bars — Copper: ${this.player.inventory.copperBar ?? 0} | Iron: ${this.player.inventory.ironBar ?? 0} | Gold: ${this.player.inventory.goldBar ?? 0}`,
      18,
      "#ffffff"
    );

    let baseY = 280;
    const blockGap = 180;

    const makeToolBlock = (typeLabel, typeKey) => {
      const currentTier = this.player.stats?.[`${typeKey}Tier`] ?? 1;

      // current icon (inventory sprite, not swinging sprite)
      const currentSpriteKey = toolSprite(typeKey, currentTier).replace('.png', '');
      this.addImage(panel, 250, baseY, currentSpriteKey, 1.3);

      this.addLabel(panel, 330, baseY, `${typeLabel} (Current: Tier ${currentTier})`, 22, "#ffffcc", 0);

      // determine next tier
      let targetTier = currentTier + 1;
      if (targetTier > 4) {
        this.addLabel(panel, 330, baseY + 40, "Max tier reached", 18, "#8fff8f", 0);
        baseY += blockGap;
        return;
      }

      const mat = TIER_TO_MAT[targetTier];
      const reqLevel = MAT_REQ_LEVEL[mat];
      const allowed = this.player.skills.smithing.level >= reqLevel;

      // Icons + button line
      const barIconKey = `${mat}_bar`;
      this.addImage(panel, 330, baseY + 45, barIconKey, 1.2);

      const cost = CRAFT_COST[typeKey][mat];
      const have = this.player.inventory[MAT_TO_BARKEY[mat]] ?? 0;

      if (!allowed) {
        this.addButton(panel, 520, baseY + 45, `Unlocks at Lv ${reqLevel}`, () => { }, 300, 42, true);
      } else {
        this.addButton(
          panel,
          520,
          baseY + 45,
          `Craft T${targetTier} (${cost})`,
          () => {
            const barKey = MAT_TO_BARKEY[mat];
            if ((this.player.inventory[barKey] ?? 0) < cost) {
              this.toast(`Not enough ${mat} bars.`, "#ffcccc");
              return;
            }
            // pay bars
            this.player.inventory[barKey] -= cost;

            // apply new tier (does not update combat swing sprite TODO maybe)
            if (!this.player.stats) this.player.stats = {};
            this.player.stats[`${typeKey}Tier`] = targetTier;

            // smithing XP for crafting
            const xpGain = CRAFT_XP[mat] ?? 40;
            addXP(
              this.player,
              "smithing",
              xpGain,
              this,
              this.smithingXPBar.update.bind(this.smithingXPBar)
            );
            this.smithingXPBar.update(this.player);

            // refresh top bars line
            barsText.setText(
              `Bars — Copper: ${this.player.inventory.copperBar ?? 0} | Iron: ${this.player.inventory.ironBar ?? 0} | Gold: ${this.player.inventory.goldBar ?? 0}`
            );

            // update inventory UI + toast
            updateInventoryUI(this);
            this.toast(`${typeLabel} upgraded to Tier ${targetTier}!`, "#ccffcc");

            // save
            this.saveProgress();
            const nextSpriteKey = toolSprite(typeKey, targetTier).replace('.png', '');
            this.closePanel();
            this.openAnvilPanel();
          },
          240,
          42,
          have < cost
        );
      }

      baseY += blockGap;
    };

    makeToolBlock("Sword", "sword");
    makeToolBlock("Pickaxe", "pickaxe");
  } 

  // database save function
  saveProgress() {
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
    }).catch(err => console.error("Failed to save progress:", err));
  }
}
