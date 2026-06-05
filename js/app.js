let currentMember = '';
let currentRecipe = null;
let recipes = [];
let categories = [];

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  if (pageId === 'page-menu') {
    currentRecipe = null;
    document.getElementById('order-note').value = '';
    loadRecipes();
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

async function placeOrder() {
  if (!currentRecipe) return;
  const btn = document.querySelector('.btn-order');
  btn.disabled = true;
  btn.textContent = '下单中...';

  const note = document.getElementById('order-note').value.trim();

  const { error } = await supabase.from('orders').insert({
    member: currentMember,
    recipe_id: currentRecipe.id,
    recipe_name: currentRecipe.name,
    note: note,
    status: 'pending'
  });

  btn.disabled = false;
  btn.textContent = '🍽️ 就吃这个！';

  if (error) {
    toast('下单失败：' + error.message);
    return;
  }

  document.getElementById('order-note').value = '';
  showPage('page-success');
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
