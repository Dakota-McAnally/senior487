import express from "express";
import sqlite3 from "sqlite3";
import bcrypt from "bcrypt";
import cors from "cors";

const app = express();
app.use(cors()); //allow browser on :5173 to make requetst to :3001 (vite runs on 5173, node on 3001)
app.use(express.json());

const db = new sqlite3.Database("./gameDatabase.db");
//TODO: DATABASE SHOULDNT STORE COST AND MULTIPLIER --> ONLY STORE THE LEVEL PER USER
//TODO: Coins moved to items table (after items is created), since coins are used in crafting

//users table
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
)`);
//user_stats table
db.run(`CREATE TABLE IF NOT EXISTS user_stats (
    user_id INTEGER PRIMARY KEY,
    combatLevel INTEGER DEFAULT 1,
    combatXP INTEGER DEFAULT 0,
    coinMultLevel INTEGER DEFAULT 0,
    dpsMultLevel INTEGER DEFAULT 0,
    clickMultLevel INTEGER DEFAULT 0,
    miningLevel INTEGER DEFAULT 0,
    oreMultLevel INTEGER DEFAULT 0,
    oreDpsMultLevel INTEGER DEFAULT 0,
    oreClickMultLevel INTEGER DEFAULT 0,
    woodcuttingLevel INTEGER DEFAULT 0,
    logMultLevel INTEGER DEFAULT 0,
    logDpsMultLevel INTEGER DEFAULT 0,
    logClickMultLevel INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
)`);
//items table
db.run(`CREATE TABLE IF NOT EXISTS items (
    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT,
    description TEXT,
    tier INTEGER DEFAULT 1
)`);
//user_inventory table
db.run(`CREATE TABLE IF NOT EXISTS user_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    equipped BOOLEAN DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(item_id) REFERENCES items(item_id) ON DELETE CASCADE

)`);

const REQUIRED_ITEMS = ["Coin", "Logs", "Ore", "Axe", "Pickaxe", "Sword"];

function ensureBaseItemsExist() {
    REQUIRED_ITEMS.forEach((itemName) => {
        db.get(`SELECT item_id FROM items WHERE name = ?`, [itemName], (err, row) => {
            if (err) {
                console.error("Error checking item:", itemName, err);
                return;
            }
            if (!row) {
                db.run(`INSERT INTO items (name) VALUES (?)`, [itemName], (insertErr) => {
                    if (insertErr) {
                        console.error("Failed to insert missing item:", itemName, insertErr);
                    } else {
                        console.log(`Inserted missing item: ${itemName}`);
                    }
                });
            }
        });
    });
}
ensureBaseItemsExist();

//Signup
app.post("/signup", async (req, res) => {
    const { username, password } = req.body;
    const hash = await bcrypt.hash(password, 10);

    db.run(
        `INSERT INTO users (username, password_hash) VALUES (?, ?)`,
        [username, hash],
        function (err) {
            if (err)
                return res.status(400).json({ error: "Invalid username! Already taken." });

            const userId = this.lastID;

            db.run(`INSERT INTO user_stats (user_id) VALUES (?)`, [userId], (err2) => {
                if (err2)
                    console.error("Error creating default user stats: ", err2);
            });
            res.json({ success: true, userId });

        }
    );
});

//Login
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    db.get(`SELECT * FROM users WHERE username = ?`, [username],
        async (err, userRow) => {
            if (!userRow) {
                return res.status(400).json({ error: "Invalid Username" });
            }
            const match = await bcrypt.compare(password, userRow.password_hash);
            if (!match) {
                return res.status(400).json({ error: "Invalid Password" });
            }

            db.get(`SELECT * FROM user_stats WHERE user_id = ?`, [userRow.id], (err2, statsRow) => {
                if (err2 || !statsRow) {
                    console.error("User stats fetching error:", err2);
                    return res.status(500).json({ error: "Error loading stats" });
                }

                //get coins from user_inventory
                db.get(
                    `SELECT quantity FROM user_inventory WHERE user_id = ? AND item_id = (SELECT item_id FROM items WHERE name = 'Coin')`,
                    [userRow.id],
                    (err3, coinRow) => {
                        const coins = coinRow ? coinRow.quantity : 0;
                        res.json({
                            success: true,
                            username: userRow.username,
                            userId: userRow.id,
                            coins,
                            stats: {
                                combatLevel: statsRow.combatLevel,
                                combatXP: statsRow.combatXP,
                                coinMultLevel: statsRow.coinMultLevel,
                                dpsMultLevel: statsRow.dpsMultLevel,
                                clickMultLevel: statsRow.clickMultLevel,
                                miningLevel: statsRow.miningLevel,
                                oreMultLevel: statsRow.oreMultLevel,
                                oreDpsMultLevel: statsRow.oreDpsMultLevel,
                                oreClickMultLevel: statsRow.oreClickMultLevel,
                                woodcuttingLevel: statsRow.woodcuttingLevel,
                                logMultLevel: statsRow.logMultLevel,
                                logDpsMultLevel: statsRow.logDpsMultLevel,
                                logClickMultLevel: statsRow.logClickMultLevel
                            }
                        });
                    }
                );
            });
        }
    );
});

// //save coins
// app.post("/saveCoins", (req, res) => {
//   const { username, coins } = req.body;

//   db.run(`UPDATE users SET coins = ? WHERE username = ?`, [coins, username], function (err) {
//     if (err) 
//         return res.status(500).json({ error: "Failed to update coins" });
//     res.json({ success: true });
//   });
// });

//save stats + items 
app.post("/saveProgress", (req, res) => {
    const {
        username,
        stats,
        coins
    } = req.body;

    db.get(`SELECT id FROM users WHERE username = ?`, [username], (err, user) => {
        if (err || !user) return res.status(400).json({ error: "User not found" });

        const {
            combatLevel,
            combatXP,
            coinMultLevel,
            dpsMultLevel,
            clickMultLevel,
            miningLevel,
            oreMultLevel,
            oreDpsMultLevel,
            oreClickMultLevel,
            woodcuttingLevel,
            logMultLevel,
            logDpsMultLevel,
            logClickMultLevel,
        } = stats;

        //update user_stats
        db.run(
            `UPDATE user_stats
            SET combatLevel = ?, combatXP = ?, coinMultLevel = ?, dpsMultLevel = ?, clickMultLevel = ?,
            miningLevel = ?, oreMultLevel = ?, oreDpsMultLevel = ?, oreClickMultLevel = ?,
            woodcuttingLevel = ?, logMultLevel = ?, logDpsMultLevel = ?, logClickMultLevel = ?
            WHERE user_id = ?`,
            [
                combatLevel, combatXP, coinMultLevel, dpsMultLevel, clickMultLevel,
                miningLevel, oreMultLevel, oreDpsMultLevel, oreClickMultLevel,
                woodcuttingLevel, logMultLevel, logDpsMultLevel, logClickMultLevel,
                user.id
            ],
            function (err2) {
                if (err2) {
                    console.error("Progress save error:", err2);
                    return res.status(500).json({ error: "Failed to save user stats" });
                }

                //coins are in user_inventory instead of a player "stat", as the previous DB had them
                db.get(
                    `SELECT id, quantity FROM user_inventory
                    WHERE user_id = ? AND item_id = (
                    SELECT item_id FROM items WHERE name = 'Coin'
                    )`,
                    [user.id],
                    (err3, existingCoinRow) => {
                        if (err3) {
                            console.error("Coin lookup error:", err3);
                            return res.status(500).json({ error: "Coin lookup failed" });
                        }

                        //if coin item exists, update quantity
                        if (existingCoinRow) {
                            db.run(
                                `UPDATE user_inventory SET quantity = ? WHERE id = ?`,
                                [coins, existingCoinRow.id],
                                function (err4) {
                                    if (err4) {
                                        console.error("Coin update error:", err4);
                                        return res.status(500).json({ error: "Failed to update coins" });
                                    }
                                    res.json({ success: true });
                                }
                            );
                        }
                        //if no coin item exists, insert it
                        else {
                            db.get(
                                `SELECT item_id FROM items WHERE name = 'Coin'`,
                                [],
                                (err5, coinItem) => {
                                    if (err5 || !coinItem) {
                                        console.error("Coin item not found:", err5);
                                        return res.status(500).json({ error: "Coin item missing in items table" });
                                    }

                                    db.run(
                                        `INSERT INTO user_inventory (user_id, item_id, quantity) VALUES (?, ?, ?)`,
                                        [user.id, coinItem.item_id, coins],
                                        function (err6) {
                                            if (err6) {
                                                console.error("Coin insert error:", err6);
                                                return res.status(500).json({ error: "Failed to insert coin item" });
                                            }
                                            res.json({ success: true });
                                        }
                                    );
                                }
                            );
                        }
                    }
                );
            }
        );
    });
});

app.listen(3001, () => {
    console.log("Server running on port 3001")
})



