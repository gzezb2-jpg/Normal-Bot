// server.js
const server = require('server');
const { get, post } = server.router;
const { render, json } = server.reply;
const path = require('path');
const fetch = require('node-fetch');

// ====== إعدادات النظام ======
const CONFIG = {
  // Pterodactyl
  PTERODACTYL_URL: 'https://your-panel.belvohost.com', // ← غيّره لرابط لوحة تحكمك
  PTERODACTYL_API_KEY: 'ptl_your_actual_api_key_here', // ← ضع مفتاحك الحقيقي هنا

  // JSONBin
  JSONBIN_API_KEY: '$2a$10$j9lzn5tqhuvLqZI8dYLwCesE/7r7eLZyms3h6b9U1RfPDsDeB21e2', // ← من JSONBin > Settings > API Keys
  JSONBIN_BIN_ID: '6977b2c0d0ea881f4087afef', // ← ID الـ Bin اللي يخزن المستخدمين

  // إعدادات الخادم الافتراضية
  DEFAULT_LOCATION_ID: 1,
  DEFAULT_EGG_ID: 1, // مثلاً: Minecraft Egg
  DEFAULT_DOCKER_IMAGE: 'ghcr.io/pterodactyl/yolks:java_17',
  DEFAULT_STARTUP: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar',
};

// ====== دالة: جلب المستخدمين من JSONBin ======
async function fetchUsersFromJsonBin() {
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.JSONBIN_BIN_ID}`, {
      headers: { 'X-Master-Key': CONFIG.JSONBIN_API_KEY }
    });
    if (!res.ok) throw new Error('Failed to fetch users');
    const data = await res.json();
    return data.record.users || [];
  } catch (err) {
    console.error('❌ JSONBin Fetch Error:', err.message);
    return [];
  }
}

// ====== دالة: حفظ المستخدمين في JSONBin ======
async function saveUsersToJsonBin(users) {
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': CONFIG.JSONBIN_API_KEY,
        'X-Bin-Private': 'false'
      },
      body: JSON.stringify({ users })    });
    return res.ok;
  } catch (err) {
    console.error('❌ JSONBin Save Error:', err.message);
    return false;
  }
}

// ====== دالة: إنشاء خادم في Pterodactyl ======
async function createPterodactylServer(username) {
  try {
    const payload = {
      name: `Server-${username}`,
      user: 1, // ← يمكنك لاحقًا ربطه بمستخدم حقيقي في Pterodactyl
      egg: CONFIG.DEFAULT_EGG_ID,
      docker_image: CONFIG.DEFAULT_DOCKER_IMAGE,
      startup: CONFIG.DEFAULT_STARTUP,
      environment: {
        SERVER_JARFILE: 'server.jar',
        MC_VERSION: '1.20.1'
      },
      limits: {
        memory: 1024,
        swap: 0,
        disk: 2048,
        io: 500,
        cpu: 100
      },
      feature_limits: {
        databases: 1,
        allocations: 1,
        backups: 2
      },
      deploy: {
        locations: [CONFIG.DEFAULT_LOCATION_ID],
        dedicated_ip: false,
        port_range: []
      }
    };

    const res = await fetch(`${CONFIG.PTERODACTYL_URL}/api/application/servers`, {
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
      throw new Error(`Pterodactyl API: ${text}`);
    }

    const result = await res.json();
    console.log(`✅ Server created for ${username} | ID:`, result.attributes.id);
    return true;
  } catch (err) {
    console.error('❌ Pterodactyl Error:', err.message);
    return false;
  }
}

// ====== ROUTES ======

server(
  // خدمة ملفات HTML من مجلد public
  get('/', ctx => render(path.join(__dirname, 'public', 'home.html'))),
  get('/plans', ctx => render(path.join(__dirname, 'public', 'plans.html'))),
  get('/signup', ctx => render(path.join(__dirname, 'public', 'signup.html'))),
  get('/login', ctx => render(path.join(__dirname, 'public', 'login.html'))),

  // API: جلب الكوينز (يمكنك لاحقًا ربطه بمستخدم)
  get('/api/coins', ctx => json({ coins: 2500 })),

  // API: التسجيل
  post('/signup', async ctx => {
    const { username, password } = ctx.data;

    if (!username || !password || username.length < 3) {
      return json({ success: false, error: 'Username must be at least 3 characters' });
    }

    let users = await fetchUsersFromJsonBin();

    if (users.some(u => u.username === username)) {
      return json({ success: false, error: 'Username already exists' });
    }

    const newUser = {
      id: Date.now(),
      username,
      password, // ⚠️ استخدم bcrypt في الإنتاج!
      coins: 1000,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    // حفظ في JSONBin
    const saved = await saveUsersToJsonBin(users);
    if (!saved) {
      return json({ success: false, error: 'Failed to save user data' });
    }

    // إنشاء خادم في Pterodactyl
    const serverCreated = await createPterodactylServer(username);
    if (!serverCreated) {
      console.warn(`⚠️ User ${username} saved but server creation failed.`);
    }

    return json({ success: true });
  }),

  // API: تسجيل الدخول (بسيط)
  post('/login', async ctx => {
    const { username, password } = ctx.data;
    const users = await fetchUsersFromJsonBin();
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      return json({ success: true, username });
    }
    return json({ success: false, error: 'Invalid credentials' });
  })
);