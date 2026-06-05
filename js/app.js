let currentMember = '';
let currentRecipe = null;
let recipes = [];
let categories = [];
let cart = [];

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

  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    list.innerHTML = '<div class="empty-state"><div class="emoji">😵</div><p>加载失败，请检查网络</p></div>';
    return;
  }

  recipes = data || [];
  categories = [...new Set(recipes.map(r => r.category).filter(Boolean))];
  renderCategories();
  renderRecipes();
}

function renderCategories() {
  const bar = document.getElementById('category-bar');
  const all = `<span class="category-tag active" data-cat="all" onclick="filterCategory('all', this)">全部</span>`;
  const items = categories.map(c =>
    `<span class="category-tag" data-cat="${c}" onclick="filterCategory('${c}', this)">${c}</span>`
  ).join('');
  bar.innerHTML = all + items;
}

function filterCategory(cat, el) {
  document.querySelectorAll('.category-tag').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderRecipes(cat);
}

function renderRecipes(cat = 'all') {
  const list = document.getElementById('recipe-list');
  const filtered = cat === 'all' ? recipes : recipes.filter(r => r.category === cat);

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="emoji">🍽️</div><p>还没有菜品，等厨师添加中...</p></div>';
    return;
  }

  list.innerHTML = filtered.map(r => {
    const img = r.image
      ? `<img src="${r.image}" alt="${r.name}" loading="lazy">`
      : '<div class="placeholder-img">🍲</div>';
    return `
      <div class="recipe-card" onclick="showDetail(${r.id})">
        ${img}
        <div class="recipe-card-info">
          <h3>${r.name}</h3>
          <span class="category">${r.category || '其他'}</span>
        </div>
      </div>
    `;
  }).join('');
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

  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('member', currentMember)
    .not('meal_id', 'is', null)
    .order('meal_date', { ascending: false });

  if (error) {
    console.error(error);
    container.innerHTML = '<div class="empty-state"><div class="emoji">😵</div><p>加载失败</p></div>';
    return;
  }

  if (!orders || orders.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="emoji">📅</div><p>还没有历史点餐记录</p></div>';
    return;
  }

  const meals = {};
  orders.forEach(o => {
    if (!meals[o.meal_id]) {
      meals[o.meal_id] = { meal_id: o.meal_id, meal_date: o.meal_date, items: [] };
    }
    meals[o.meal_id].items.push(o);
  });

  container.innerHTML = Object.values(meals).map(meal => {
    const d = new Date(meal.meal_date);
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `
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
  }).join('');
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

initCurrentUser().then(() => loadRecipes());
