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
    miningLevel INTEGER DEFAULT 1,
    miningXP INTEGER DEFAULT 0,
    oreMultLevel INTEGER DEFAULT 0,
    oreDpsMultLevel INTEGER DEFAULT 0,
    oreClickMultLevel INTEGER DEFAULT 0,
    smithingLevel INTEGER DEFAULT 1,
    smithingXP INTEGER DEFAULT 0,
    swordTier INTEGER DEFAULT 1,
    pickaxeTier INTEGER DEFAULT 1,
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

const REQUIRED_ITEMS = ["Coin", "Copper Bar", "Iron Bar", "Gold Bar", "Copper Ore", "Iron Ore", "Gold Ore", "Pickaxe", "Sword"];

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
setTimeout(ensureBaseItemsExist, 200);

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

  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, userRow) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (!userRow) return res.status(400).json({ error: "Invalid Username" });

    const match = await bcrypt.compare(password, userRow.password_hash);
    if (!match) return res.status(400).json({ error: "Invalid Password" });

    db.get(`SELECT * FROM user_stats WHERE user_id = ?`, [userRow.id], (err2, stats) => {
      if (err2 || !stats) return res.status(500).json({ error: "Stats not found" });

      db.all(
        `SELECT i.name, ui.quantity FROM user_inventory ui
         JOIN items i ON i.item_id = ui.item_id
         WHERE ui.user_id = ?`,
        [userRow.id],
        (err3, rows) => {
          if (err3) return res.status(500).json({ error: "Failed to load inventory" });

          // Convert DB item names (e.g. "Copper Ore") -> camelCase (e.g. copperOre)
          const toCamel = (str) =>
            str.replace(/\s(.)/g, (m) => m.toUpperCase())
               .replace(/\s/g, "")
               .replace(/^./, (m) => m.toLowerCase());

          const inventory = {};
          rows.forEach(r => {
            inventory[toCamel(r.name)] = r.quantity;
          });

          res.json({
            success: true,
            username: userRow.username,
            userId: userRow.id,
            stats,
            inventory
          });
        }
      );
    });
  });
});


// SAVE PROGRESS 
app.post("/saveProgress", (req, res) => {
  const { username, stats, inventory } = req.body;

  db.get(`SELECT id FROM users WHERE username = ?`, [username], (err, user) => {
    if (err || !user) return res.status(400).json({ error: "User not found" });

    const {
      combatLevel, combatXP, coinMultLevel, dpsMultLevel, clickMultLevel,
      miningLevel, miningXP, oreMultLevel, oreDpsMultLevel, oreClickMultLevel,
      smithingLevel, smithingXP, swordTier, pickaxeTier
    } = stats;

    db.run(
      `UPDATE user_stats
       SET combatLevel=?, combatXP=?, coinMultLevel=?, dpsMultLevel=?, clickMultLevel=?,
           miningLevel=?, miningXP=?, oreMultLevel=?, oreDpsMultLevel=?, oreClickMultLevel=?,
           smithingLevel=?, smithingXP=?, swordTier=?, pickaxeTier=?
       WHERE user_id=?`,
      [
        combatLevel ?? 1, combatXP ?? 0, coinMultLevel ?? 0, dpsMultLevel ?? 0, clickMultLevel ?? 0,
        miningLevel ?? 1, miningXP ?? 0, oreMultLevel ?? 0, oreDpsMultLevel ?? 0, oreClickMultLevel ?? 0,
        smithingLevel ?? 1, smithingXP ?? 0, swordTier ?? 0, pickaxeTier ?? 0,
        user.id
      ],
      (err2) => {
        if (err2) {
          console.error("Stats update error:", err2);
          return res.status(500).json({ error: "Failed to update stats" });
        }

        // ITEM MAPPING (camelCase -> DB names)
        const itemMap = {
          coins: "Coin",
          copperOre: "Copper Ore",
          ironOre: "Iron Ore",
          goldOre: "Gold Ore",
          copperBar: "Copper Bar",
          ironBar: "Iron Bar",
          goldBar: "Gold Bar",
          pickaxe: "Pickaxe",
          sword: "Sword"
        };

        const items = Object.entries(inventory || {});
        const processItem = (index = 0) => {
          if (index >= items.length) return res.json({ success: true });

          const [key, quantity] = items[index];
          const dbName = itemMap[key];
          if (!dbName) {
            console.warn(`Skipping unmapped item: ${key}`);
            return processItem(index + 1);
          }

          db.get(`SELECT item_id FROM items WHERE name = ?`, [dbName], (err3, itemRow) => {
            if (err3 || !itemRow) {
              console.error(`Item lookup failed for ${dbName}:`, err3);
              return processItem(index + 1);
            }

            db.get(
              `SELECT id FROM user_inventory WHERE user_id=? AND item_id=?`,
              [user.id, itemRow.item_id],
              (err4, invRow) => {
                if (err4) {
                  console.error(`Inventory lookup failed for ${dbName}:`, err4);
                  return processItem(index + 1);
                }

                if (invRow) {
                  db.run(
                    `UPDATE user_inventory SET quantity=? WHERE id=?`,
                    [quantity, invRow.id],
                    (err5) => {
                      if (err5) console.error(`Failed to update ${dbName}:`, err5);
                      processItem(index + 1);
                    }
                  );
                } else {
                  db.run(
                    `INSERT INTO user_inventory (user_id, item_id, quantity) VALUES (?, ?, ?)`,
                    [user.id, itemRow.item_id, quantity],
                    (err6) => {
                      if (err6) console.error(`Failed to insert ${dbName}:`, err6);
                      processItem(index + 1);
                    }
                  );
                }
              }
            );
          });
        };
        processItem();
      }
    );
  });
});

app.listen(3001, () => {
    console.log("Server running on port 3001")
})


