const express = require("express");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = 3000;

/* ===== JSON BIN CONFIG ===== */
const BIN_ID = "69751a9bae596e708ff2f2ca";
const API_KEY = "$2a$10$j9lzn5tqhuvLqZI8dYLwCesE/7r7eLZyms3h6b9U1RfPDsDeB21e2";
const BIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

/* ===== MIDDLEWARE ===== */
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());

/* ===== GET PROJECTS ===== */
app.get("/api/projects", async (req, res) => {
  try {
    const r = await fetch(BIN_URL, {
      headers: { "X-Master-Key": API_KEY }
    });
    const data = await r.json();
    res.json(data.record);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

/* ===== SAVE ALL PROJECTS ===== */
app.post("/api/projects/save", async (req, res) => {
  try {
    const projects = req.body;

    await fetch(BIN_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": API_KEY
      },
      body: JSON.stringify(projects)
    });

    res.json({ message: "Projects saved successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to save projects" });
  }
});

/* ===== START SERVER ===== */
app.listen(PORT, () => {
  console.log(`🔥 Server running on http://localhost:${PORT}`);
});