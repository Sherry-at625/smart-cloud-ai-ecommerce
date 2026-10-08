/* 智能云AI电商在线销售系统 — 前端逻辑 */
const nav = (() => {
  const LS_TOKEN = 'sc_token';
  const LS_USER = 'sc_user';
  let state = { token: localStorage.getItem(LS_TOKEN) || '', user: JSON.parse(localStorage.getItem(LS_USER) || 'null'), view: 'home', param: null, authMode: 'login', categories: [] };

  /* ---------- 工具 ---------- */
  function api(method, path, body) {
    const opts = { method, headers: {} };
    if (state.token) opts.headers['Authorization'] = 'Bearer ' + state.token;
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch('/api' + path, opts).then(async r => {
      let data; try { data = await r.json(); } catch (e) { data = {}; }
      if (!r.ok) throw Object.assign(new Error(data.error || '请求失败'), { status: r.status });
      return data;
    });
  }
  function toast(msg) {
    const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 1800);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function money(n) { return '¥' + Number(n).toLocaleString('zh-CN'); }
  function saveAuth(token, user) { state.token = token; state.user = user; localStorage.setItem(LS_TOKEN, token); localStorage.setItem(LS_USER, JSON.stringify(user)); renderNav(); }
  function clearAuth() { state.token = ''; state.user = null; localStorage.removeItem(LS_TOKEN); localStorage.removeItem(LS_USER); renderNav(); }

  /* ---------- 导航栏 ---------- */
  function renderNav() {
    const el = document.getElementById('navActions');
    const cartCount = '';
    if (state.user) {
      el.innerHTML = `
        <a class="nav-btn" onclick="nav.go('cart')">🛒 购物车<span class="cart-badge" id="cartBadge"></span></a>
        <a class="nav-btn" onclick="nav.go('orders')">📦 订单</a>
        ${state.user.role === 'admin' ? '<a class="nav-btn" onclick="nav.go(\'admin\')">⚙️ 后台</a>' : ''}
        <div class="user-pill"><span class="avatar">${esc(state.user.avatar || '🙂')}</span>
          <span style="font-size:13px">${esc(state.user.username)}</span>
          <a class="nav-btn" onclick="nav.logout()" style="padding:4px 10px">退出</a></div>`;
    } else {
      el.innerHTML = `
        <a class="nav-btn" onclick="nav.openAuth('login')">登录</a>
        <a class="nav-btn" onclick="nav.openAuth('register')">注册</a>`;
    }
    updateCartBadge();
  }
  async function updateCartBadge() {
    const b = document.getElementById('cartBadge'); if (!b) return;
    if (!state.token) { b.textContent = ''; return; }
    try { const d = await api('GET', '/cart'); b.textContent = d.items.length || ''; } catch (e) { b.textContent = ''; }
  }

  /* ---------- 视图路由 ---------- */
  function go(view, param) { state.view = view; state.param = param; window.scrollTo(0, 0); render(); }
  async function render() {
    const v = document.getElementById('view');
    try {
      if (state.view === 'home') return renderHome(v);
      if (state.view === 'product') return renderProduct(v, state.param);
      if (state.view === 'cart') return renderCart(v);
      if (state.view === 'orders') return renderOrders(v);
      if (state.view === 'admin') return renderAdmin(v);
    } catch (e) { v.innerHTML = `<div class="empty"><div class="big">😵</div>${esc(e.message || '加载失败')}</div>`; }
  }

  /* ---------- 首页 ---------- */
  async function renderHome(v) {
    let products = [], cats = state.categories;
    try {
      const d = await api('GET', '/products' + (location.search && location.search.includes('q=') ? location.search : ''));
      products = d.products; cats = d.categories;
    } catch (e) {}
    state.categories = cats;
    let html = `
      <div class="hero">
        <h1>🛒 智能云AI电商在线销售系统</h1>
        <p>AI 驱动的购物体验：智能推荐 · AI 导购助手 · 语义搜索，让每一次下单都更简单。</p>
        <div class="tags"><span>🤖 AI 个性化推荐</span><span>💬 24h AI 导购</span><span>🔍 智能搜索</span><span>🚚 极速配送</span></div>
      </div>
      <div class="cats" id="cats"></div>
      <div class="section-title">🔥 为你智能推荐 <span class="pill">AI</span></div>
      <div class="grid" id="recGrid"></div>
      <div class="section-title">🛍️ 全部商品</div>
      <div class="grid" id="allGrid"></div>`;
    v.innerHTML = html;
    const catEl = document.getElementById('cats');
    catEl.innerHTML = `<span class="cat-chip active" data-c="">全部</span>` + cats.map(c => `<span class="cat-chip" data-c="${esc(c)}">${esc(c)}</span>`).join('');
    catEl.querySelectorAll('.cat-chip').forEach(ch => ch.onclick = () => {
      const c = ch.dataset.c;
      catEl.querySelectorAll('.cat-chip').forEach(x => x.classList.remove('active')); ch.classList.add('active');
      loadAll(c);
    });
    // 推荐
    try { const r = await api('GET', '/recommend'); document.getElementById('recGrid').innerHTML = r.products.map(cardHtml).join(''); } catch (e) {}
    loadAll('');
  }
  function loadAll(cat) {
    const qs = cat ? ('?category=' + encodeURIComponent(cat)) : '';
    api('GET', '/products' + qs).then(d => { document.getElementById('allGrid').innerHTML = d.products.map(cardHtml).join('') || emptyHtml('暂无商品'); }).catch(() => {});
  }
  function cardHtml(p) {
    return `<div class="card" onclick="nav.go('product','${p.id}')">
      <div class="thumb" style="background:linear-gradient(135deg, ${esc(p.color)}, ${esc(p.color)}cc)">
        ${p.aiTags && p.aiTags[0] ? `<span class="aitag">✨ ${esc(p.aiTags[0])}</span>` : ''}${esc(p.emoji)}
      </div>
      <div class="body">
        <div class="name">${esc(p.name)}</div>
        <div class="meta">${esc(p.category)} · ⭐${p.rating} · 已售${p.sales}</div>
        <div class="price-row">
          <div class="price"><span class="cur">¥</span>${p.price}<span class="old">¥${p.originalPrice}</span></div>
          <div class="buy" onclick="event.stopPropagation();nav.quickBuy('${p.id}')">加入购物车</div>
        </div>
      </div></div>`;
  }
  function emptyHtml(t) { return `<div class="empty" style="grid-column:1/-1"><div class="big">🗂️</div>${t}</div>`; }

  /* ---------- 商品详情 ---------- */
  async function renderProduct(v, id) {
    const d = await api('GET', '/products/' + id);
    const p = d.product;
    v.innerHTML = `
      <div class="detail">
        <div class="big-thumb" style="background:linear-gradient(135deg, ${esc(p.color)}, ${esc(p.color)}cc)">${esc(p.emoji)}</div>
        <div>
          <h1>${esc(p.name)}</h1>
          <div class="tags-row">${[p.category, ...(p.tags || [])].map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
          <div class="price-big">${money(p.price)}<span class="old">${money(p.originalPrice)}</span></div>
          <div class="meta" style="color:var(--muted)">⭐ ${p.rating} · 已售 ${p.sales} · 库存 ${p.stock}</div>
          <p class="desc">${esc(p.desc)}</p>
          <div class="actions">
            <div class="qty"><button onclick="nav.qty(-1)">−</button><span id="qty">1</span><button onclick="nav.qty(1)">+</button></div>
            <button class="btn" onclick="nav.addCart('${p.id}')">加入购物车</button>
            <button class="btn ghost" onclick="nav.buyNow('${p.id}')">立即购买</button>
          </div>
        </div>
      </div>
      ${d.related && d.related.length ? `<div class="section-title">📎 同类推荐</div><div class="grid">${d.related.map(cardHtml).join('')}</div>` : ''}`;
  }
  let _qty = 1;
  function qty(n) { _qty = Math.max(1, _qty + n); document.getElementById('qty').textContent = _qty; }

  /* ---------- 购物车 ---------- */
  async function renderCart(v) {
    requireLogin();
    const d = await api('GET', '/cart');
    if (!d.items.length) { v.innerHTML = `<div class="empty"><div class="big">🛒</div>购物车还是空的，去逛逛吧～<div style="margin-top:14px"><button class="btn" onclick="nav.go('home')">去购物</button></div></div>`; return; }
    v.innerHTML = `<div class="section-title">🛒 我的购物车</div>` + d.items.map(it => `
      <div class="line-item">
        <div class="li-thumb" style="background:linear-gradient(135deg, ${esc(it.color)}, ${esc(it.color)}cc)">${esc(it.emoji)}</div>
        <div class="li-info"><div class="li-name" onclick="nav.go('product','${it.id}')" style="cursor:pointer">${esc(it.name)}</div>
          <div class="li-price">${money(it.price)}</div></div>
        <div class="qty"><button onclick="nav.cartQty('${it.id}',-1)">−</button><span>${it.qty}</span><button onclick="nav.cartQty('${it.id}',1)">+</button></div>
        <div class="li-price">${money(it.price * it.qty)}</div>
        <button class="nav-btn" style="background:#fee2e2;color:#dc2626" onclick="nav.cartDel('${it.id}')">删除</button>
      </div>`).join('') + `
      <div class="summary-bar"><div class="total">合计：<span class="num">${money(d.total)}</span></div>
        <button class="btn" onclick="nav.checkout()">去结算</button></div>`;
  }
  async function cartQty(id, n) { await api('POST', '/cart', { productId: id, qty: n }); updateCartBadge(); renderCart(document.getElementById('view')); }
  async function cartDel(id) { await api('DELETE', '/cart/' + id); updateCartBadge(); renderCart(document.getElementById('view')); }

  /* ---------- 订单 ---------- */
  async function renderOrders(v) {
    requireLogin();
    const d = await api('GET', '/orders');
    if (!d.orders.length) { v.innerHTML = `<div class="empty"><div class="big">📦</div>还没有订单，下单后在这里查看～<div style="margin-top:14px"><button class="btn" onclick="nav.go('home')">去购物</button></div></div>`; return; }
    v.innerHTML = `<div class="section-title">📦 我的订单</div>` + d.orders.map(o => `
      <div class="order-card">
        <div class="ohead"><span>订单号：${esc(o.id)}</span><span>${new Date(o.createdAt).toLocaleString('zh-CN')}</span><span class="ostatus">${esc(o.status)}</span></div>
        ${o.items.map(it => `<div class="oitem"><span class="e">${esc(it.emoji)}</span><span style="flex:1">${esc(it.name)} ×${it.qty}</span><span class="li-price">${money(it.price * it.qty)}</span></div>`).join('')}
        <div style="text-align:right;font-weight:800;margin-top:8px">实付：${money(o.total)}</div>
      </div>`).join('');
  }

  /* ---------- 管理员 ---------- */
  async function renderAdmin(v) {
    const u = state.user; if (!u || u.role !== 'admin') { v.innerHTML = `<div class="empty"><div class="big">🔒</div>需要管理员权限</div>`; return; }
    const d = await api('GET', '/admin/orders');
    v.innerHTML = `
      <div class="section-title">⚙️ 管理后台</div>
      <div class="admin-grid">
        <div class="stat-box"><div class="num">${d.stats.total}</div><div class="lbl">订单总数</div></div>
        <div class="stat-box"><div class="num">${money(d.stats.revenue)}</div><div class="lbl">总销售额</div></div>
      </div>
      <div class="section-title">➕ 上架新商品</div>
      <div class="stat-box">
        <div class="field"><label>商品名称</label><input id="np_name" placeholder="例如：云听 Pro 耳机"></div>
        <div style="display:flex;gap:12px">
          <div class="field" style="flex:1"><label>分类</label><input id="np_cat" placeholder="数码电子"></div>
          <div class="field" style="flex:1"><label>价格</label><input id="np_price" type="number" placeholder="699"></div>
        </div>
        <div style="display:flex;gap:12px">
          <div class="field" style="flex:1"><label>原价</label><input id="np_op" type="number" placeholder="899"></div>
          <div class="field" style="flex:1"><label>库存</label><input id="np_stock" type="number" placeholder="100"></div>
        </div>
        <div class="field"><label>描述</label><input id="np_desc" placeholder="一句话卖点"></div>
        <div class="field"><label>图标 Emoji</label><input id="np_emoji" placeholder="🎧"></div>
        <button class="btn" onclick="nav.addProduct()">上架商品</button>
      </div>
      <div class="section-title">📋 最近订单</div>
      ${d.orders.slice(0, 15).map(o => `<div class="order-card"><div class="ohead"><span>${esc(o.id)}</span><span class="ostatus">${esc(o.status)}</span><span>${money(o.total)}</span></div><div class="oitem">${o.items.map(it => `<span class="e">${esc(it.emoji)}</span><span>${esc(it.name)} ×${it.qty}</span>`).join('')}</div></div>`).join('')}`;
  }
  async function addProduct() {
    const body = {
      name: v('np_name'), category: v('np_cat'), price: Number(v('np_price')),
      originalPrice: Number(v('np_op')), stock: Number(v('np_stock')), desc: v('np_desc'), emoji: v('np_emoji') || '🛒'
    };
    try { await api('POST', '/products', body); toast('已上架'); renderAdmin(document.getElementById('view')); }
    catch (e) { toast(e.message); }
  }

  /* ---------- 购物车操作 ---------- */
  async function ensureLoginOrAsk() { if (!state.token) { openAuth('login'); return false; } return true; }
  async function addCart(id) {
    if (!(await ensureLoginOrAsk())) return;
    try { await api('POST', '/cart', { productId: id, qty: _qty }); toast('已加入购物车'); updateCartBadge(); } catch (e) { toast(e.message); }
  }
  async function quickBuy(id) {
    if (!(await ensureLoginOrAsk())) return;
    try { await api('POST', '/cart', { productId: id, qty: 1 }); toast('已加入购物车'); updateCartBadge(); } catch (e) { toast(e.message); }
  }
  async function buyNow(id) {
    if (!(await ensureLoginOrAsk())) return;
    await api('POST', '/cart', { productId: id, qty: _qty });
    go('cart');
  }
  async function checkout() {
    requireLogin();
    try { const d = await api('POST', '/orders', { address: '默认收货地址' }); toast('下单成功！订单号 ' + d.order.id.slice(-6)); updateCartBadge(); go('orders'); }
    catch (e) { toast(e.message); }
  }

  /* ---------- 认证 ---------- */
  function requireLogin() { if (!state.token) { openAuth('login'); throw new Error('请先登录'); } }
  function openAuth(mode) {
    state.authMode = mode;
    document.getElementById('authTitle').textContent = mode === 'login' ? '欢迎登录' : '注册新账号';
    document.getElementById('authSub').textContent = mode === 'login' ? '登录后享受 AI 个性化推荐与下单' : '创建账号，开启智能购物之旅';
    document.getElementById('authEmailField').style.display = mode === 'register' ? 'block' : 'none';
    document.getElementById('authSubmit').textContent = mode === 'login' ? '登录' : '注册并登录';
    document.getElementById('authErr').textContent = '';
    document.getElementById('authUser').value = '';
    document.getElementById('authPwd').value = '';
    document.getElementById('authEmail').value = '';
    const tip = mode === 'login'
      ? '演示账号：管理员 admin / admin123 ，普通用户 test / user123'
      : '注册即登录，密码至少 6 位';
    document.getElementById('authTip').textContent = tip;
    document.getElementById('authSwitch').innerHTML = mode === 'login'
      ? '还没有账号？<a onclick="nav.openAuth(\'register\')">立即注册</a>'
      : '已有账号？<a onclick="nav.openAuth(\'login\')">去登录</a>';
    document.getElementById('authOverlay').classList.add('show');
  }
  function closeAuth() { document.getElementById('authOverlay').classList.remove('show'); }
  async function submitAuth() {
    const username = document.getElementById('authUser').value.trim();
    const password = document.getElementById('authPwd').value;
    const email = document.getElementById('authEmail').value.trim();
    const err = document.getElementById('authErr');
    err.textContent = '';
    try {
      const path = state.authMode === 'login' ? '/login' : '/register';
      const body = state.authMode === 'login' ? { username, password } : { username, password, email };
      const d = await api('POST', path, body);
      saveAuth(d.token, d.user); closeAuth(); toast('登录成功，欢迎 ' + d.user.username);
    } catch (e) { err.textContent = e.message || '操作失败'; }
  }
  function logout() { clearAuth(); toast('已退出登录'); go('home'); }

  /* ---------- 搜索 ---------- */
  function search(e) { e.preventDefault(); const q = document.getElementById('searchInput').value.trim(); if (q) { go('home'); setTimeout(() => { state.param = null; doSearch(q); }, 30); } return false; }
  async function doSearch(q) {
    const v = document.getElementById('view');
    let html = `<div class="hero"><h1>🔍 搜索：“${esc(q)}”</h1></div><div class="section-title">搜索结果</div><div class="grid" id="resGrid"></div>`;
    v.innerHTML = html;
    try { const d = await api('GET', '/products?q=' + encodeURIComponent(q)); document.getElementById('resGrid').innerHTML = d.products.map(cardHtml).join('') || emptyHtml('没有找到相关商品'); }
    catch (e) { toast(e.message); }
  }

  /* ---------- AI 助手 ---------- */
  let aiOpen = false;
  function toggleAI() { aiOpen = !aiOpen; document.getElementById('aiPanel').classList.toggle('show', aiOpen); if (aiOpen && !document.getElementById('aiMsgs').childElementCount) { addMsg('bot', '你好，我是你的 AI 导购助手 ✨ 可以帮你推荐商品、查优惠、问售后。试试下面的快捷问题吧！'); } }
  function addMsg(role, text) { const m = document.getElementById('aiMsgs'); const d = document.createElement('div'); d.className = 'msg ' + role; d.textContent = text; m.appendChild(d); m.scrollTop = m.scrollHeight; }
  function addRec(products) {
    if (!products || !products.length) return;
    const m = document.getElementById('aiMsgs');
    const wrap = document.createElement('div'); wrap.className = 'ai-rec';
    products.forEach(p => {
      const c = document.createElement('div'); c.className = 'rc';
      c.innerHTML = `<div class="e">${esc(p.emoji)}</div><div class="n">${esc(p.name)}</div><div class="p">${money(p.price)}</div>`;
      c.onclick = () => { nav.go('product', p.id); toggleAI(); };
      wrap.appendChild(c);
    });
    m.appendChild(wrap); m.scrollTop = m.scrollHeight;
  }
  async function sendAI(e) {
    e.preventDefault(); const inp = document.getElementById('aiInput'); const msg = inp.value.trim(); if (!msg) return false;
    addMsg('me', msg); inp.value = '';
    try { const d = await api('POST', '/chat', { message: msg }); addMsg('bot', d.reply); addRec(d.products); }
    catch (err) { addMsg('bot', '抱歉，我暂时无法回答，请稍后再试。'); }
    return false;
  }
  function aiQuick(q) { document.getElementById('aiInput').value = q; sendAI({ preventDefault() {} }); }

  /* ---------- 启动 ---------- */
  function init() { renderNav(); render(); }
  function v(id) { return document.getElementById(id).value; }

  return { go, render, openAuth, closeAuth, submitAuth, logout, search, quickBuy, addCart, buyNow, checkout, qty, cartQty, cartDel, addProduct, toggleAI, sendAI, aiQuick, _init: init };
})();
window.nav = nav;
nav._init();
