'use strict';
/*
 * 智能云AI电商在线销售系统 — 后端服务
 * 纯 Node.js 内置模块实现，无需任何第三方依赖，可直接作为单端口 HTTP 服务发布。
 * 功能：用户注册/登录(密码 scrypt 哈希 + HMAC 签名令牌)、商品、购物车、订单、
 *       AI 智能推荐、AI 导购助手、智能搜索、管理员后台。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const SECRET = process.env.APP_SECRET || 'smart-cloud-ai-ecommerce-2026-secret';

/* ----------------------------- 工具函数 ----------------------------- */
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function readJson(file, fallback) {
  const fp = path.join(DATA_DIR, file);
  if (!fs.existsSync(fp)) return fallback;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (e) { return fallback; }
}
function writeJson(file, data) {
  ensureDir(DATA_DIR);
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf8');
}
function send(res, status, obj, headers) {
  const body = typeof obj === 'string' ? obj : JSON.stringify(obj);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers || {}));
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e7) req.destroy(); });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}
function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* --------------------------- 密码与令牌 --------------------------- */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, salt, hash) {
  const h = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hash, 'hex'));
}
function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64urlDecode(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Buffer.from(s, 'base64').toString('utf8'); }
function signToken(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(body).digest());
  return body + '.' + sig;
}
function verifyToken(token) {
  if (!token || token.indexOf('.') < 0) return null;
  const [body, sig] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', SECRET).update(body).digest());
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch (e) { return null; }
}

/* ----------------------------- 种子数据 ----------------------------- */
const SEED_PRODUCTS = [
  { name: '云听 Pro 主动降噪蓝牙耳机', category: '数码电子', price: 699, originalPrice: 899, stock: 120, rating: 4.8, emoji: '🎧', color: '#2563eb', sales: 3200, tags: ['降噪', '蓝牙', '长续航'], desc: '40dB 主动降噪，30 小时续航，AI 通话降噪，沉浸式云听体验。' },
  { name: '智界 14 轻薄办公笔记本', category: '数码电子', price: 4599, originalPrice: 5299, stock: 60, rating: 4.7, emoji: '💻', color: '#1d4ed8', sales: 1500, tags: ['轻薄', '办公', '长续航'], desc: '14 英寸 2.8K 屏，整机 1.2kg，AI 性能调度，全天候办公伴侣。' },
  { name: '灵眸 4K 智能摄像头', category: '数码电子', price: 249, originalPrice: 329, stock: 200, rating: 4.6, emoji: '📷', color: '#0ea5e9', sales: 4200, tags: ['监控', '4K', 'AI识别'], desc: '4K 高清画质，AI 人形/宠物识别，手机远程随时看家。' },
  { name: '云充 65W 氮化镓充电器', category: '数码电子', price: 129, originalPrice: 169, stock: 300, rating: 4.9, emoji: '🔌', color: '#0284c7', sales: 6800, tags: ['快充', '便携', '多口'], desc: '65W 氮化镓三口快充，巴掌大小，出行办公一套搞定。' },
  { name: '暖光 智能落地灯', category: '智能家居', price: 399, originalPrice: 499, stock: 90, rating: 4.7, emoji: '💡', color: '#f59e0b', sales: 2100, tags: ['护眼', '语音', '调光'], desc: '无极调光护眼，支持语音与 App 控制，营造温暖居家氛围。' },
  { name: '净界 智能扫地机器人', category: '智能家居', price: 1599, originalPrice: 1999, stock: 70, rating: 4.6, emoji: '🤖', color: '#ea580c', sales: 1800, tags: ['扫拖一体', '激光导航', '自集尘'], desc: 'LDS 激光导航，扫拖一体，自动回充，解放双手的清洁管家。' },
  { name: '清风 智能空气循环扇', category: '智能家居', price: 299, originalPrice: 399, stock: 150, rating: 4.5, emoji: '🌀', color: '#d97706', sales: 2600, tags: ['静音', '遥控', '自然风'], desc: '直流变频静音，12 档风速，全屋空气循环更清新。' },
  { name: '云感 记忆棉人体工学枕', category: '智能家居', price: 159, originalPrice: 219, stock: 220, rating: 4.8, emoji: '🛏️', color: '#ca8a04', sales: 5100, tags: ['护颈', '记忆棉', '透气'], desc: '慢回弹记忆棉，贴合颈椎曲线，整夜安睡不落枕。' },
  { name: '轻氧 运动透气跑鞋', category: '服饰鞋包', price: 359, originalPrice: 459, stock: 180, rating: 4.6, emoji: '👟', color: '#16a34a', sales: 3400, tags: ['透气', '减震', '运动'], desc: '飞织网面透气，回弹中底，城市跑步与日常通勤皆宜。' },
  { name: '云锦 抗皱免烫衬衫', category: '服饰鞋包', price: 199, originalPrice: 299, stock: 240, rating: 4.5, emoji: '👔', color: '#15803d', sales: 2900, tags: ['免烫', '商务', '透气'], desc: '高支棉混纺，抗皱免烫，商务得体，机洗不变形。' },
  { name: '随行 通勤双肩背包', category: '服饰鞋包', price: 229, originalPrice: 299, stock: 160, rating: 4.7, emoji: '🎒', color: '#047857', sales: 2300, tags: ['防水', '大容量', '电脑仓'], desc: '防泼水面料，独立电脑仓，多隔层收纳，通勤出差好帮手。' },
  { name: '月光 补水保湿面膜', category: '美妆个护', price: 99, originalPrice: 139, stock: 400, rating: 4.7, emoji: '🧴', color: '#db2777', sales: 7600, tags: ['补水', '温和', '敏感肌'], desc: '玻尿酸精华，温和不刺激，一片喝饱水，敏感肌可用。' },
  { name: '净颜 氨基酸洁面乳', category: '美妆个护', price: 69, originalPrice: 99, stock: 500, rating: 4.8, emoji: '🧼', color: '#be185d', sales: 8200, tags: ['氨基酸', '清洁', '不紧绷'], desc: '氨基酸表活，绵密泡沫，深层清洁不紧绷，男女通用。' },
  { name: '琉光 丝绒哑光口红', category: '美妆个护', price: 129, originalPrice: 169, stock: 260, rating: 4.6, emoji: '💄', color: '#9d174d', sales: 4500, tags: ['丝绒', '持久', '显白'], desc: '丝绒哑光质地，显色持久，多色号百搭，一抹提气色。' },
  { name: '山野 每日坚果礼盒', category: '食品生鲜', price: 89, originalPrice: 119, stock: 350, rating: 4.8, emoji: '🥜', color: '#b45309', sales: 9100, tags: ['健康', '每日一袋', '礼盒'], desc: '30 袋独立装，7 种坚果果干搭配，营养轻负担的每日能量。' },
  { name: '鲜萃 冷萃挂耳咖啡', category: '食品生鲜', price: 59, originalPrice: 79, stock: 420, rating: 4.7, emoji: '☕', color: '#92400e', sales: 6300, tags: ['冷萃', '挂耳', '醇香'], desc: '精选阿拉比卡豆，冷水热水皆可，3 分钟一杯醇香现磨。' },
  { name: '橙意 维C果汁饮料', category: '食品生鲜', price: 39, originalPrice: 59, stock: 600, rating: 4.5, emoji: '🧃', color: '#c2410c', sales: 5400, tags: ['维C', '0脂肪', '真果汁'], desc: '100% 果汁无添加蔗糖，0 脂肪，清爽维 C 每一天。' },
  { name: '星海 科幻经典文库（全10册）', category: '图书文娱', price: 199, originalPrice: 298, stock: 130, rating: 4.9, emoji: '📚', color: '#7c3aed', sales: 3700, tags: ['科幻', '收藏', '套装'], desc: '10 册精装典藏，大师经典，一场跨越星海的想象力之旅。' },
  { name: '墨韵 国风手账笔记本', category: '图书文娱', price: 49, originalPrice: 69, stock: 280, rating: 4.6, emoji: '📓', color: '#6d28d9', sales: 4100, tags: ['手账', '国风', '礼盒'], desc: '宣纸纹理封面，附赠贴纸与书签，记录生活的诗意。' },
  { name: '律动 便携蓝牙音箱', category: '图书文娱', price: 179, originalPrice: 239, stock: 170, rating: 4.5, emoji: '🔊', color: '#5b21b6', sales: 2800, tags: ['蓝牙', '防水', '重低音'], desc: 'IPX7 防水，360° 环绕声，户外露营随身音乐厅。' }
];

const AI_TAGS_POOL = {
  '数码电子': ['科技控必入', '高性价比', '送礼体面'],
  '智能家居': ['提升幸福感', '懒人神器', '居家好物'],
  '服饰鞋包': ['百搭单品', '通勤首选', '舒适耐穿'],
  '美妆个护': ['回购王', '学生党友好', '颜值与实力'],
  '食品生鲜': ['解馋必备', '办公室分享', '健康零食'],
  '图书文娱': ['自我提升', '送礼有格调', '收藏价值']
};

function initData() {
  ensureDir(DATA_DIR);
  if (!fs.existsSync(path.join(DATA_DIR, 'products.json'))) {
    const products = SEED_PRODUCTS.map((p, i) => ({
      id: uid('p_'),
      views: Math.floor(Math.random() * 200),
      aiTags: (AI_TAGS_POOL[p.category] || []).slice(0, 2),
      createdAt: Date.now(),
      ...p
    }));
    writeJson('products.json', products);
  }
  if (!fs.existsSync(path.join(DATA_DIR, 'users.json'))) {
    const { salt, hash } = hashPassword('admin123');
    const { salt: s2, hash: h2 } = hashPassword('user123');
    writeJson('users.json', [
      { id: uid('u_'), username: 'admin', passwordHash: hash, salt, email: 'admin@smartcloud.ai', role: 'admin', avatar: '🛡️', createdAt: Date.now() },
      { id: uid('u_'), username: 'test', passwordHash: h2, salt: s2, email: 'test@smartcloud.ai', role: 'user', avatar: '🛍️', createdAt: Date.now() }
    ]);
  }
  if (!fs.existsSync(path.join(DATA_DIR, 'orders.json'))) writeJson('orders.json', []);
  if (!fs.existsSync(path.join(DATA_DIR, 'carts.json'))) writeJson('carts.json', {});
  if (!fs.existsSync(path.join(DATA_DIR, 'views.json'))) writeJson('views.json', {});
}
initData();

/* ----------------------------- 业务函数 ----------------------------- */
function findUser(name) { return readJson('users.json', []).find((u) => u.username === name); }
function publicUser(u) { return { id: u.id, username: u.username, email: u.email, role: u.role, avatar: u.avatar }; }

function recordView(userId, productId) {
  const views = readJson('views.json', {});
  const list = views[userId] || [];
  list.push(productId);
  if (list.length > 50) list.shift();
  views[userId] = list;
  writeJson('views.json', views);
  const products = readJson('products.json', []);
  const p = products.find((x) => x.id === productId);
  if (p) { p.views = (p.views || 0) + 1; writeJson('products.json', products); }
}

function recommend(userId, limit = 8) {
  const products = readJson('products.json', []);
  const orders = readJson('orders.json', []);
  const views = readJson('views.json', {});
  const seen = new Set((views[userId] || []));
  orders.filter((o) => o.userId === userId).forEach((o) => o.items.forEach((it) => seen.add(it.productId)));

  // 品类偏好：来自浏览与历史订单
  const aff = {};
  (views[userId] || []).forEach((pid) => {
    const p = products.find((x) => x.id === pid);
    if (p) aff[p.category] = (aff[p.category] || 0) + 1;
  });
  orders.filter((o) => o.userId === userId).forEach((o) => o.items.forEach((it) => {
    const p = products.find((x) => x.id === it.productId);
    if (p) aff[p.category] = (aff[p.category] || 0) + 2;
  }));

  let ranked;
  if (Object.keys(aff).length === 0) {
    // 游客/新用户：热门 + 高评分
    ranked = products.slice().sort((a, b) => (b.sales + b.rating * 500) - (a.sales + a.rating * 500));
  } else {
    ranked = products.slice().sort((a, b) => {
      const sa = (aff[a.category] || 0) * 1000 + a.rating * 300 + a.sales / 10;
      const sb = (aff[b.category] || 0) * 1000 + b.rating * 300 + b.sales / 10;
      return sb - sa;
    });
  }
  // 优先推荐未浏览过的，再补齐
  const unseen = ranked.filter((p) => !seen.has(p.id));
  const result = unseen.concat(ranked.filter((p) => seen.has(p.id)));
  return result.slice(0, limit);
}

function smartSearch(q) {
  const products = readJson('products.json', []);
  if (!q) return products.slice().sort((a, b) => b.sales - a.sales).slice(0, 12);
  const k = q.toLowerCase();
  const scored = products.map((p) => {
    let s = 0;
    if (p.name.toLowerCase().includes(k)) s += 10;
    if (p.category.toLowerCase().includes(k)) s += 6;
    (p.tags || []).forEach((t) => { if (t.toLowerCase().includes(k)) s += 4; });
    (p.aiTags || []).forEach((t) => { if (t.toLowerCase().includes(k)) s += 3; });
    if (p.desc.toLowerCase().includes(k)) s += 2;
    return { p, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  return scored.length ? scored.map((x) => x.p) : products.slice().sort((a, b) => b.sales - a.sales).slice(0, 12);
}

function chatAssistant(message, userId) {
  const m = (message || '').toLowerCase();
  const products = readJson('products.json', []);
  const catMap = {
    '数码': '数码电子', '手机': '数码电子', '电脑': '数码电子', '耳机': '数码电子', '相机': '数码电子', '充电': '数码电子',
    '家居': '智能家居', '家具': '智能家居', '灯': '智能家居', '扫地': '智能家居', '空气': '智能家居',
    '服饰': '服饰鞋包', '衣服': '服饰鞋包', '鞋': '服饰鞋包', '背包': '服饰鞋包', '衬衫': '服饰鞋包',
    '美妆': '美妆个护', '护肤': '美妆个护', '面膜': '美妆个护', '口红': '美妆个护', '洁面': '美妆个护',
    '食品': '食品生鲜', '吃': '食品生鲜', '零食': '食品生鲜', '咖啡': '食品生鲜', '坚果': '食品生鲜',
    '书': '图书文娱', '图书': '图书文娱', '笔记': '图书文娱', '音箱': '图书文娱'
  };
  let reply = '';
  let picks = [];
  if (/(退货|退款|售后|换货)/.test(m)) {
    reply = '关于售后：本平台支持 7 天无理由退换货，商品质量问题运费由平台承担。您可在「我的订单」中发起售后申请，客服会在 24 小时内处理。';
  } else if (/(配送|发货|快递|物流|多久|到货)/.test(m)) {
    reply = '本平台现货商品通常在 24 小时内发货，大部分地区 1-3 天送达，支持顺丰与京东物流。可在订单详情实时查看物流进度。';
  } else if (/(优惠|便宜|折扣|券|活动|省钱)/.test(m)) {
    reply = '为您挑选几款高性价比、折扣力度大的好物，闭眼入不踩雷：';
    picks = products.slice().sort((a, b) => (b.originalPrice - b.price) - (a.originalPrice - a.price)).slice(0, 4);
  } else if (/(礼物|送人|礼品|送礼|生日)/.test(m)) {
    reply = '送人有面子又实用，推荐这几款高评分好物：';
    picks = products.slice().sort((a, b) => b.rating - a.rating).slice(0, 4);
  } else {
    let cat = null;
    for (const key in catMap) { if (m.includes(key)) { cat = catMap[key]; break; } }
    if (cat) {
      reply = `为您推荐「${cat}」分类下的热门商品：`;
      picks = products.filter((p) => p.category === cat).sort((a, b) => b.sales - a.sales).slice(0, 6);
    } else if (/(推荐|买什么|有什么|好的|帮我|建议)/.test(m) || !m) {
      reply = '根据大家的热爱，为您智能推荐以下商品：';
      picks = recommend(userId, 6);
    } else {
      const found = smartSearch(message);
      if (found.length && found.length < products.length) {
        reply = `为您找到相关商品：`;
        picks = found.slice(0, 6);
      } else {
        reply = '我是您的 AI 导购助手，可以帮您推荐商品、查询优惠与售后。试试问我：「有什么数码好物推荐？」「想要便宜的」「送礼物选什么？」';
        picks = recommend(userId, 4);
      }
    }
  }
  return { reply, products: picks };
}

/* ----------------------------- 路由 ----------------------------- */
function getToken(req) {
  const h = req.headers['authorization'] || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}
function authUser(req) {
  const t = verifyToken(getToken(req));
  if (!t) return null;
  const u = readJson('users.json', []).find((x) => x.id === t.uid);
  return u || null;
}

function router(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  const method = req.method;

  // ---- 静态资源 ----
  if (method === 'GET' && !pathname.startsWith('/api/')) {
    let fp = pathname === '/' ? '/index.html' : pathname;
    const full = path.join(PUBLIC_DIR, fp);
    if (!full.startsWith(PUBLIC_DIR)) return send(res, 403, { error: 'forbidden' });
    if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      // SPA 兜底：未知路径回首页
      const idx = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(idx)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(fs.readFileSync(idx));
      }
      return send(res, 404, { error: 'not found' });
    }
    const ext = path.extname(full);
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
    res.writeHead(200, { 'Content-Type': (types[ext] || 'application/octet-stream') + '; charset=utf-8' });
    return res.end(fs.readFileSync(full));
  }

  // ---- API ----
  const api = pathname.replace(/^\/api/, '');
  const sendOk = (o) => send(res, 200, o);

  // 注册
  if (method === 'POST' && api === '/register') {
    return readBody(req).then((b) => {
      const username = (b.username || '').trim();
      const password = b.password || '';
      if (!username || !password) return send(res, 400, { error: '用户名和密码不能为空' });
      if (password.length < 6) return send(res, 400, { error: '密码至少 6 位' });
      if (findUser(username)) return send(res, 409, { error: '用户名已存在' });
      const { salt, hash } = hashPassword(password);
      const users = readJson('users.json', []);
      const user = { id: uid('u_'), username, passwordHash: hash, salt, email: b.email || '', role: 'user', avatar: '🛍️', createdAt: Date.now() };
      users.push(user); writeJson('users.json', users);
      const token = signToken({ uid: user.id, role: user.role, exp: Date.now() + 7 * 24 * 3600 * 1000 });
      return sendOk({ token, user: publicUser(user) });
    }).catch(() => send(res, 400, { error: '请求格式错误' }));
  }

  // 登录
  if (method === 'POST' && api === '/login') {
    return readBody(req).then((b) => {
      const username = (b.username || '').trim();
      const password = b.password || '';
      const user = findUser(username);
      if (!user || !verifyPassword(password, user.salt, user.passwordHash)) return send(res, 401, { error: '用户名或密码错误' });
      const token = signToken({ uid: user.id, role: user.role, exp: Date.now() + 7 * 24 * 3600 * 1000 });
      return sendOk({ token, user: publicUser(user) });
    }).catch(() => send(res, 400, { error: '请求格式错误' }));
  }

  // 当前用户
  if (method === 'GET' && api === '/me') {
    const u = authUser(req);
    if (!u) return send(res, 401, { error: '未登录' });
    return sendOk({ user: publicUser(u) });
  }

  // 商品列表
  if (method === 'GET' && api === '/products') {
    const q = url.searchParams.get('q') || '';
    const category = url.searchParams.get('category') || '';
    const sort = url.searchParams.get('sort') || '';
    let list = q ? smartSearch(q) : readJson('products.json', []);
    if (category) list = list.filter((p) => p.category === category);
    if (sort === 'price_asc') list = list.slice().sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') list = list.slice().sort((a, b) => b.price - a.price);
    else if (sort === 'sales') list = list.slice().sort((a, b) => b.sales - a.sales);
    else if (sort === 'rating') list = list.slice().sort((a, b) => b.rating - a.rating);
    return sendOk({ products: list, categories: [...new Set(readJson('products.json', []).map((p) => p.category))] });
  }

  // 商品详情 + 记录浏览
  if (method === 'GET' && api.startsWith('/products/')) {
    const id = api.split('/')[2];
    const p = readJson('products.json', []).find((x) => x.id === id);
    if (!p) return send(res, 404, { error: '商品不存在' });
    const u = authUser(req);
    if (u) recordView(u.id, id);
    return sendOk({ product: p, related: readJson('products.json', []).filter((x) => x.category === p.category && x.id !== p.id).slice(0, 4) });
  }

  // 管理员新增商品
  if (method === 'POST' && api === '/products') {
    const u = authUser(req);
    if (!u || u.role !== 'admin') return send(res, 403, { error: '需要管理员权限' });
    return readBody(req).then((b) => {
      if (!b.name || !b.category || !(b.price >= 0)) return send(res, 400, { error: '商品信息不完整' });
      const products = readJson('products.json', []);
      const np = {
        id: uid('p_'), name: b.name, category: b.category, price: Number(b.price),
        originalPrice: Number(b.originalPrice || b.price), stock: Number(b.stock || 0),
        rating: Number(b.rating || 4.5), emoji: b.emoji || '🛒', color: b.color || '#2563eb',
        sales: 0, tags: b.tags || [], desc: b.desc || '', aiTags: (AI_TAGS_POOL[b.category] || []).slice(0, 2),
        views: 0, createdAt: Date.now()
      };
      products.push(np); writeJson('products.json', products);
      return sendOk({ product: np });
    }).catch(() => send(res, 400, { error: '请求格式错误' }));
  }

  // AI 推荐
  if (method === 'GET' && api === '/recommend') {
    const u = authUser(req);
    return sendOk({ products: recommend(u ? u.id : null, 8) });
  }

  // AI 导购助手
  if (method === 'POST' && api === '/chat') {
    const u = authUser(req);
    return readBody(req).then((b) => sendOk(chatAssistant(b.message, u ? u.id : null))).catch(() => send(res, 400, { error: '请求格式错误' }));
  }

  // 购物车
  if (method === 'GET' && api === '/cart') {
    const u = authUser(req);
    if (!u) return send(res, 401, { error: '未登录' });
    const carts = readJson('carts.json', {});
    const items = carts[u.id] || {};
    const products = readJson('products.json', []);
    const list = Object.keys(items).map((pid) => {
      const p = products.find((x) => x.id === pid);
      return p ? { ...p, qty: items[pid] } : null;
    }).filter(Boolean);
    const total = list.reduce((s, p) => s + p.price * p.qty, 0);
    return sendOk({ items: list, total });
  }
  if (method === 'POST' && api === '/cart') {
    const u = authUser(req);
    if (!u) return send(res, 401, { error: '未登录' });
    return readBody(req).then((b) => {
      const pid = b.productId; const qty = Number(b.qty || 1);
      const products = readJson('products.json', []);
      if (!products.find((x) => x.id === pid)) return send(res, 404, { error: '商品不存在' });
      const carts = readJson('carts.json', {});
      carts[u.id] = carts[u.id] || {};
      carts[u.id][pid] = Math.max(1, (carts[u.id][pid] || 0) + qty);
      if (b.set) carts[u.id][pid] = Math.max(1, qty);
      writeJson('carts.json', carts);
      return sendOk({ ok: true });
    }).catch(() => send(res, 400, { error: '请求格式错误' }));
  }
  if (method === 'DELETE' && api.startsWith('/cart/')) {
    const u = authUser(req);
    if (!u) return send(res, 401, { error: '未登录' });
    const pid = api.split('/')[2];
    const carts = readJson('carts.json', {});
    if (carts[u.id]) { delete carts[u.id][pid]; writeJson('carts.json', carts); }
    return sendOk({ ok: true });
  }

  // 下单
  if (method === 'POST' && api === '/orders') {
    const u = authUser(req);
    if (!u) return send(res, 401, { error: '未登录' });
    return readBody(req).then((b) => {
      const carts = readJson('carts.json', {});
      const items = carts[u.id] || {};
      const products = readJson('products.json', []);
      const list = Object.keys(items).map((pid) => {
        const p = products.find((x) => x.id === pid);
        return p ? { productId: pid, name: p.name, price: p.price, qty: items[pid], emoji: p.emoji } : null;
      }).filter(Boolean);
      if (!list.length) return send(res, 400, { error: '购物车为空' });
      const total = list.reduce((s, p) => s + p.price * p.qty, 0);
      const order = { id: uid('o_'), userId: u.id, items: list, total, address: b.address || '默认收货地址', status: '已支付', createdAt: Date.now() };
      const orders = readJson('orders.json', []);
      orders.push(order); writeJson('orders.json', orders);
      // 扣库存 & 累计销量
      list.forEach((it) => {
        const p = products.find((x) => x.id === it.productId);
        if (p) { p.stock = Math.max(0, p.stock - it.qty); p.sales = (p.sales || 0) + it.qty; }
      });
      writeJson('products.json', products);
      delete carts[u.id]; writeJson('carts.json', carts);
      return sendOk({ order });
    }).catch(() => send(res, 400, { error: '请求格式错误' }));
  }

  // 我的订单
  if (method === 'GET' && api === '/orders') {
    const u = authUser(req);
    if (!u) return send(res, 401, { error: '未登录' });
    const orders = readJson('orders.json', []).filter((o) => o.userId === u.id).sort((a, b) => b.createdAt - a.createdAt);
    return sendOk({ orders });
  }

  // 管理员：全部订单
  if (method === 'GET' && api === '/admin/orders') {
    const u = authUser(req);
    if (!u || u.role !== 'admin') return send(res, 403, { error: '需要管理员权限' });
    const orders = readJson('orders.json', []).sort((a, b) => b.createdAt - a.createdAt);
    return sendOk({ orders, stats: { total: orders.length, revenue: orders.reduce((s, o) => s + o.total, 0) } });
  }

  return send(res, 404, { error: '接口不存在' });
}

const server = http.createServer((req, res) => {
  try { router(req, res); } catch (e) { console.error(e); send(res, 500, { error: '服务器错误' }); }
});
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🛒 智能云AI电商在线销售系统 已启动: http://localhost:${PORT}`);
});

module.exports = server;
