const server = require('server');
const { get, post } = server.router;
const { render, json } = server.reply;
const path = require('path');
const fetch = require('node-fetch');

// ================== CONFIG ==================
const CONFIG = {
  PTERODACTYL_URL: 'https://nexus.arenahosting.top',
  PTERODACTYL_API_KEY: 'ptla_2i789jDkUPypUkx6cpf55Ayw4vCBm4P5Xylc9u59mPT',

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

// ================== PTERODACTYL ==================
async function createPterodactylUser(username, password) {
  const payload = {
    email: `${username}@belvohost.com`,
    username,
    first_name: username,
    last_name: 'User',
    password: password.length < 8 ? password + 'A1!' : password,
    root_admin: false
  };

  const res = await fetch(
    `${CONFIG.PTERODACTYL_URL}/api/application/users`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CONFIG.PTERODACTYL_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );

  const text = await res.text();

  if (!res.ok) {
    console.error('🔥 Pterodactyl ERROR:', text);
    throw new Error(text);
  }

  return true;
}

// ================== SERVER ==================
server(
  { security: { csrf: false } },

  // favicon (مهم)
  get('/favicon.ico', ctx => json({})),

  // صفحات
  get('/', ctx => render(path.join(__dirname, 'public/home.html'))),
  get('/login', ctx => render(path.join(__dirname, 'public/login.html'))),
  get('/signup', ctx => render(path.join(__dirname, 'public/signup.html'))),

  // coins API ✅
  get('/api/coins', async ctx => {
    try {
      const username = ctx.query.username;
      if (!username) return json({ coins: 0 });

      const users = await getUsers();
      const user = users.find(u => u.username === username);

      return json({ coins: user ? user.coins : 0 });
    } catch (err) {
      console.error(err);
      return json({ coins: 0 });
    }
  }),

  // signup
  post('/signup', async ctx => {
    const { username, password } = ctx.data;
    if (!username || !password)
      return json({ success: false });

    const users = await getUsers();
    if (users.find(u => u.username === username))
      return json({ success: false });

    users.push({
      id: Date.now(),
      username,
      password,
      coins: 1000
    });

    await saveUsers(users);
    await createPterodactylUser(username, password);

    return json({ success: true });
  }),

  // login
  post('/login', async ctx => {
    const { username, password } = ctx.data;
    const users = await getUsers();

    const user = users.find(
      u => u.username === username && u.password === password
    );

    if (!user) return json({ success: false });

    return json({ success: true, coins: user.coins });
  }),

  // catch-all (إجباري)
  ctx => json({ error: 'Route not found', path: ctx.url })
);