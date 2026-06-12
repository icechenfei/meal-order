let currentMember = '';
let currentRecipe = null;
let recipes = [];
let categories = [];
let cart = [];
let _orderCounts = {};  // { recipe_id: count }
let _searchQuery = '';
let _recipePage = 1;
const _recipePerPage = 10;
let _activeCategory = 'all';
let _currentDetailIndex = -1;
let _detailSwipeInitialized = false;

// 图片 CDN 优化：Supabase Storage 图片变换
function thumbUrl(url) {
  if (!url || !url.includes('supabase.co/storage')) return url;
  return url + (url.includes('?') ? '&' : '?') + 'width=400&quality=75&resize=cover';
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  updateCartFloat();
  // 底部导航只在菜单页显示
  const bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) bottomNav.style.display = pageId === 'page-menu' ? 'flex' : 'none';
  if (pageId === 'page-menu') {
    currentRecipe = null;
    document.getElementById('order-note').value = '';
    loadRecipes();
    const activeTab = document.querySelector('.bottom-nav-btn.active');
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
  _recipePage = 1;
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
  const hot = `<span class="category-tag" data-cat="__hot" onclick="filterCategory('__hot', this)">🔥 常点</span>`;
  const items = categories.map(c =>
    `<span class="category-tag" data-cat="${c}" onclick="filterCategory('${c}', this)">${c}</span>`
  ).join('');
  bar.innerHTML = hot + items;
}

function filterCategory(cat, el) {
  document.querySelectorAll('.category-tag').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  _activeCategory = cat;
  _recipePage = 1;
  renderRecipes(cat);
}

function renderRecipes(cat) {
  if (cat === undefined) cat = _activeCategory;
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

  // 更新自定义按钮可见性
  _updateCustomBtn();

  if (filtered.length === 0) {
    const msg = _searchQuery ? '没有找到匹配的菜品' : '还没有菜品，等厨师添加中...';
    const emoji = _searchQuery ? '🔍' : '🍽️';
    list.innerHTML = `<div class="empty-state"><div class="emoji">${emoji}</div><p>${msg}</p></div>`;
    return;
  }

  const total = filtered.length;
  const show = filtered.slice(0, _recipePage * _recipePerPage);

  list.innerHTML = show.map(r => {
    const img = r.image
      ? `<img src="${thumbUrl(r.image)}" alt="${r.name}" loading="lazy">`
      : '<div class="placeholder-img">🍲</div>';
    const count = _orderCounts[r.id] || 0;
    const countHtml = count > 0 ? `<span class="order-count-badge">${count}次</span>` : '';
    return `
      <div class="recipe-card" data-id="${r.id}">
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

  if (show.length < total) {
    list.innerHTML += `<div class="load-more-sentinel" id="recipe-load-more"></div>`;
    _observeRecipeLoadMore();
  }
}

let _recipeObserver = null;
function _observeRecipeLoadMore() {
  if (_recipeObserver) _recipeObserver.disconnect();
  const el = document.getElementById('recipe-load-more');
  if (!el) return;
  _recipeObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      _recipePage++;
      const activeCat = document.querySelector('.category-tag.active');
      const cat = activeCat ? activeCat.dataset.cat : 'all';
      renderRecipes(cat);
    }
  }, { threshold: 0.1 });
  _recipeObserver.observe(el);
}

function _getFilteredRecipes() {
  let filtered = recipes;
  if (_searchQuery) {
    filtered = filtered.filter(r => r.name.toLowerCase().includes(_searchQuery));
  }
  if (_activeCategory === '__hot') {
    filtered = filtered.filter(r => (_orderCounts[r.id] || 0) > 0);
    filtered.sort((a, b) => (_orderCounts[b.id] || 0) - (_orderCounts[a.id] || 0));
  } else if (_activeCategory !== 'all') {
    filtered = filtered.filter(r => r.category === _activeCategory);
  }
  return filtered;
}

function randomRecipe() {
  if (recipes.length === 0) { toast('还没有菜谱'); return; }
  const r = recipes[Math.floor(Math.random() * recipes.length)];
  showDetail(r.id);
}

// 统一搜索/自定义输入
function onUnifiedInput() {
  const val = document.getElementById('unified-search').value.trim();
  _searchQuery = val.toLowerCase();
  _recipePage = 1;
  renderRecipes();
}

function onUnifiedKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const val = document.getElementById('unified-search').value.trim();
    if (!val) return;
    // 如果没有匹配的菜谱，直接作为自定义菜品加入
    const matched = recipes.filter(r => r.name.toLowerCase().includes(val.toLowerCase()));
    if (matched.length === 0) {
      addCustomDish();
    }
  }
}

function _updateCustomBtn() {
  const val = document.getElementById('unified-search')?.value.trim() || '';
  const btn = document.getElementById('btn-add-custom');
  const hint = document.getElementById('search-hint');
  const hintText = document.getElementById('search-hint-text');
  if (!btn) return;

  if (!val) {
    btn.style.display = 'none';
    hint.style.display = 'none';
    return;
  }

  const matched = recipes.filter(r => r.name.toLowerCase().includes(val.toLowerCase()));
  if (matched.length === 0) {
    btn.style.display = 'block';
    hint.style.display = 'block';
    hintText.textContent = `没有找到「${val}」，可以作为自定义菜品加入`;
  } else {
    btn.style.display = 'none';
    hint.style.display = 'none';
  }
}

function showDetail(id) {
  const filtered = _getFilteredRecipes();
  _currentDetailIndex = filtered.findIndex(r => r.id === id);
  currentRecipe = filtered[_currentDetailIndex];
  if (!currentRecipe) return;

  const d = document.getElementById('recipe-detail');
  const r = currentRecipe;

  let html = '';
  if (r.image) {
    const fullUrl = r.image.includes('supabase.co/storage') ? r.image + '?width=800&quality=80' : r.image;
    html += `<img src="${fullUrl}" alt="${r.name}">`;
  }
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

  const hint = document.getElementById('detail-swipe-hint');
  if (hint) {
    hint.textContent = filtered.length > 1 ? '👆👇 上下切换  👈👉 左右返回' : '👈👉 左右滑动返回菜单';
  }

  showPage('page-detail');
  initDetailSwipe();
}

function initDetailSwipe() {
  if (_detailSwipeInitialized) return;
  _detailSwipeInitialized = true;

  const page = document.getElementById('page-detail');
  let startX = 0;
  let startY = 0;
  let _swipeDirection = null;

  const onTouchStart = e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    _swipeDirection = null;
  };

  const onTouchMove = e => {
    if (_swipeDirection) return;
    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dx > 20 && dx > dy) {
      _swipeDirection = 'h';
    } else if (dy > 20 && dy >= dx) {
      _swipeDirection = 'v';
    }
  };

  const onTouchEnd = e => {
    if (!_swipeDirection) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (_swipeDirection === 'h') {
      if (Math.abs(dx) > 80) {
        showPage('page-menu');
      }
    } else if (_swipeDirection === 'v') {
      const filtered = _getFilteredRecipes();
      if (dy > 80 && _currentDetailIndex > 0) {
        showDetail(filtered[_currentDetailIndex - 1].id);
      } else if (dy < -80 && _currentDetailIndex < filtered.length - 1) {
        showDetail(filtered[_currentDetailIndex + 1].id);
      }
    }
  };

  page.addEventListener('touchstart', onTouchStart, { passive: true });
  page.addEventListener('touchmove', onTouchMove, { passive: true });
  page.addEventListener('touchend', onTouchEnd, { passive: true });
}

async function loadCart() {
  const { data, error } = await supabase.from('cart_items').select('*').eq('member', currentMember).order('created_at');
  if (!error && data) {
    cart = data.map(d => ({ id: d.id, recipe_id: d.recipe_id, recipe_name: d.recipe_name, note: d.note || '' }));
  }
  updateCartFloat();
}

async function addToCart() {
  if (!currentRecipe) return;
  const note = document.getElementById('order-note').value.trim();
  const { data, error } = await supabase.from('cart_items').insert({
    member: currentMember,
    recipe_id: currentRecipe.id,
    recipe_name: currentRecipe.name,
    note: note
  }).select().single();
  if (error) { toast('加入失败：' + error.message); return; }
  cart.push({ id: data.id, recipe_id: data.recipe_id, recipe_name: data.recipe_name, note: data.note || '' });
  updateCartFloat();
  document.getElementById('order-note').value = '';
  toast('已加入已点菜谱');
  showPage('page-menu');
}

async function addToCartByRecipe(id) {
  const recipe = recipes.find(r => r.id === id);
  if (!recipe) return;
  if (navigator.vibrate) navigator.vibrate(50);
  const { data, error } = await supabase.from('cart_items').insert({
    member: currentMember,
    recipe_id: id,
    recipe_name: recipe.name,
    note: ''
  }).select().single();
  if (error) { toast('加入失败：' + error.message); return; }
  cart.push({ id: data.id, recipe_id: data.recipe_id, recipe_name: data.recipe_name, note: data.note || '' });
  updateCartFloat();
  toast(`已加入「${recipe.name}」`);
}

async function addCustomDish() {
  const input = document.getElementById('unified-search');
  const name = input.value.trim();
  if (!name) {
    toast('请输入菜名');
    return;
  }
  const { data, error } = await supabase.from('cart_items').insert({
    member: currentMember,
    recipe_id: null,
    recipe_name: name,
    note: ''
  }).select().single();
  if (error) { toast('加入失败：' + error.message); return; }
  cart.push({ id: data.id, recipe_id: data.recipe_id, recipe_name: data.recipe_name, note: data.note || '' });
  input.value = '';
  _searchQuery = '';
  _updateCustomBtn();
  updateCartFloat();
  renderRecipes();
  toast(`「${name}」已加入已点菜谱`);
}

function updateCartFloat() {
  const float = document.getElementById('cart-float');
  const count = document.getElementById('cart-count');
  count.textContent = cart.length;
  const activePage = document.querySelector('.page.active');
  const hide = activePage && (activePage.id === 'page-cart' || activePage.id === 'page-success');
  float.style.display = cart.length > 0 && !hide ? 'flex' : 'none';
  // 非菜单页时底部导航隐藏，浮动按钮下移
  float.style.bottom = (activePage && activePage.id === 'page-menu') ? '80px' : '24px';
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
  list.innerHTML = cart.map((item, i) => {
    const icon = item.recipe_id ? '🍽️' : '✏️';
    const tag = item.recipe_id ? '' : ' <span class="custom-tag">自定义</span>';
    return `
    <div class="cart-item-wrapper">
      <div class="cart-item-delete-bg">删除</div>
      <div class="cart-item" data-index="${i}">
        <div class="cart-item-info">
          <h3>${icon} ${item.recipe_name}${tag}</h3>
          ${item.note ? `<p class="cart-item-note">💬 ${item.note}</p>` : ''}
        </div>
      </div>
    </div>
  `;
  }).join('');
  document.getElementById('cart-total').textContent = `共 ${cart.length} 个菜品`;
  initCartSwipe();
}

function initCartSwipe() {
  document.querySelectorAll('.cart-item-wrapper').forEach(wrapper => {
    const item = wrapper.querySelector('.cart-item');
    let startX = 0;

    const onTouchStart = e => {
      startX = e.touches[0].clientX;
      item.classList.add('swiping');
    };

    const onTouchMove = e => {
      const dx = e.touches[0].clientX - startX;
      if (dx < 0) {
        const translateX = Math.max(-80, dx);
        item.style.transform = `translateX(${translateX}px)`;
      }
    };

    const onTouchEnd = e => {
      item.classList.remove('swiping');
      const dx = e.changedTouches[0].clientX - startX;
      if (dx < -60) {
        removeFromCart(parseInt(item.dataset.index));
      } else {
        item.style.transform = '';
      }
    };

    wrapper.addEventListener('touchstart', onTouchStart, { passive: true });
    wrapper.addEventListener('touchmove', onTouchMove, { passive: true });
    wrapper.addEventListener('touchend', onTouchEnd, { passive: true });
  });
}

async function removeFromCart(index) {
  const item = cart[index];
  if (item.id) {
    await supabase.from('cart_items').delete().eq('id', item.id);
  }
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

  if (error) {
    btn.disabled = false;
    btn.textContent = '合并提交';
    toast('提交失败：' + error.message);
    return;
  }

  // 提交成功后清空购物车
  await supabase.from('cart_items').delete().eq('member', currentMember);
  cart = [];
  updateCartFloat();
  btn.disabled = false;
  btn.textContent = '合并提交';
  showPage('page-success');
}

function switchMenuTab(tab, el) {
  // 兼容旧调用（admin 页面可能用到）
  document.querySelectorAll('.menu-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.menu-section').forEach(s => s.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById(tab === 'menu' ? 'menu-content' : 'history-content').classList.add('active');
  if (tab === 'history') loadHistory();
}

// 底部导航切换
function switchBottomTab(tab, el) {
  document.querySelectorAll('.bottom-nav-btn').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.menu-section').forEach(s => s.classList.remove('active'));
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
      const icon = o.recipe_id ? '🍽️' : '✏️';
      html += `
        <div class="history-item">
          <div class="history-item-row">
            <span>${icon} ${o.recipe_name} <span class="status-tag status-pending">待完成</span></span>
            <button class="btn-edit-sm" onclick="editOrder(${o.id})">✏️</button>
          </div>
          ${o.note ? `<span class="history-note">💬 ${o.note}</span>` : ''}
        </div>
      `;
    });
    doneOrders.forEach(o => {
      const icon = o.recipe_id ? '🍽️' : '✏️';
      html += `
        <div class="history-item">
          <span>${icon} ${o.recipe_name} <span class="status-tag status-done-tag">已完成</span></span>
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
            ${meal.items.map(item => {
              const icon = item.recipe_id ? '🍽️' : '✏️';
              return `
              <div class="history-item">
                <span>${icon} ${item.recipe_name}</span>
                ${item.note ? `<span class="history-note">💬 ${item.note}</span>` : ''}
              </div>
            `;
            }).join('')}
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

  const inserts = orders.map(o => ({
    member: currentMember,
    recipe_id: o.recipe_id,
    recipe_name: o.recipe_name,
    note: o.note || ''
  }));

  const { data: inserted, error: insertError } = await supabase.from('cart_items').insert(inserts).select();
  if (insertError) { toast('加入失败：' + insertError.message); return; }

  inserted.forEach(d => {
    cart.push({ id: d.id, recipe_id: d.recipe_id, recipe_name: d.recipe_name, note: d.note || '' });
  });

  updateCartFloat();
  // 切换到底部导航的菜单 tab
  const menuBtn = document.querySelector('.bottom-nav-btn[data-tab="menu"]');
  if (menuBtn) switchBottomTab('menu', menuBtn);
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

// editOrder / saveEditOrder / closeEditOrderModal 由 common.js 提供

// 编辑订单弹窗点击遮罩关闭
document.getElementById('modal-edit-order').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeEditOrderModal();
});

// 菜谱卡片点击进入详情
document.getElementById('recipe-list').addEventListener('click', e => {
  const card = e.target.closest('.recipe-card');
  if (!card) return;
  if (card._longPressed) {
    card._longPressed = false;
    return;
  }
  showDetail(parseInt(card.dataset.id));
});

// 菜谱卡片长按快速加入
let _touchStartTime = 0;
let _touchStartTarget = null;
let _touchStartX = 0;
let _touchStartY = 0;

document.getElementById('recipe-list').addEventListener('touchstart', e => {
  const card = e.target.closest('.recipe-card');
  if (!card) return;
  _touchStartTime = Date.now();
  _touchStartTarget = card;
  _touchStartX = e.touches[0].clientX;
  _touchStartY = e.touches[0].clientY;
}, { passive: true });

document.getElementById('recipe-list').addEventListener('touchmove', e => {
  if (!_touchStartTarget) return;
  const dx = Math.abs(e.touches[0].clientX - _touchStartX);
  const dy = Math.abs(e.touches[0].clientY - _touchStartY);
  if (dx > 10 || dy > 10) {
    _touchStartTarget = null;
  }
}, { passive: true });

document.getElementById('recipe-list').addEventListener('touchend', e => {
  const target = _touchStartTarget;
  _touchStartTarget = null;
  if (!target) return;
  const elapsed = Date.now() - _touchStartTime;
  if (elapsed > 500) {
    addToCartByRecipe(parseInt(target.dataset.id));
    target._longPressed = true;
    e.preventDefault();
  }
}, { passive: false });

initCurrentUser().then(() => { loadCart(); loadRecipes(); });


