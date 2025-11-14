// ShopScene.js
import Phaser from "phaser";
import { showUI } from "./utils/uiManager.js";
import { updateInventoryUI, recomputeAllUpgradeCosts, getUpgradeCost } from "./main.js";

const API_BASE = import.meta.env.VITE_API_BASE || ""

// compact number format
function fmt(n) {
  if (n < 1000) return String(n);
  if (n < 1e6) return (n / 1e3).toFixed(1) + "k";
  if (n < 1e9) return (n / 1e6).toFixed(1) + "m";
  return (n / 1e9).toFixed(1) + "b";
}

// sell prices
const SELL_PRICES = { copperBar: 7, ironBar: 15, goldBar: 30 };

// ore requirement helpers for ore upgrades
const oreKeyForLevel = (lvl) => (lvl < 10 ? "copperOre" : (lvl < 20 ? "ironOre" : "goldOre"));
const oreLabelFromKey = (k) => (k === "copperOre" ? "Copper Ore" : k === "ironOre" ? "Iron Ore" : "Gold Ore");
const oreAmtForLevel  = (lvl) => Math.floor(5 + 1.5 * lvl);

export class ShopScene extends Phaser.Scene {
  constructor() {
    super("scene-shop");
    this.baseCosts = {
      coinMultiplier: 150,
      dpsMultiplier: 100,
      clickMultiplier: 60,
      oreMultiplier: 50,
      oreDpsMultiplier: 40,
      oreClickMultiplier: 25,
    };
    this.upgradeTexts = {};
    this.barCountTexts = {};
  }

  init(data) {
    this.player = data.player;
    recomputeAllUpgradeCosts(this.player, this.baseCosts);
    // ensure coins live in both places
    if (this.player.inventory) {
      this.player.coins = Number(this.player.inventory.coins ?? this.player.coins ?? 0);
      this.player.inventory.coins = this.player.coins;
    }
  }

  preload() {
    this.load.image("copper_bar", "/assets/copper_bar.png");
    this.load.image("iron_bar", "/assets/iron_bar.png");
    this.load.image("gold_bar", "/assets/gold_bar.png");
  }

  create() {
    showUI(this.scene.key);

    // background
    this.add.rectangle(0, 0, 928, 793, 0x222222).setOrigin(0, 0);
    this.add.text(464, 40, "Shop", { fontSize: "36px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);

    // scrollable content container
    this.shopContainer = this.add.container(0, 100);
    let currentY = 0;

    const addText = (x, y, text, style) => {
      const t = this.add.text(x, y, text, style);
      this.shopContainer.add(t);
      return t;
    };

    const addRect = (x, y, w, h, color, alpha = 1) => {
      const r = this.add.rectangle(x, y, w, h, color, alpha).setOrigin(0, 0);
      this.shopContainer.add(r);
      return r;
    };

    // upgrade cards
    const upgrades = [
      { key: "coinMultiplier", label: "Coin Multiplier", type: "coin" },
      { key: "dpsMultiplier", label: "DPS Multiplier", type: "coin" },
      { key: "clickMultiplier", label: "Click Multiplier", type: "coin" },
      { key: "oreMultiplier", label: "Ore Multiplier", type: "ore" },
      { key: "oreDpsMultiplier", label: "Ore DPS Multiplier", type: "ore" },
      { key: "oreClickMultiplier", label: "Ore Click Multiplier", type: "ore" },
    ];

    const sectionX = 70;

    upgrades.forEach((upg) => {
      const u = this.player.upgrades[upg.key];
      const level = u?.level ?? 0;

      addRect(sectionX, currentY + 10, 780, 70, 0x333333, 0.8).setStrokeStyle(2, 0xffffff);
      addText(sectionX + 15, currentY + 30, upg.label, {
        fontSize: "22px",
        color: "#ffff00",
        fontStyle: "bold",
      });

      // create the single-line Level/Cost text and store a ref
      const costText = addText(sectionX + 270, currentY + 35, "", {
        fontSize: "18px",
        color: "#ffffff",
      });
      this.upgradeTexts[upg.key] = costText;
      this.refreshUpgradeText(upg.key, upg.type);

      // Upgrade button
      const btn = this.add.rectangle(sectionX + 700, currentY + 45, 120, 40, 0xffff00)
        .setInteractive({ useHandCursor: true });
      const btnLbl = this.add.text(sectionX + 700, currentY + 45, "Upgrade", {
        fontSize: "18px",
        color: "#000",
        fontStyle: "bold",
      }).setOrigin(0.5);
      this.shopContainer.add(btn);
      this.shopContainer.add(btnLbl);

      const tooltip = this.add.text(0, 0, "", {
        fontSize: "16px",
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        color: "#ffffcc",
        padding: { x: 8, y: 4 },
        wordWrap: { width: 220 },
      }).setDepth(9999)
      .setVisible(false)

      const tooltipMessages = {
        coinMultiplier: "Increases coins earned from defeated enemies.",
        dpsMultiplier: "Increases automatic damage over time.",
        clickMultiplier: "Increase manual attack damage.",
        oreMultiplier: "Improves ore yield when breaking ores.",
        oreDpsMultiplier: "Increases automatic ore gathering speed.",
        oreClickMultiplier: "Increases manual ore gathering speed."
      }
        const message = tooltipMessages[upg.key]

        const adjustTooltipPosition = (pointer) => {
            const margin = 10;
            const tooltipWidth = tooltip.width;
            const tooltipHeight = tooltip.height;

            let x = pointer.x + 20;
            let y = pointer.y + 25;

            // Prevent going off the right edge
            if (x + tooltipWidth > this.scale.width - margin) {
                x = this.scale.width - tooltipWidth - margin;
            }

            // Prevent going off the left edge
            if (x < margin) x = margin;

            // Prevent going off the top edge
            if (y - tooltipHeight < margin) {
                y = pointer.y + tooltipHeight + 20; // flip to below the cursor
            }

            tooltip.setPosition(x, y);
        };

        btn.on("pointerover", (pointer) => {
            tooltip.setText(message);
            tooltip.setVisible(true);
            adjustTooltipPosition(pointer);
        });

        btn.on("pointermove", (pointer) => {
            if (tooltip.visible) {
                adjustTooltipPosition(pointer);
            }
        });
      btn.on("pointerout", () => {
        tooltip.setVisible(false)
      })

      btn.on("pointerdown", () => this.buyUpgrade(upg.key, upg.type));

      currentY += 90;
    });

    // Sell area of shop (scrolled to)
    addText(464, currentY + 10, "Sell Bars", {
      fontSize: "28px",
      color: "#ffffcc",
      fontStyle: "bold",
    }).setOrigin(0.5);
    currentY += 50;

    const barRows = [
      { key: "copperBar", label: "Copper Bar", icon: "copper_bar", price: SELL_PRICES.copperBar },
      { key: "ironBar",   label: "Iron Bar",   icon: "iron_bar",   price: SELL_PRICES.ironBar   },
      { key: "goldBar",   label: "Gold Bar",   icon: "gold_bar",   price: SELL_PRICES.goldBar   },
    ];

    barRows.forEach((bar, i) => {
      const y = currentY + i * 85;
      addRect(sectionX, y, 780, 70, 0x333333, 0.8).setStrokeStyle(2, 0xffffff);

      const icon = this.add.image(sectionX + 35, y + 35, bar.icon).setDisplaySize(40, 40);
      this.shopContainer.add(icon);

      const cntText = addText(
        sectionX + 80,
        y + 25,
        `${bar.label}: ${this.player.inventory?.[bar.key] ?? 0}  Worth ${bar.price} coins`,
        { fontSize: "20px", color: "#ffffff" }
      );
      this.barCountTexts[bar.key] = cntText;

      const sell1  = this.add.rectangle(sectionX + 550, y + 35, 100, 40, 0xffcc66).setInteractive({ useHandCursor: true });
      const sellAll = this.add.rectangle(sectionX + 700, y + 35, 100, 40, 0xffcc66).setInteractive({ useHandCursor: true });
      this.shopContainer.add(sell1);
      this.shopContainer.add(sellAll);

      this.shopContainer.add(this.add.text(sectionX + 550, y + 35, "Sell 1",  { fontSize: "18px", color: "#000", fontStyle: "bold" }).setOrigin(0.5));
      this.shopContainer.add(this.add.text(sectionX + 700, y + 35, "Sell All",{ fontSize: "18px", color: "#000", fontStyle: "bold" }).setOrigin(0.5));

      sell1.on("pointerdown",  () => this.sellBar(bar.key, 1, bar.price));
      sellAll.on("pointerdown", () => this.sellBar(bar.key, Infinity, bar.price));
    });

    currentY += barRows.length * 85 + 80;

    // Back (non-scrolling)
    this.add.text(20, 740, "Back", {
      fontSize: "24px",
      color: "#ffffff",
      backgroundColor: "#000",
      padding: { x: 15, y: 8 },
      fontStyle: "bold",
    })
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.leaveShop());

    // Scroll mask + wheel
    const maskHeight = 650;
    const maskShape = this.make.graphics();
    maskShape.fillRect(0, 100, 928, maskHeight);
    const mask = maskShape.createGeometryMask();
    this.shopContainer.setMask(mask);

    this.scrollY = 0;
    this.maxScroll = Math.max(0, currentY - maskHeight + 120);
    this.input.on("wheel", (_ptr, _go, _dx, dy) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY - dy * 0.5, -this.maxScroll, 0);
      this.shopContainer.y = 100 + this.scrollY;
    });
  }

  // Keep the same one-line format for all cards.
  refreshUpgradeText(key, type) {
    const ref = this.upgradeTexts[key];
    if (!ref) return;

    const upg = this.player.upgrades[key] || { level: 0, cost: getUpgradeCost(this.baseCosts[key], 1) };
    const lvl = upg.level ?? 0;
    const coinCost = upg.cost ?? getUpgradeCost(this.baseCosts[key], lvl + 1);

    if (type === "ore") {
      // show ore requirement compactly
      const oreKey = oreKeyForLevel(lvl);
      const oreAmt = oreAmtForLevel(lvl);
      ref.setText(`Lv ${lvl} | Cost: ${fmt(coinCost)} + ${oreAmt} ${oreLabelFromKey(oreKey)}`);
    } else {
      ref.setText(`Lv ${lvl} | Cost: ${fmt(coinCost)}`);
    }
  }

  coinsAvailable() {
    return Number(this.player?.inventory?.coins ?? this.player?.coins ?? 0);
  }
  setCoins(value) {
    const v = Math.max(0, Number(value) || 0);
    this.player.coins = v;
    if (this.player.inventory) this.player.inventory.coins = v;
  }

  toast(msg, color = "#ffff99") {
    const t = this.add.text(464, 720, msg, { fontSize: "20px", color, stroke: "#000", strokeThickness: 3 }).setOrigin(0.5);
    this.tweens.add({ targets: t, y: 690, alpha: 0, duration: 1800, ease: "Cubic.easeOut", onComplete: () => t.destroy() });
  }

  // sell functionality 
  sellBar(key, amount, pricePer) {
    const have = Number(this.player.inventory?.[key] ?? 0);
    if (have <= 0) {
      this.toast(`No ${key.replace("Bar", " bars")} to sell!`, "#ffcccc");
      return;
    }

    const sellCount = Math.min(have, amount);
    const total = sellCount * pricePer;

    this.player.inventory[key] = have - sellCount;
    this.setCoins(this.coinsAvailable() + total);

    // update labels + inventory panel
    if (this.barCountTexts[key]) {
      const label =
        key === "copperBar" ? "Copper Bar" :
        key === "ironBar"   ? "Iron Bar"   : "Gold Bar";
      const price = SELL_PRICES[key];
      this.barCountTexts[key].setText(`${label}: ${this.player.inventory[key]}  (Worth ${price} each)`);
    }

    updateInventoryUI(this);
    this.toast(`Sold ${sellCount} ${key.replace("Bar", " Bars")} for ${total} coins!`);
    this.saveProgess();
  }


  // buy and apply upgrades (calculated via level)
  buyUpgrade(upgradeType, type) {
    const upgrade = this.player.upgrades[upgradeType];
    const level   = upgrade.level ?? 0;
    const coinCost = upgrade.cost ?? getUpgradeCost(this.baseCosts[upgradeType], level + 1);

    // coins check users inventory coins as truth
    const coinsAvail = this.coinsAvailable();

    // ore-only requirements for ore upgrades
    let oreOK = true, oreKey = null, oreNeed = 0, haveOre = 0;
    if (type === "ore") {
      oreKey  = oreKeyForLevel(level);
      oreNeed = oreAmtForLevel(level);
      haveOre = Number(this.player.inventory?.[oreKey] ?? 0);
      oreOK   = haveOre >= oreNeed;
    }

    if (coinsAvail < coinCost || !oreOK) {
      const lacking = [];
      if (coinsAvail < coinCost) lacking.push(`${fmt(coinCost - coinsAvail)} more coins`);
      if (!oreOK) lacking.push(`${oreNeed - haveOre} ${oreLabelFromKey(oreKey)}`);
      this.toast(`You need: ${lacking.join(" and ")}!`, "#ffcccc");
      return;
    }

    // deduct costs (from inventory coins)
    this.setCoins(coinsAvail - coinCost);
    if (type === "ore") this.player.inventory[oreKey] = haveOre - oreNeed;

    // apply level & recompute next cost
    upgrade.level = level + 1;
    upgrade.cost  = getUpgradeCost(this.baseCosts[upgradeType], upgrade.level + 1);

    // recompute multipliers immediately
    const lvl = upgrade.level;
    switch (upgradeType) {
      case "coinMultiplier": this.player.coinMultiplier   = 1.00 + 0.12 * lvl; break;
      case "dpsMultiplier":  this.player.dpsMultiplier    = 1.00 + 0.12 * lvl; break;
      case "clickMultiplier":this.player.clickMultiplier  = 1.00 + 0.12 * lvl; break;
      case "oreMultiplier":  this.player.oreMultiplier    = 1.00 + 0.20 * lvl; break;
      case "oreDpsMultiplier": this.player.oreDpsMultiplier = 1.00 + 0.12 * lvl; break;
      case "oreClickMultiplier": this.player.oreClickMultiplier = 1.00 + 0.12 * lvl; break;
    }

    // refresh card text
    this.refreshUpgradeText(upgradeType, type);

    updateInventoryUI(this);
    this.toast("Upgrade purchased!");

    this.saveProgess();
  }

  leaveShop() {
    this.saveProgess();
    const lastScene = this.player.lastScene || "scene-main";
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.stop("scene-shop");
      this.scene.start(lastScene, { player: this.player });
      const next = this.scene.get(lastScene);
      if (next?.cameras?.main) next.cameras.main.fadeIn(300, 0, 0, 0);
    });
  }

  saveProgess() {
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
      }).catch(err => console.error("Failed to save progress:", err))
  }
}
