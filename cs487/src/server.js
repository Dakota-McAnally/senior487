import express from "express";
import sqlite3 from "sqlite3";
import bcrypt from "bcrypt";
import cors from "cors";

const app = express();
app.use(cors()); //allow browser on :5173 to make requetst to :3001 (vite runs on 5173, node on 3001)
app.use(express.json());

const db = new sqlite3.Database("./gameDatabase.db");

db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    coins INTEGER DEFAULT 0,
    coinMultiplier REAL DEFAULT 1.15,
    dpsMultiplier REAL DEFAULT 1.15,
    clickMultiplier REAL DEFAULT 1.15,
    coinMultLevel INTEGER DEFAULT 0,
    dpsMultLevel INTEGER DEFAULT 0,
    clickMultLevel INTEGER DEFAULT 0,
    coinMultCost INTEGER DEFAULT 150,
    dpsMultCost INTEGER DEFAULT 100,
    clickMultCost INTEGER DEFAULT 60
)`);
//Signup
app.post("/signup", async (req, res) => {
    const { username, password } = req.body;
    const hash = await bcrypt.hash(password, 10);

    db.run(
        `INSERT INTO users (username, password_hash) VALUES (?, ?)`,
        [username, hash],
        function (err) {
            if (err)
                return res.status(400).json({ error: "Invalid username! Already taken."});
            else
                res.json({ success: true, userId: this.lastID });
        }
    );
});

//Login
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    db.get(`SELECT * FROM users WHERE username = ?`, [username], 
        async (err, row) => {
            if (!row) {
                return res.status(400).json({ error: "Invalid Username" });
            }
            const match = await bcrypt.compare(password, row.password_hash);
            if (!match) {
                return res.status(400).json({ error: "Invalid Password" });
            }
            res.json({ 
                success: true,
                username: row.username,
                coins: row.coins,
                coinMultiplier: row.coinMultiplier,
                dpsMultiplier: row.dpsMultiplier,
                clickMultiplier: row.clickMultiplier,
                coinMultLevel: row.coinMultLevel,
                dpsMultLevel: row.dpsMultLevel,
                clickMultLevel: row.clickMultLevel,
                coinMultCost: row.coinMultCost,
                dpsMultCost: row.dpsMultCost,
                clickMultCost: row.clickMultCost
            });
        }
    );
});

//save coins
app.post("/saveCoins", (req, res) => {
  const { username, coins } = req.body;

  db.run(`UPDATE users SET coins = ? WHERE username = ?`, [coins, username], function (err) {
    if (err) 
        return res.status(500).json({ error: "Failed to update coins" });
    res.json({ success: true });
  });
});
//save multipliers and mult levels
app.post("/saveProgress", (req, res) => {
    const { username, coinMultiplier, dpsMultiplier, clickMultiplier, coinMultLevel, dpsMultLevel, clickMultLevel, coinMultCost, dpsMultCost, clickMultCost } = req.body;
    db.run (
        `UPDATE users
        SET coinMultiplier = ?, dpsMultiplier = ?, clickMultiplier = ?, coinMultLevel = ?, dpsMultLevel = ?, clickMultLevel = ?, coinMultCost = ?, dpsMultCost = ?, clickMultCost = ?
        WHERE username = ?`,
        [coinMultiplier, dpsMultiplier, clickMultiplier, coinMultLevel, dpsMultLevel, clickMultLevel, coinMultCost, dpsMultCost, clickMultCost, username],
        function (err) {
            if (err) {
                console.error("Progress save error: ", err)
                return res.status(500).json({ error: "Failed to save user progress" });
            }
            res.json({ success: true });
        }
    );
});
    app.listen(3001, () => {
        console.log("Server running on port 3001")
    })



