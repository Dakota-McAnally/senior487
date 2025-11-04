// uiManager.js
export function showUI(sceneName) {
    const buttons = {
        inventory: document.getElementById("inventoryToggle"),
        mining: document.getElementById("miningButton"),
        smithing: document.getElementById("smithingButton"),
        combat: document.getElementById("combatButton"),
        shop: document.getElementById("upgradeMenuButton"),
    };

    // Hide all first
    Object.values(buttons).forEach(btn => btn && (btn.style.display = "none"));

    switch (sceneName) {
        case "scene-main":
            buttons.inventory.style.display = "block";
            buttons.mining.style.display = "block";
            buttons.smithing.style.display = "block";
            buttons.shop.style.display = "block";
            break;

        case "scene-mining":
            buttons.inventory.style.display = "block";
            buttons.combat.style.display = "block";
            buttons.smithing.style.display = "block";
            buttons.shop.style.display = "block";
            break;

        case "scene-smithing":
            buttons.inventory.style.display = "block";
            buttons.combat.style.display = "block";
            buttons.mining.style.display = "block";
            buttons.shop.style.display = "block";
            break;

        case "scene-shop":
            buttons.inventory.style.display = "block";
            buttons.combat.style.display = "none";
            buttons.mining.style.display = "none";
            buttons.smithing.style.display = "none";
            break;
    }
}

export function setupGlobalButtons(game) {
    const player = window.currentUser;

    const getActiveSceneKey = () => {
        // Find the scene that’s currently active
        const keys = Object.keys(game.scene.keys);
        for (const key of keys) {
            const sc = game.scene.keys[key];
            if (sc.scene && sc.scene.isActive()) return sc.scene.key;
        }
        return "scene-main";
    };

    const safeButton = (id, targetScene) => {
        const btn = document.getElementById(id);
        if (!btn) return console.warn(`Missing button: ${id}`);

        btn.onclick = () => {
            const inv = document.getElementById("inventoryUI");
            if (inv) inv.style.display = "none";

            const currentKey = getActiveSceneKey();
            if (currentKey === targetScene) return;

            const currentScene = game.scene.keys[currentKey];
            const player = window.currentUser;

            // Remember last scene for Shop return
            if (player) player.lastScene = currentKey;

            // Smooth fade-out transition
            if (currentScene && currentScene.cameras && currentScene.cameras.main) {
                currentScene.cameras.main.fadeOut(250, 0, 0, 0);
                currentScene.cameras.main.once('camerafadeoutcomplete', () => {
                    if (typeof currentScene.shutdown === "function") currentScene.shutdown();
                    currentScene.scene.stop();
                    game.scene.start(targetScene, { player });
                });
            } else {
                // fallback (no camera)
                if (typeof currentScene.shutdown === "function") currentScene.shutdown();
                currentScene.scene.stop();
                game.scene.start(targetScene, { player });
            }

        };
    };

    // Bind once for all scenes
    safeButton("combatButton", "scene-main");
    safeButton("miningButton", "scene-mining");
    safeButton("smithingButton", "scene-smithing");
    safeButton("upgradeMenuButton", "scene-shop");

    // Inventory toggle
    const invBtn = document.getElementById("inventoryToggle");
    if (invBtn) {
        invBtn.onclick = () => {
            const inv = document.getElementById("inventoryUI");
            if (inv) inv.style.display = inv.style.display === "none" ? "grid" : "none";
        };
    }

    // When any scene starts or wakes up, reapply button visibility
    game.events.on("scenestart", (scene) => {
        if (!scene || !scene.scene) return;
        scene.time.delayedCall(300, () => showUI(scene.scene.key))
    });

    game.events.on("sceneawaken", (scene) => {
        if (!scene || !scene.scene) return;
        showUI(scene.scene.key);
    });
}
