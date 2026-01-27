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
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.JSONBIN_BIN_ID}`, {
      headers: { 'X-Master-Key': CONFIG.JSONBIN_API_KEY },
    });
    const data = await res.json();
    return data.record?.users || [];
  } catch (err) {
    console.error('Error fetching users from JSONBin:', err);
    return [];
  }
}

async function saveUsers(users) {
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': CONFIG.JSONBIN_API_KEY,
      },
      body: JSON.stringify({ users }),
    });
    return res.ok;
  } catch (err) {
    console.error('Error saving users to JSONBin:', err);
    return false;
  }
}

// ===== ADMIN ROUTES =====
get('/api/admin/users', async ctx => {
  const users = await getUsers();
  return json({ users });
});

post('/api/admin/update-coins', async ctx => {
  const { id, coins } = ctx.data;
  let users = await getUsers();
  const index = users.findIndex(u => u.id == id);
  if (index === -1) return json({ success: false, error: 'User not found' });

  users[index].coins = coins;
  const saved = await saveUsers(users);
  return json({ success: saved });
});

post('/api/admin/update-password', async ctx => {
  const { id, password } = ctx.data;
  let users = await getUsers();
  const index = users.findIndex(u => u.id == id);
  if (index === -1) return json({ success: false, error: 'User not found' });

  users[index].password = password; // ⚠️ بدون تشفير
  const saved = await saveUsers(users);
  return json({ success: saved });
});

post('/api/admin/delete-user', async ctx => {
  const { id } = ctx.data;
  let users = await getUsers();
  const newUsers = users.filter(u => u.id != id);
  if (newUsers.length === users.length) return json({ success: false, error: 'User not found' });

  const saved = await saveUsers(newUsers);
  return json({ success: saved });
});

// ================== SERVER ==================
server(
  { security: { csrf: false } },

  get('/favicon.ico', ctx => json({})),

  get('/', ctx => render(path.join(__dirname, 'public/home.html'))),
  get('/login', ctx => render(path.join(__dirname, 'public/login.html'))),
  get('/signup', ctx => render(path.join(__dirname, 'public/signup.html'))),
  get('/admin-users', ctx => render(path.join(__dirname, 'public/admin-users.html'))),

  ctx => json({ error: 'Route not found', path: ctx.url })
);