let currentMember = '';
let currentRecipe = null;
let recipes = [];
let categories = [];
let cart = [];
let _orderCounts = {};  // { recipe_id: count }
let _searchQuery = '';

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  updateCartFloat();
  if (pageId === 'page-menu') {
    currentRecipe = null;
    document.getElementById('order-note').value = '';
    loadRecipes();
    const activeTab = document.querySelector('.menu-tab.active');
    if (activeTab && activeTab.dataset.tab === 'history') {
      loadHistory();
    }
  }
}

async function initCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.email) {
    currentMember = session.user.email;
  }
  const el = document.getElementById('menu-user-email');
  if (el && session?.user?.email) {
    el.textContent = session.user.email;
  }
}

async function loadRecipes() {
  const list = document.getElementById('recipe-list');
  list.innerHTML = '<div class="loading"><div class="spinner"></div><p>加载菜单中...</p></div>';

  const [recipeRes, orderRes] = await Promise.all([
    supabase.from('recipes').select('*').order('created_at', { ascending: false }),
    supabase.from('orders').select('recipe_id')
  ]);

  if (recipeRes.error) {
    console.error(recipeRes.error);
    list.innerHTML = '<div class="empty-state"><div class="emoji">😵</div><p>加载失败，请检查网络</p></div>';
    return;
  }

  recipes = recipeRes.data || [];
  categories = [...new Set(recipes.map(r => r.category).filter(Boolean))];

  // 统计点餐次数
  _orderCounts = {};
  (orderRes.data || []).forEach(o => {
    if (o.recipe_id) _orderCounts[o.recipe_id] = (_orderCounts[o.recipe_id] || 0) + 1;
  });

  renderCategories();
  renderRecipes();
}

function renderCategories() {
  const bar = document.getElementById('category-bar');
  const all = `<span class="category-tag active" data-cat="all" onclick="filterCategory('all', this)">全部</span>`;
  const hot = `<span class="category-tag" data-cat="__hot" onclick="filterCategory('__hot', this)">🔥 常点</span>`;
  const items = categories.map(c =>
    `<span class="category-tag" data-cat="${c}" onclick="filterCategory('${c}', this)">${c}</span>`
  ).join('');
  bar.innerHTML = all + hot + items;
}

function filterCategory(cat, el) {
  document.querySelectorAll('.category-tag').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderRecipes(cat);
}

function renderRecipes(cat = 'all') {
  const list = document.getElementById('recipe-list');
  let filtered = recipes;

  // 搜索过滤
  if (_searchQuery) {
    filtered = filtered.filter(r => r.name.toLowerCase().includes(_searchQuery));
  }

  // 分类过滤
  if (cat === '__hot') {
    filtered = filtered.filter(r => (_orderCounts[r.id] || 0) > 0);
    filtered.sort((a, b) => (_orderCounts[b.id] || 0) - (_orderCounts[a.id] || 0));
  } else if (cat !== 'all') {
    filtered = filtered.filter(r => r.category === cat);
  }

  if (filtered.length === 0) {
    const msg = _searchQuery ? '没有找到匹配的菜品' : '还没有菜品，等厨师添加中...';
    const emoji = _searchQuery ? '🔍' : '🍽️';
    list.innerHTML = `<div class="empty-state"><div class="emoji">${emoji}</div><p>${msg}</p></div>`;
    return;
  }

  list.innerHTML = filtered.map(r => {
    const img = r.image
      ? `<img src="${r.image}" alt="${r.name}" loading="lazy">`
      : '<div class="placeholder-img">🍲</div>';
    const count = _orderCounts[r.id] || 0;
    const countHtml = count > 0 ? `<span class="order-count-badge">${count}次</span>` : '';
    return `
      <div class="recipe-card" onclick="showDetail(${r.id})">
        ${img}
        <div class="recipe-card-info">
          <h3>${r.name}</h3>
          <div class="recipe-card-meta">
            <span class="category">${r.category || '其他'}</span>
            ${countHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function onSearchInput() {
  _searchQuery = document.getElementById('recipe-search').value.trim().toLowerCase();
  const activeCat = document.querySelector('.category-tag.active');
  const cat = activeCat ? activeCat.dataset.cat : 'all';
  renderRecipes(cat);
}

function showDetail(id) {
  currentRecipe = recipes.find(r => r.id === id);
  if (!currentRecipe) return;

  const d = document.getElementById('recipe-detail');
  const r = currentRecipe;

  let html = '';
  if (r.image) html += `<img src="${r.image}" alt="${r.name}" loading="lazy">`;
  html += `<span class="detail-category">${r.category || '其他'}</span>`;
  html += `<h2>${r.name}</h2>`;

  if (r.ingredients) {
    const items = r.ingredients.split('\n').filter(Boolean);
    html += `<h3>🥬 配菜</h3><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
  }

  if (r.steps) {
    html += `<h3>👨‍🍳 做法</h3><div class="step-text">${r.steps}</div>`;
  }

  d.innerHTML = html;
  document.getElementById('order-recipe-name').textContent = '🍽️ ' + r.name;
  document.getElementById('order-note').value = '';
  showPage('page-detail');
}

function addToCart() {
  if (!currentRecipe) return;
  const note = document.getElementById('order-note').value.trim();
  cart.push({
    recipe_id: currentRecipe.id,
    recipe_name: currentRecipe.name,
    note: note
  });
  updateCartFloat();
  document.getElementById('order-note').value = '';
  toast('已加入已点菜谱');
  showPage('page-menu');
}

function updateCartFloat() {
  const float = document.getElementById('cart-float');
  const count = document.getElementById('cart-count');
  count.textContent = cart.length;
  const activePage = document.querySelector('.page.active');
  const hide = activePage && activePage.id === 'page-cart';
  float.style.display = cart.length > 0 && !hide ? 'flex' : 'none';
}

function showCart() {
  renderCart();
  showPage('page-cart');
}

function renderCart() {
  const list = document.getElementById('cart-list');
  const bottom = document.querySelector('.cart-bottom');
  if (cart.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="emoji">🛒</div><p>还没有点菜，去菜单看看吧</p></div>';
    if (bottom) bottom.style.display = 'none';
    return;
  }
  if (bottom) bottom.style.display = 'block';
  list.innerHTML = cart.map((item, i) => `
    <div class="cart-item">
      <div class="cart-item-info">
        <h3>🍽️ ${item.recipe_name}</h3>
        ${item.note ? `<p class="cart-item-note">💬 ${item.note}</p>` : ''}
      </div>
      <button class="cart-item-delete" onclick="removeFromCart(${i})">✕</button>
    </div>
  `).join('');
  document.getElementById('cart-total').textContent = `共 ${cart.length} 个菜品`;
}

function removeFromCart(index) {
  cart.splice(index, 1);
  updateCartFloat();
  renderCart();
  if (cart.length === 0) showPage('page-menu');
}

async function submitCart() {
  if (cart.length === 0) return;
  const btn = document.querySelector('#page-cart .btn-order');
  btn.disabled = true;
  btn.textContent = '提交中...';

  const mealId = crypto.randomUUID();
  const mealDate = new Date().toISOString();

  const orders = cart.map(item => ({
    member: currentMember,
    recipe_id: item.recipe_id,
    recipe_name: item.recipe_name,
    note: item.note,
    status: 'pending',
    meal_id: mealId,
    meal_date: mealDate
  }));

  const { error } = await supabase.from('orders').insert(orders);

  btn.disabled = false;
  btn.textContent = '合并提交';

  if (error) {
    toast('提交失败：' + error.message);
    return;
  }

  cart = [];
  updateCartFloat();
  showPage('page-success');
}

function switchMenuTab(tab, el) {
  document.querySelectorAll('.menu-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.menu-section').forEach(s => s.classList.remove('active'));
  el.classList.add('active');
  document.getElementById(tab === 'menu' ? 'menu-content' : 'history-content').classList.add('active');
  if (tab === 'history') loadHistory();
}

async function loadHistory() {
  const container = document.getElementById('history-content');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  // 获取今天的日期
  const today = new Date();
  const todayYmd = today.toISOString().split('T')[0];

  // 同时获取历史订单和今日订单
  const [historyRes, todayRes] = await Promise.all([
    supabase.from('orders').select('*')
      .eq('member', currentMember)
      .not('meal_id', 'is', null)
      .lt('created_at', todayYmd + 'T00:00:00')
      .order('meal_date', { ascending: false }),
    supabase.from('orders').select('*')
      .eq('member', currentMember)
      .gte('created_at', todayYmd + 'T00:00:00')
      .order('created_at', { ascending: false })
  ]);

  let html = '';

  // 今日订单（可编辑）
  const todayOrders = todayRes.data || [];
  if (todayOrders.length > 0) {
    const pendingOrders = todayOrders.filter(o => o.status !== 'done');
    const doneOrders = todayOrders.filter(o => o.status === 'done');

    html += '<div class="history-card"><div class="history-card-header"><span class="history-date">📋 今日点餐</span></div><div class="history-items">';
    pendingOrders.forEach(o => {
      html += `
        <div class="history-item">
          <div class="history-item-row">
            <span>🍽️ ${o.recipe_name} <span class="status-tag status-pending">待完成</span></span>
            <button class="btn-edit-sm" onclick="editOrder(${o.id})">✏️</button>
          </div>
          ${o.note ? `<span class="history-note">💬 ${o.note}</span>` : ''}
        </div>
      `;
    });
    doneOrders.forEach(o => {
      html += `
        <div class="history-item">
          <span>🍽️ ${o.recipe_name} <span class="status-tag status-done-tag">已完成</span></span>
          ${o.note ? `<span class="history-note">💬 ${o.note}</span>` : ''}
        </div>
      `;
    });
    html += '</div></div>';
  }

  // 历史订单
  const historyOrders = historyRes.data || [];
  if (historyOrders.length === 0 && todayOrders.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="emoji">📅</div><p>还没有历史点餐记录</p></div>';
    return;
  }

  if (historyOrders.length > 0) {
    const meals = {};
    historyOrders.forEach(o => {
      if (!meals[o.meal_id]) {
        meals[o.meal_id] = { meal_id: o.meal_id, meal_date: o.meal_date, items: [] };
      }
      meals[o.meal_id].items.push(o);
    });

    Object.values(meals).forEach(meal => {
      const d = new Date(meal.meal_date);
      const pad = n => String(n).padStart(2, '0');
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      html += `
        <div class="history-card">
          <div class="history-card-header">
            <span class="history-date">${dateStr}</span>
          </div>
          <div class="history-items">
            ${meal.items.map(item => `
              <div class="history-item">
                <span>🍽️ ${item.recipe_name}</span>
                ${item.note ? `<span class="history-note">💬 ${item.note}</span>` : ''}
              </div>
            `).join('')}
          </div>
          <button class="btn-secondary" onclick="reorderMeal('${meal.meal_id}')">🔄 再来一餐</button>
        </div>
      `;
    });
  }

  container.innerHTML = html;
}

async function reorderMeal(mealId) {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('meal_id', mealId)
    .eq('member', currentMember);

  if (error || !orders) {
    toast('加载失败');
    return;
  }

  orders.forEach(o => {
    cart.push({
      recipe_id: o.recipe_id,
      recipe_name: o.recipe_name,
      note: o.note || ''
    });
  });

  updateCartFloat();
  document.querySelector('.menu-tab[data-tab="menu"]').click();
  toast(`已添加 ${orders.length} 个菜品到已点菜谱`);
}

function toast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

async function editOrder(id) {
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', id).single();
  if (error || !order) { toast('加载失败'); return; }

  // 加载菜谱列表
  const select = document.getElementById('edit-order-recipe');
  select.innerHTML = recipes.map(r =>
    `<option value="${r.id}"${r.id === order.recipe_id ? ' selected' : ''}>${r.name}</option>`
  ).join('');

  document.getElementById('edit-order-id').value = id;
  document.getElementById('edit-order-note').value = order.note || '';
  document.getElementById('modal-edit-order').classList.add('active');
}

async function saveEditOrder() {
  const id = document.getElementById('edit-order-id').value;
  const select = document.getElementById('edit-order-recipe');
  const recipeId = parseInt(select.value);
  const recipeName = select.options[select.selectedIndex].text;
  const note = document.getElementById('edit-order-note').value.trim();

  const { error } = await supabase.from('orders').update({
    recipe_id: recipeId,
    recipe_name: recipeName,
    note: note
  }).eq('id', id);

  if (error) { toast('保存失败:' + error.message); return; }

  closeEditOrderModal();
  toast('已修改');
  // 刷新历史列表
  const activeTab = document.querySelector('.menu-tab.active');
  if (activeTab && activeTab.dataset.tab === 'history') loadHistory();
}

function closeEditOrderModal() {
  document.getElementById('modal-edit-order').classList.remove('active');
}

// 编辑订单弹窗点击遮罩关闭
document.getElementById('modal-edit-order').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeEditOrderModal();
});

initCurrentUser().then(() => loadRecipes());
