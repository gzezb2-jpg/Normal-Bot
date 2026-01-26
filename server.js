// server.js
const server = require('server');
const { get, post } = server.router;
const { render, json, status } = server.reply;
const path = require('path');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');

// ===== CONFIG =====
const CONFIG = {
  // Pterodactyl
  PTERODACTYL_URL: 'https://nexus.arenahosting.top/', // رابط لوحة تحكمك
  PTERODACTYL_API_KEY: 'ptla_2i789jDkUPypUkx6cpf55Ayw4vCBm4P5Xylc9u59mPT',

  // JSONBin
  JSONBIN_API_KEY: '$2a$10$j9lzn5tqhuvLqZI8dYLwCesE/7r7eLZyms3h6b9U1RfPDsDeB21e2',
  JSONBIN_BIN_ID: '6977b2c0d0ea881f4087afef',
};

// ===== Helpers =====
async function fetchUsersFromJsonBin() {
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.JSONBIN_BIN_ID}`, {
      headers: { 'X-Master-Key': CONFIG.JSONBIN_API_KEY }
    });
    if (!res.ok) throw new Error('Failed to fetch users');
    const data = await res.json();
    return data.record?.users || [];
  } catch (err) {
    console.error('❌ JSONBin Fetch Error:', err.message);
    return [];
  }
}

async function saveUsersToJsonBin(users) {
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': CONFIG.JSONBIN_API_KEY,
        'X-Bin-Private': 'false'
      },
      body: JSON.stringify({ users })
    });
    return res.ok;
  } catch (err) {
    console.error('❌ JSONBin Save Error:', err.message);
    return false;
  }
}

// ===== Create User in Pterodactyl =====
async function createPterodactylUser(username, password, email) {
  try {
    const payload = {
      username: username,
      first_name: username,
      last_name: 'User',
      email: email,
      password: password,
      root_admin: false,
      language: "en"
    };

    const res = await fetch(`${CONFIG.PTERODACTYL_URL}/api/application/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.PTERODACTYL_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn(`⚠️ User created in JSONBin but failed in Pterodactyl: ${text}`);
      return false;
    }

    console.log(`✅ User ${username} created in Pterodactyl`);
    return true;
  } catch (err) {
    console.error('❌ Pterodactyl User Creation Error:', err.message);
    return false;
  }
}

// ===== SERVER =====
server(
  bodyParser.json(), // parse JSON POST requests

  // ===== ROUTES =====
  get('/', ctx => render(path.join(__dirname, 'public', 'home.html'))),
  get('/plans', ctx => render(path.join(__dirname, 'public', 'plans.html'))),
  get('/signup', ctx => render(path.join(__dirname, 'public', 'signup.html'))),
  get('/login', ctx => render(path.join(__dirname, 'public', 'login.html'))),

  get('/api/coins', ctx => json({ coins: 2500 })),

  // ===== SIGNUP =====
  post('/signup', async ctx => {
    try {
      const { username, password, email } = ctx.data;

      if (!username || !password || username.length < 3 || !email) {
        return json({ success: false, error: 'Username, password and email are required' });
      }

      // Fetch current users
      let users = await fetchUsersFromJsonBin();

      if (users.some(u => u.username === username)) {
        return json({ success: false, error: 'Username already exists' });
      }

      // Save user to JSONBin
      const newUser = {
        id: Date.now(),
        username,
        password, // ⚠️ استخدم bcrypt لاحقًا
        email,
        coins: 1000,
        createdAt: new Date().toISOString()
      };
      users.push(newUser);
      const saved = await saveUsersToJsonBin(users);
      if (!saved) return json({ success: false, error: 'Failed to save user data' });

      // Create user in Pterodactyl
      const created = await createPterodactylUser(username, password, email);
      if (!created) {
        return json({ success: true, warning: 'User saved in JSONBin but failed to create in Pterodactyl' });
      }

      return json({ success: true });

    } catch (err) {
      console.error('Signup Error:', err.message);
      return status(500).send(err.message);
    }
  }),

  // ===== LOGIN =====
  post('/login', async ctx => {
    try {
      const { username, password } = ctx.data;
      const users = await fetchUsersFromJsonBin();
      const user = users.find(u => u.username === username && u.password === password);
      if (user) return json({ success: true, username });
      return json({ success: false, error: 'Invalid credentials' });
    } catch (err) {
      console.error('Login Error:', err.message);
      return status(500).send(err.message);
    }
  }),

  // ===== GLOBAL ERROR HANDLER =====
  server.router.error(ctx => {
    console.error('Unhandled Error:', ctx.error);
    return status(500).send('Internal Server Error');
  })
);