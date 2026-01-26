// server.js
const server = require('server');
const { get, post } = server.router;
const { render, json } = server.reply;
const path = require('path');
const fetch = require('node-fetch');

// ================== CONFIG ==================
const CONFIG = {
  // Pterodactyl
  PTERODACTYL_URL: 'https://nexus.arenahosting.top',
  PTERODACTYL_API_KEY: 'ptla_2i789jDkUPypUkx6cpf55Ayw4vCBm4P5Xylc9u59mPT',

  // JSONBin
  JSONBIN_API_KEY: '$2a$10$j9lzn5tqhuvLqZI8dYLwCesE/7r7eLZyms3h6b9U1RfPDsDeB21e2',
  JSONBIN_BIN_ID: '6977b2c0d0ea881f4087afef',
};

// ================== JSONBIN ==================
async function getUsers() {
  const res = await fetch(
    `https://api.jsonbin.io/v3/b/${CONFIG.JSONBIN_BIN_ID}`,
    {
      headers: { 'X-Master-Key': CONFIG.JSONBIN_API_KEY },
    }
  );
  const data = await res.json();
  return data.record.users || [];
}

async function saveUsers(users) {
  const res = await fetch(
    `https://api.jsonbin.io/v3/b/${CONFIG.JSONBIN_BIN_ID}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': CONFIG.JSONBIN_API_KEY,
      },
      body: JSON.stringify({ users }),
    }
  );
  return res.ok;
}

// ================== PTERODACTYL USER ==================
async function createPterodactylUser(username, password) {
  const payload = {
    email: `${username}@auto.local`,
    username: username,
    first_name: username,
    last_name: 'user',
    password: password,
    root_admin: false, // ❌ ليس أدمن
  };

  const res = await fetch(
    `${CONFIG.PTERODACTYL_URL}/api/application/users`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CONFIG.PTERODACTYL_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }

  return true;
}

// ================== ROUTES ==================
server(
  {
    security: { csrf: false }, // ✅ تعطيل CSRF (easy way)
  },

  // صفحات
  get('/', ctx => render(path.join(__dirname, 'public/home.html'))),
  get('/login', ctx => render(path.join(__dirname, 'public/login.html'))),
  get('/signup', ctx => render(path.join(__dirname, 'public/signup.html'))),

  // ================== SIGNUP ==================
  post('/signup', async ctx => {
    const { username, password } = ctx.data;

    if (!username || !password) {
      return json({ success: false, error: 'Missing data' });
    }

    const users = await getUsers();

    if (users.find(u => u.username === username)) {
      return json({ success: false, error: 'User already exists' });
    }

    // حفظ في JSONBin
    users.push({
      id: Date.now(),
      username,
      password,
      coins: 1000,
      createdAt: new Date().toISOString(),
    });

    const saved = await saveUsers(users);
    if (!saved) {
      return json({ success: false, error: 'JSONBin error' });
    }

    // إنشاء مستخدم في Pterodactyl
    try {
      await createPterodactylUser(username, password);
    } catch (err) {
      console.error('Pterodactyl Error:', err.message);
      return json({
        success: false,
        error: 'User saved but Pterodactyl failed',
      });
    }

    return json({ success: true });
  }),

  // ================== LOGIN ==================
  post('/login', async ctx => {
    const { username, password } = ctx.data;
    const users = await getUsers();

    const user = users.find(
      u => u.username === username && u.password === password
    );

    if (!user) {
      return json({ success: false, error: 'Invalid credentials' });
    }

    return json({
      success: true,
      username: user.username,
      coins: user.coins,
    });
  })
);