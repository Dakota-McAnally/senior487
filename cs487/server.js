import express from "express";
import bcrypt from "bcrypt";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";
import path from "path";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";


dotenv.config();

const { Pool } = pkg;

const app = express();
app.use(cors()); //allow browser on :5173 to make requetst to :3001 (vite runs on 5173, node on 3001)
app.use(express.json());

// Postgres connection (local + Render support)
const isRender = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL,

  ssl: isRender ? { rejectUnauthorized: false } : false,
});

// Helper for DB queries
async function dbQuery(text, params) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error("DB ERROR:", err);
    throw err;
  }
}

//TODO: DATABASE SHOULDNT STORE COST AND MULTIPLIER --> ONLY STORE THE LEVEL PER USER
//TODO: Coins moved to items table (after items is created), since coins are used in crafting

// ------------------------
// TABLE CREATION (same schema as SQLite, adapted to Postgres)
// ------------------------
async function initDatabase() {
  // users table
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );
  `);

  // user_stats table
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
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
      pickaxeTier INTEGER DEFAULT 1
    );
  `);

  // items table
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS items (
      item_id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      description TEXT,
      tier INTEGER DEFAULT 1
    );
  `);

  // user_inventory table
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS user_inventory (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
      quantity INTEGER DEFAULT 1,
      equipped BOOLEAN DEFAULT FALSE
    );
  `);

  console.log("Postgres tables initialized");
  await ensureBaseItemsExist();
}
// BASE ITEMS
const REQUIRED_ITEMS = [
  "Coins",
  "Copper Bar",
  "Iron Bar",
  "Gold Bar",
  "Copper Ore",
  "Iron Ore",
  "Gold Ore",
  "Pickaxe",
  "Sword",
];

async function ensureBaseItemsExist() {
  for (const itemName of REQUIRED_ITEMS) {
    try {
      const existing = await dbQuery(
        `SELECT item_id FROM items WHERE name = $1`,
        [itemName]
      );
      if (existing.rows.length === 0) {
        await dbQuery(`INSERT INTO items (name) VALUES ($1)`, [itemName]);
        console.log(`Inserted missing item: ${itemName}`);
      }
    } catch (err) {
      console.error("Error ensuring base item:", itemName, err);
    }
  }
}
function mapStats(row) {
  return {
    combatLevel: row.combatlevel,
    combatXP: row.combatxp,
    coinMultLevel: row.coinmultlevel,
    dpsMultLevel: row.dpsmultlevel,
    clickMultLevel: row.clickmultlevel,
    miningLevel: row.mininglevel,
    miningXP: row.miningxp,
    oreMultLevel: row.oremultlevel,
    oreDpsMultLevel: row.oredpsmultlevel,
    oreClickMultLevel: row.oreclickmultlevel,
    smithingLevel: row.smithinglevel,
    smithingXP: row.smithingxp,
    swordTier: row.swordtier,
    pickaxeTier: row.pickaxetier
  };
}
function clamp(num, min, max) {
  num = Number(num);
  if (isNaN(num)){
    return min;
  } 
  return Math.max(min, Math.min(max, num));
}

// SIGNUP
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;

  try {
    const hash = await bcrypt.hash(password, 10);

    const userInsert = await dbQuery(
      `INSERT INTO users (username, password_hash)
       VALUES ($1, $2)
       RETURNING id`,
      [username, hash]
    );

    const userId = userInsert.rows[0].id;

    // Create default stats row
    await dbQuery(`INSERT INTO user_stats (user_id) VALUES ($1)`, [userId]);

    // Give user inventory rows for all existing items, quantity 0
    const itemsRes = await dbQuery(`SELECT item_id, name FROM items`);
    const items = itemsRes.rows;

    for (const item of items) {
      try {
        await dbQuery(
          `INSERT INTO user_inventory (user_id, item_id, quantity)
           VALUES ($1, $2, 0)`,
          [userId, item.item_id]
        );
      } catch (err) {
        console.error(
          "Failed to insert base inventory row:",
          item.name,
          err
        );
      }
    }

    res.json({ success: true, userId });
  } catch (err) {
    // Unique violation
    if (err.code === "23505") {
      return res
        .status(400)
        .json({ error: "Invalid username! Already taken." });
    }
    console.error("Signup error:", err);
    res.status(500).json({ error: "Server error during signup" });
  }
});

// LOGIN
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const userRes = await dbQuery(
      `SELECT * FROM users WHERE username = $1`,
      [username]
    );

    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: "Invalid Username" });
    }

    const userRow = userRes.rows[0];

    const match = await bcrypt.compare(password, userRow.password_hash);
    if (!match) {
      return res.status(400).json({ error: "Invalid Password" });
    }

    const statsRes = await dbQuery(
      `SELECT * FROM user_stats WHERE user_id = $1`,
      [userRow.id]
    );

    if (statsRes.rows.length === 0) {
      return res.status(500).json({ error: "Stats not found" });
    }

    const stats = statsRes.rows[0];
    const statsCamelCase = mapStats(stats)

    const invRes = await dbQuery(
      `SELECT i.name, ui.quantity
       FROM user_inventory ui
       JOIN items i ON i.item_id = ui.item_id
       WHERE ui.user_id = $1`,
      [userRow.id]
    );

    // Convert DB item names (e.g. "Copper Ore") -> camelCase (e.g. copperOre)
    const toCamel = (str) =>
      str
        .replace(/\s(.)/g, (m) => m.toUpperCase())
        .replace(/\s/g, "")
        .replace(/^./, (m) => m.toLowerCase());

    const inventory = {};
    invRes.rows.forEach((r) => {
      inventory[toCamel(r.name)] = r.quantity;
    });
    const token = jwt.sign(
      { id: userRow.id, username: userRow.username },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    )
    res.json({
      success: true,
      token,
      username: userRow.username,
      userId: userRow.id,
      stats: statsCamelCase,
      inventory,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ error: "Missing token" });
  }
  const token = header.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
}

// SAVE PROGRESS
app.post("/saveProgress", requireAuth, async (req, res) => {
  console.log("SAVE RECEIVED:", JSON.stringify(req.body, null, 2))
  const userId = req.user.id;
  const { stats, inventory } = req.body;

  const safeStats = {
    combatLevel: clamp(stats.combatLevel, 1, 99),
    combatXP: clamp(stats.combatXP, 0, 999999999),
    coinMultLevel: clamp(stats.coinMultLevel, 0, 50),
    dpsMultLevel: clamp(stats.dpsMultLevel, 0, 50),
    clickMultLevel: clamp(stats.clickMultLevel, 0, 50),
    miningLevel: clamp(stats.miningLevel, 1, 99),
    miningXP: clamp(stats.miningXP, 0, 999999999),
    oreMultLevel: clamp(stats.oreMultLevel, 0, 50),
    oreDpsMultLevel: clamp(stats.oreDpsMultLevel, 0, 50),
    oreClickMultLevel: clamp(stats.oreClickMultLevel, 0, 50),
    smithingLevel: clamp(stats.smithingLevel, 1, 99),
    smithingXP: clamp(stats.smithingXP, 0, 999999999),

    // prevent tiers going above the current limit (game crashes otherwise)
    swordTier: clamp(stats.swordTier, 1, 5),
    pickaxeTier: clamp(stats.pickaxeTier, 1, 5),
  };
  // Overwrite stats with safe values
  stats.combatLevel = safeStats.combatLevel;
  stats.combatXP = safeStats.combatXP;
  stats.coinMultLevel = safeStats.coinMultLevel;
  stats.dpsMultLevel = safeStats.dpsMultLevel;
  stats.clickMultLevel = safeStats.clickMultLevel;
  stats.miningLevel = safeStats.miningLevel;
  stats.miningXP = safeStats.miningXP;
  stats.oreMultLevel = safeStats.oreMultLevel;
  stats.oreDpsMultLevel = safeStats.oreDpsMultLevel;
  stats.oreClickMultLevel = safeStats.oreClickMultLevel;
  stats.smithingLevel = safeStats.smithingLevel;
  stats.smithingXP = safeStats.smithingXP;
  stats.swordTier = safeStats.swordTier;
  stats.pickaxeTier = safeStats.pickaxeTier;

  try {
    const {
      combatLevel,
      combatXP,
      coinMultLevel,
      dpsMultLevel,
      clickMultLevel,
      miningLevel,
      miningXP,
      oreMultLevel,
      oreDpsMultLevel,
      oreClickMultLevel,
      smithingLevel,
      smithingXP,
      swordTier,
      pickaxeTier,
    } = stats;

    await dbQuery(
      `UPDATE user_stats
   SET combatlevel = $1,
       combatxp = $2,
       coinmultlevel = $3,
       dpsmultlevel = $4,
       clickmultlevel = $5,
       mininglevel = $6,
       miningxp = $7,
       oremultlevel = $8,
       oredpsmultlevel = $9,
       oreclickmultlevel = $10,
       smithinglevel = $11,
       smithingxp = $12,
       swordtier = $13,
       pickaxetier = $14
   WHERE user_id = $15`,
      [
        combatLevel ?? 1,
        combatXP ?? 0,
        coinMultLevel ?? 0,
        dpsMultLevel ?? 0,
        clickMultLevel ?? 0,
        miningLevel ?? 1,
        miningXP ?? 0,
        oreMultLevel ?? 0,
        oreDpsMultLevel ?? 0,
        oreClickMultLevel ?? 0,
        smithingLevel ?? 1,
        smithingXP ?? 0,
        swordTier ?? 1,
        pickaxeTier ?? 1,
        userId,
      ]
    );

    // ITEM MAPPING (camelCase -> DB names)
    const itemMap = {
      coins: "Coins",
      copperOre: "Copper Ore",
      ironOre: "Iron Ore",
      goldOre: "Gold Ore",
      copperBar: "Copper Bar",
      ironBar: "Iron Bar",
      goldBar: "Gold Bar",
      pickaxe: "Pickaxe",
      sword: "Sword",
    };
    for (const key in inventory) {
      inventory[key] = clamp(inventory[key], 0, 999999999);
    }
    const entries = Object.entries(inventory || {});

    for (const [key, quantity] of entries) {
      const dbName = itemMap[key];
      if (!dbName) {
        console.warn(`Skipping unmapped item: ${key}`);
        continue;
      }

      try {
        const itemRes = await dbQuery(
          `SELECT item_id FROM items WHERE name = $1`,
          [dbName]
        );

        if (itemRes.rows.length === 0) {
          console.error(`Item lookup failed for ${dbName}: not found`);
          continue;
        }

        const itemId = itemRes.rows[0].item_id;

        const invRes = await dbQuery(
          `SELECT id FROM user_inventory WHERE user_id = $1 AND item_id = $2`,
          [userId, itemId]
        );

        if (invRes.rows.length > 0) {
          // Update
          await dbQuery(
            `UPDATE user_inventory SET quantity = $1 WHERE id = $2`,
            [quantity, invRes.rows[0].id]
          );
        } else {
          // Insert
          await dbQuery(
            `INSERT INTO user_inventory (user_id, item_id, quantity)
             VALUES ($1, $2, $3)`,
            [userId, itemId, quantity]
          );
        }
      } catch (err) {
        console.error(`Failed to upsert inventory for ${dbName}:`, err);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("saveProgress error:", err);
    res.status(500).json({ error: "Failed to save progress" });
  }
});
// START SERVER AFTER DB INIT
const PORT = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist/index.html"));
})

initDatabase()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });

