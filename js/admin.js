let editingId = null;
window._mealIngredients = [];
let _allRecipes = [];
let _adminCategory = '全部';
let _adminSearchQuery = '';
let _adminPage = 1;
let _adminSort = 'created_at'; // name / category / created_at
const _adminPerPage = 10;

const COMPRESS_MAX_SIZE = 800;   // 最大宽/高
const COMPRESS_QUALITY = 0.8;    // JPEG 质量

const PRESET_TAGS = [
  { name: '辣', emoji: '🌶️' },
  { name: '甜', emoji: '🍬' },
  { name: '酸', emoji: '🍋' },
  { name: '咸鲜', emoji: '🧂' },
  { name: '快手菜', emoji: '⚡' },
  { name: '硬菜', emoji: '🔥' },
  { name: '凉菜', emoji: '🥗' },
  { name: '汤', emoji: '🍲' },
  { name: '主食', emoji: '🥟' },
];

function getTags(el) {
  try { return JSON.parse(el) || []; } catch { return []; }
}

function renderTagPills(tags) {
  return tags.map(t => {
    const preset = PRESET_TAGS.find(p => p.name === t);
    return `<span class="recipe-tag">${preset ? preset.emoji + ' ' : ''}${t}</span>`;
  }).join('');
}

async function compressImage(source) {
  // source: File 或 Blob
  const blob = source instanceof Blob ? source : await fetch(source).then(r => r.blob());
  const bitmap = await createImageBitmap(blob);

  let { width, height } = bitmap;
  if (width > COMPRESS_MAX_SIZE || height > COMPRESS_MAX_SIZE) {
    const ratio = Math.min(COMPRESS_MAX_SIZE / width, COMPRESS_MAX_SIZE / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise(resolve => {
    canvas.toBlob(b => {
      resolve(new File([b], 'recipe.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', COMPRESS_QUALITY);
  });
}


function showAdminTab(tab, btn) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  btn.classList.add('active');
  if (tab === 'recipes') loadAdminRecipes();
  if (tab === 'orders') loadOrders();
  if (tab === 'history') loadHistoryOrders();
}

async function loadAdminRecipes() {
  _adminPage = 1;
  const list = document.getElementById('admin-recipe-list');
  list.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error(error); list.innerHTML = ''; return; }

  _allRecipes = data || [];
  renderAdminCategoryBar();
  renderAdminRecipes();
}

function renderAdminCategoryBar() {
  const cats = [...new Set(_allRecipes.map(r => r.category || '其他'))];
  const bar = document.getElementById('admin-category-bar');
  const sortBar = document.getElementById('admin-sort-bar');
  const allCats = ['全部', ...cats];
  const sortOptions = [
    { key: 'name', label: '📌 名称' },
    { key: 'category', label: '📂 分类' },
    { key: 'created_at', label: '🕐 时间' },
  ];
  bar.innerHTML = allCats.map(c =>
    `<button class="category-tag${c === _adminCategory ? ' active' : ''}" onclick="selectAdminCategory('${c}')">${c}</button>`
  ).join('');
  sortBar.innerHTML = sortOptions.map(s =>
    `<button class="sort-tag${s.key === _adminSort ? ' active' : ''}" data-sort="${s.key}" onclick="selectAdminSort('${s.key}')">${s.label}</button>`
  ).join('');
}

function selectAdminCategory(cat) {
  _adminCategory = cat;
  _adminPage = 1;
  document.querySelectorAll('#admin-category-bar .category-tag').forEach(t => {
    t.classList.toggle('active', t.textContent === cat);
  });
  renderAdminRecipes();
}

function selectAdminSort(sort) {
  _adminSort = sort;
  _adminPage = 1;
  document.querySelectorAll('#admin-category-bar .sort-tag').forEach(t => {
    t.classList.toggle('active', t.dataset.sort === sort);
  });
  renderAdminRecipes();
}

function onAdminSearchInput() {
  _adminSearchQuery = document.getElementById('admin-recipe-search').value.trim().toLowerCase();
  _adminPage = 1;
  renderAdminRecipes();
}

function renderAdminRecipes() {
  const list = document.getElementById('admin-recipe-list');
  let data = _allRecipes;
  if (_adminCategory !== '全部') {
    data = data.filter(r => (r.category || '其他') === _adminCategory);
  }
  if (_adminSearchQuery) {
    data = data.filter(r => r.name.toLowerCase().includes(_adminSearchQuery));
  }

  // 排序
  data = [...data].sort((a, b) => {
    if (_adminSort === 'name') {
      return (a.name || '').localeCompare(b.name || '', 'zh');
    } else if (_adminSort === 'category') {
      const catDiff = (a.category || '其他').localeCompare(b.category || '其他', 'zh');
      return catDiff !== 0 ? catDiff : (a.name || '').localeCompare(b.name || '', 'zh');
    }
    return 0; // created_at 已经在查询时排好序
  });

  if (data.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="emoji">📖</div><p>还没有菜谱，点击"添加"创建</p></div>';
    return;
  }

  const total = data.length;
  const show = data.slice(0, _adminPage * _adminPerPage);

  list.innerHTML = show.map(r => {
    const thumb = r.image
      ? `<img class="thumb" src="${r.image}">`
      : '<div class="thumb-placeholder">🍲</div>';
    const tags = getTags(r.tags);
    const tagHtml = tags.length > 0 ? `<div class="admin-tags">${renderTagPills(tags)}</div>` : '';
    return `
      <div class="admin-recipe-item">
        ${thumb}
        <div class="info">
          <h3>${r.name}</h3>
          <span class="cat">${r.category || '其他'}</span>
          ${tagHtml}
        </div>
        <div class="actions">
          <button class="btn-view" onclick="viewRecipe(${r.id})">查看</button>
          <button class="btn-edit" onclick="editRecipe(${r.id})">编辑</button>
          <button class="btn-delete" onclick="deleteRecipe(${r.id})">删除</button>
        </div>
      </div>
    `;
  }).join('');

  if (show.length < total) {
    list.innerHTML += `<div class="load-more-sentinel" id="admin-load-more"></div>`;
    _observeAdminLoadMore();
  }
}

let _adminObserver = null;
function _observeAdminLoadMore() {
  if (_adminObserver) _adminObserver.disconnect();
  const el = document.getElementById('admin-load-more');
  if (!el) return;
  _adminObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      _adminPage++;
      renderAdminRecipes();
    }
  }, { threshold: 0.1 });
  _adminObserver.observe(el);
}

function showAddRecipe() {
  editingId = null;
  window._autoImageUrl = null;
  document.getElementById('modal-title').textContent = '添加菜谱';
  document.getElementById('recipe-form').reset();
  document.getElementById('recipe-id').value = '';
  document.getElementById('image-preview').style.display = 'none';
  renderTagSelector([]);
  document.getElementById('modal-recipe').classList.add('active');
  loadCategories();
}

async function editRecipe(id) {
  const { data, error } = await supabase.from('recipes').select('*').eq('id', id).single();
  if (error || !data) { toast('加载失败'); return; }

  editingId = id;
  window._autoImageUrl = null;
  document.getElementById('modal-title').textContent = '编辑菜谱';
  document.getElementById('recipe-id').value = id;
  document.getElementById('recipe-name').value = data.name || '';
  document.getElementById('recipe-category').value = data.category || '';
  document.getElementById('recipe-ingredients').value = data.ingredients || '';
  document.getElementById('recipe-steps').value = data.steps || '';

  const preview = document.getElementById('image-preview');
  if (data.image) {
    preview.src = data.image;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }
  document.getElementById('recipe-image').value = '';

  renderTagSelector(getTags(data.tags));
  document.getElementById('modal-recipe').classList.add('active');
  loadCategories();
}

function renderTagSelector(selected) {
  const container = document.getElementById('tag-selector');
  container.innerHTML = PRESET_TAGS.map(t => {
    const active = selected.includes(t.name) ? ' active' : '';
    return `<button type="button" class="tag-pick${active}" data-tag="${t.name}" onclick="toggleTagPick(this)">${t.emoji} ${t.name}</button>`;
  }).join('') + `<input type="text" id="custom-tag-input" placeholder="自定义标签" maxlength="6" onkeydown="if(event.key==='Enter'){event.preventDefault();addCustomTag()}"><button type="button" class="tag-pick tag-add-btn" onclick="addCustomTag()">+ 添加</button>`;
}

function toggleTagPick(btn) {
  btn.classList.toggle('active');
}

function addCustomTag() {
  const input = document.getElementById('custom-tag-input');
  const val = input.value.trim();
  if (!val) return;
  const existing = document.querySelectorAll('#tag-selector .tag-pick[data-tag]');
  for (const el of existing) {
    if (el.dataset.tag === val) { el.classList.add('active'); input.value = ''; return; }
  }
  const container = document.getElementById('tag-selector');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tag-pick active';
  btn.dataset.tag = val;
  btn.textContent = val;
  btn.onclick = function() { toggleTagPick(this); };
  container.insertBefore(btn, input);
  input.value = '';
}

function getSelectedTags() {
  return [...document.querySelectorAll('#tag-selector .tag-pick.active')].map(b => b.dataset.tag);
}

async function saveRecipe(e) {
  e.preventDefault();

  const name = document.getElementById('recipe-name').value.trim();
  if (!name) { toast('请输入菜名'); return; }

  const tags = getSelectedTags();
  const data = {
    name,
    category: document.getElementById('recipe-category').value.trim() || '其他',
    ingredients: document.getElementById('recipe-ingredients').value.trim(),
    steps: document.getElementById('recipe-steps').value.trim(),
    tags: tags.length > 0 ? JSON.stringify(tags) : null,
  };

  const fileInput = document.getElementById('recipe-image');
  if (fileInput.files[0]) {
    let file = fileInput.files[0];
    if (file.size > 5 * 1024 * 1024) { toast('图片不能超过 5MB'); return; }
    if (file.size > 200 * 1024) {
      toast('正在压缩图片...');
      file = await compressImage(file);
    }
    const fileName = Date.now() + '_' + Math.random().toString(36).slice(2) + '.jpg';
    const { error: uploadError } = await supabase.storage.from('images').upload(fileName, file);
    if (uploadError) { toast('图片上传失败:' + uploadError.message); return; }
    const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName);
    data.image = urlData.publicUrl;
  } else if (window._autoImageUrl) {
    data.image = window._autoImageUrl;
    window._autoImageUrl = null;
  }

  const { error } = editingId
    ? await supabase.from('recipes').update(data).eq('id', editingId)
    : await supabase.from('recipes').insert(data);

  if (error) { toast('保存失败:' + error.message); return; }

  closeModal();
  loadAdminRecipes();
  toast('保存成功');
}

async function deleteRecipe(id) {
  if (!confirm('确定删除这个菜谱?')) return;

  const { data: r } = await supabase.from('recipes').select('image').eq('id', id).single();
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) { toast('删除失败:' + error.message); return; }

  if (r?.image) {
    const path = r.image.split('/').pop();
    await supabase.storage.from('images').remove([path]);
  }

  loadAdminRecipes();
  toast('已删除');
}

async function viewRecipe(id) {
  const { data: r, error } = await supabase.from('recipes').select('*').eq('id', id).single();
  if (error || !r) { toast('加载失败'); return; }

  document.getElementById('detail-name').textContent = r.name;
  let html = '';
  if (r.image) html += `<img src="${r.image}" alt="${r.name}">`;
  const tags = getTags(r.tags);
  if (tags.length > 0) html += `<div class="detail-tags">${renderTagPills(tags)}</div>`;
  if (r.ingredients) {
    html += `<h3>🥬 配菜</h3><ul>${r.ingredients.split('\n').filter(Boolean).map(i => `<li>${i}</li>`).join('')}</ul>`;
  }
  if (r.steps) {
    html += `<h3>👨‍🍳 做法</h3><div class="step-text">${r.steps}</div>`;
  }
  document.getElementById('detail-content').innerHTML = html;
  document.getElementById('modal-detail').classList.add('active');
}

function extractDishName(input) {
  let name = input.replace(/^[\u4e00-\u9fa5]{1,4}(老师|大厨|师傅|的|家的)/, '');
  const match = name.match(/[\u4e00-\u9fa5]{2,6}$/);
  return match ? match[0] : name || input;
}

async function autoImage() {
  const fullName = document.getElementById('recipe-name').value.trim();
  if (!fullName) { toast('请先输入菜名'); return; }

  const dishName = extractDishName(fullName);
  const ingredients = document.getElementById('recipe-ingredients').value.trim();
  const steps = document.getElementById('recipe-steps').value.trim();

  const list = document.getElementById('auto-image-list');
  list.innerHTML = '<div class="loading"><div class="spinner"></div><p class="loading-text">🤖 AI thinking...</p></div>';
  document.getElementById('modal-auto-image').classList.add('active');

  // 根据菜名、配菜、做法生成提示词
  let prompt = `一道中式家常菜「${dishName}」`;
  if (ingredients) {
    const ingList = ingredients.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 5).join('、');
    prompt += `,主要食材:${ingList}`;
  }
  if (steps) {
    const cookingMethods = [];
    if (steps.includes('炒') || steps.includes('翻炒')) cookingMethods.push('大火翻炒');
    if (steps.includes('炖') || steps.includes('焖')) cookingMethods.push('慢炖焖煮');
    if (steps.includes('蒸')) cookingMethods.push('清蒸');
    if (steps.includes('炸') || steps.includes('油炸')) cookingMethods.push('油炸');
    if (steps.includes('烤')) cookingMethods.push('烤制');
    if (steps.includes('凉拌') || steps.includes('拌')) cookingMethods.push('凉拌');
    if (steps.includes('红烧')) cookingMethods.push('红烧');
    if (steps.includes('糖醋')) cookingMethods.push('糖醋');
    if (steps.includes('麻辣') || steps.includes('辣椒') || steps.includes('花椒')) cookingMethods.push('麻辣');
    if (steps.includes('蒜') || steps.includes('蒜末') || steps.includes('蒜蓉')) cookingMethods.push('蒜香');
    if (cookingMethods.length > 0) {
      prompt += `,烹饪方式:${cookingMethods.join('、')}`;
    }
  }
  prompt += `。成品盛盘,色泽诱人,表面油亮,点缀葱花,木制餐桌,暖色自然光,食物摄影,4K超高清,浅景深,逼真写实`;

  console.log('Seedream prompt:', prompt);

  try {
    const { data, error } = await supabase.functions.invoke('generate-image', {
      body: { prompt }
    });

    if (error) {
      list.innerHTML = `<div class="empty-state"><p>生成失败:${error.message}</p></div>`;
      return;
    }

    if (data.error) {
      list.innerHTML = `<div class="empty-state"><p>生成失败:${data.error}</p></div>`;
      return;
    }

    if (!data.url) {
      list.innerHTML = '<div class="empty-state"><p>生成失败,请重试</p></div>';
      return;
    }

    list.innerHTML = `
      <div class="auto-image-result">
        <img src="${data.url}" alt="${dishName}">
        <div class="auto-image-actions">
          <button class="btn-auto-accept" onclick="acceptGeneratedImage('${data.url}')">✅ 使用这张</button>
          <button class="btn-auto-retry" onclick="autoImage()">🔄 重新生成</button>
        </div>
      </div>
    `;
  } catch (e) {
    console.error('Seedream 生成失败:', e);
    list.innerHTML = '<div class="empty-state"><p>生成失败,请重试</p></div>';
  }
}

function acceptGeneratedImage(url) {
  closeAutoImageModal();
  const preview = document.getElementById('image-preview');
  preview.src = url;
  preview.style.display = 'block';
  window._autoImageUrl = url;
  toast('配图成功');
}

async function selectAutoImage(url) {
  closeAutoImageModal();
  toast('正在下载图片...');

  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const file = await compressImage(blob);

    const fileName = Date.now() + '_' + Math.random().toString(36).slice(2) + '.jpg';
    const { error } = await supabase.storage.from('images').upload(fileName, file);
    if (error) { toast('上传失败:' + error.message); return; }

    const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName);

    const preview = document.getElementById('image-preview');
    preview.src = urlData.publicUrl;
    preview.style.display = 'block';

    // 标记已选择图片(保存时使用)
    window._autoImageUrl = urlData.publicUrl;
    toast('配图成功');
  } catch (e) {
    console.error('下载失败:', e);
    toast('下载失败,请重试');
  }
}

function closeAutoImageModal() {
  document.getElementById('modal-auto-image').classList.remove('active');
}



function previewImage(input) {
  const preview = document.getElementById('image-preview');
  if (input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      preview.src = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(input.files[0]);
  } else {
    preview.style.display = 'none';
  }
}

function closeModal() { document.getElementById('modal-recipe').classList.remove('active'); }

function initModalSwipe(modalId, closeFn) {
  const modal = document.getElementById(modalId);
  let startX = 0;
  let startY = 0;
  let swiping = false;

  const onTouchStart = e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    swiping = false;
  };

  const onTouchMove = e => {
    if (!modal.classList.contains('active')) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 20) {
      swiping = true;
    }
  };

  const onTouchEnd = e => {
    if (!swiping) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 80) {
      closeFn();
    }
  };

  modal.addEventListener('touchstart', onTouchStart, { passive: true });
  modal.addEventListener('touchmove', onTouchMove, { passive: true });
  modal.addEventListener('touchend', onTouchEnd, { passive: true });
}
function closeDetailModal() { document.getElementById('modal-detail').classList.remove('active'); }
function closeIngredientsModal() { document.getElementById('modal-ingredients').classList.remove('active'); }

function showIngredients(title, idx) {
  const ingredients = window._mealIngredients[idx];
  if (!ingredients) return;
  document.getElementById('ingredients-modal-title').textContent = title;
  document.getElementById('ingredients-modal-list').innerHTML = ingredients.map(i => `<li>${i.name} x${i.count}</li>`).join('');
  document.getElementById('modal-ingredients').classList.add('active');
}

// 点击遮罩关闭
document.getElementById('modal-recipe').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});
document.getElementById('modal-detail').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeDetailModal();
});
document.getElementById('modal-ingredients').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeIngredientsModal();
});
document.getElementById('modal-auto-image').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeAutoImageModal();
});

async function loadCategories() {
  const { data } = await supabase.from('recipes').select('category');
  const cats = [...new Set((data || []).map(r => r.category).filter(Boolean))];
  document.getElementById('category-list').innerHTML = cats.map(c => `<option value="${c}">`).join('');
}

async function loadOrders() {
  const list = document.getElementById('order-list');
  const summaryEl = document.getElementById('order-summary');
  list.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .neq('status', 'done')
    .order('created_at', { ascending: false });

  if (error) { console.error(error); list.innerHTML = ''; return; }

  if (!orders || orders.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="emoji">📋</div><p>没有未完成的点餐</p></div>';
    summaryEl.innerHTML = '';
    return;
  }

  // 按 meal_id 分组
  const groups = {};
  const noMeal = [];
  orders.forEach(o => {
    if (o.meal_id) {
      if (!groups[o.meal_id]) {
        groups[o.meal_id] = { meal_id: o.meal_id, meal_date: o.meal_date || o.created_at, items: [] };
      }
      groups[o.meal_id].items.push(o);
    } else {
      noMeal.push(o);
    }
  });

  const allDone = items => items.every(i => i.status === 'done');

  const renderItem = o => {
    const dt = new Date(o.created_at);
    const pad = n => String(n).padStart(2, '0');
    const time = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
    const statusHtml = o.status === 'done'
      ? '<span class="status-done">✅ 已完成</span>'
      : `<button class="btn-done" onclick="markDone(${o.id})">✅ 完成</button>`;
    const noteHtml = o.note ? `<div class="order-note">💬 ${o.note}</div>` : '';
    const icon = o.recipe_id ? '🍽️' : '✏️';
    const tag = o.recipe_id ? '' : ' <span class="custom-tag">自定义</span>';
    const viewBtn = o.recipe_id ? `<button class="btn-detail" onclick="viewRecipe(${o.recipe_id})">查看做法</button>` : '';
    return `
      <div class="order-item">
        <div class="order-header">
          <span class="order-member">${o.member}</span>
          <span class="order-time">${time}</span>
        </div>
        <div class="order-recipe">${icon} ${o.recipe_name}${tag}</div>
        ${noteHtml}
        <div class="order-actions">
          ${viewBtn}
          ${o.status !== 'done' ? `<button class="btn-edit-order" onclick="editOrder(${o.id})">✏️ 编辑</button>` : ''}
          ${statusHtml}
          <button class="btn-delete-order" onclick="deleteOrder(${o.id})">🗑️ 删除</button>
        </div>
      </div>
    `;
  };

  const fmt = d => {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const allRecipeIds = [...new Set(orders.map(o => o.recipe_id).filter(Boolean))];
  const recipeIngredients = {};
  if (allRecipeIds.length > 0) {
    const { data: recipes } = await supabase
      .from('recipes')
      .select('id, ingredients')
      .in('id', allRecipeIds);
    if (recipes) {
      recipes.forEach(r => {
        const ings = new Set();
        if (r.ingredients) {
          r.ingredients.split('\n').filter(Boolean).forEach(line => {
            const name = line.trim().split(/[\s\t]+/)[0];
            if (name) ings.add(name);
          });
        }
        recipeIngredients[r.id] = [...ings];
      });
    }
  }

  const getGroupIngredients = items => {
    const countMap = new Map();
    items.forEach(o => {
      (recipeIngredients[o.recipe_id] || []).forEach(ing => {
        countMap.set(ing, (countMap.get(ing) || 0) + 1);
      });
    });
    return [...countMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  };

  let html = '';
  window._mealIngredients = [];
  let ingIdx = 0;

  Object.values(groups).forEach(g => {
    const done = allDone(g.items);
    const groupIngs = getGroupIngredients(g.items);
    window._mealIngredients.push(groupIngs);
    const idx = ingIdx++;
    html += `
      <div class="meal-group">
        <div class="meal-group-header">
          <span class="meal-group-time">🕐 ${fmt(new Date(g.meal_date))}</span>
          <div class="meal-group-header-right">
            ${groupIngs.length > 0 ? `<button class="btn-ingredients" onclick="showIngredients('该餐食材', ${idx})">🥬 食材</button>` : ''}
            ${done
              ? '<span class="status-done">✅ 全部完成</span>'
              : `<button class="btn-done" onclick="markMealDone('${g.meal_id}')">✅ 全部完成</button>`
            }
          </div>
        </div>
        <div class="meal-group-items">
          ${g.items.map(renderItem).join('')}
        </div>
      </div>
    `;
  });

  if (noMeal.length > 0) {
    const noMealIngs = getGroupIngredients(noMeal);
    window._mealIngredients.push(noMealIngs);
    const idx = ingIdx++;
    html += `
      <div class="meal-group">
        <div class="meal-group-header">
          <span class="meal-group-time">📋 其他订单</span>
          <div class="meal-group-header-right">
            ${noMealIngs.length > 0 ? `<button class="btn-ingredients" onclick="showIngredients('该餐食材', ${idx})">🥬 食材</button>` : ''}
          </div>
        </div>
        <div class="meal-group-items">
          ${noMeal.map(renderItem).join('')}
        </div>
      </div>
    `;
  }

  list.innerHTML = html || '<div class="empty-state"><div class="emoji">📋</div><p>今天还没有人点餐</p></div>';

  const summary = {};
  orders.forEach(o => {
    if (!summary[o.recipe_name]) summary[o.recipe_name] = 0;
    summary[o.recipe_name]++;
  });
  const total = orders.length;

  summaryEl.innerHTML = `
    <h3>📊 未完成汇总(共 ${total} 份)</h3>
    ${Object.entries(summary).map(([name, count]) =>
      `<div class="summary-item"><span>${name}</span><span class="count">${count} 份</span></div>`
    ).join('')}
  `;
}

async function markDone(id) {
  const { error } = await supabase.from('orders').update({ status: 'done' }).eq('id', id);
  if (error) { toast('操作失败'); return; }
  loadOrders();
}

async function markMealDone(mealId) {
  const { error } = await supabase
    .from('orders')
    .update({ status: 'done' })
    .eq('meal_id', mealId);
  if (error) { toast('操作失败'); return; }
  loadOrders();
}

async function deleteOrder(id) {
  if (!confirm('确定删除这条点餐记录?')) return;
  const { error } = await supabase.from('orders').delete().eq('id', id);
  if (error) { toast('删除失败:' + error.message); return; }
  loadOrders();
  toast('已删除');
}

// editOrder / saveEditOrder / closeEditOrderModal 由 common.js 提供

function editOrder(id) {
  openEditOrderModal(id);
}

// 编辑订单弹窗点击遮罩关闭
document.getElementById('modal-edit-order').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeEditOrderModal();
});

async function loadHistoryOrders() {
  const list = document.getElementById('history-list');
  list.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'done')
    .order('created_at', { ascending: false });

  if (error) { console.error(error); list.innerHTML = ''; return; }

  if (!orders || orders.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="emoji">✅</div><p>还没有已完成的点餐</p></div>';
    return;
  }

  // 按日期分组
  const dateGroups = {};
  orders.forEach(o => {
    const dt = new Date(o.created_at);
    const pad = n => String(n).padStart(2, '0');
    const dateKey = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
    if (!dateGroups[dateKey]) dateGroups[dateKey] = [];
    dateGroups[dateKey].push(o);
  });

  let html = '';
  Object.entries(dateGroups).forEach(([date, dayOrders]) => {
    // 按 meal_id 分组
    const groups = {};
    const noMeal = [];
    dayOrders.forEach(o => {
      if (o.meal_id) {
        if (!groups[o.meal_id]) {
          groups[o.meal_id] = { meal_id: o.meal_id, meal_date: o.meal_date || o.created_at, items: [] };
        }
        groups[o.meal_id].items.push(o);
      } else {
        noMeal.push(o);
      }
    });

    const allDone = items => items.every(i => i.status === 'done');
    const fmt = d => {
      const pad = n => String(n).padStart(2, '0');
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    let dayHtml = '';
    Object.values(groups).forEach(g => {
      const done = allDone(g.items);
      dayHtml += `
        <div class="meal-group">
          <div class="meal-group-header">
            <span class="meal-group-time">🕐 ${fmt(new Date(g.meal_date))}</span>
            <div class="meal-group-header-right">
              ${done ? '<span class="status-done">✅ 全部完成</span>' : '<span class="status-pending">⏳ 未完成</span>'}
            </div>
          </div>
          <div class="meal-group-items">
            ${g.items.map(o => {
              const statusHtml = o.status === 'done'
                ? '<span class="status-done">✅ 已完成</span>'
                : '<span class="status-pending">⏳ 未完成</span>';
              const noteHtml = o.note ? `<div class="order-note">💬 ${o.note}</div>` : '';
              const icon = o.recipe_id ? '🍽️' : '✏️';
              const tag = o.recipe_id ? '' : ' <span class="custom-tag">自定义</span>';
              const viewBtn = o.recipe_id ? `<button class="btn-detail" onclick="viewRecipe(${o.recipe_id})">查看做法</button>` : '';
              return `
                <div class="order-item">
                  <div class="order-header">
                    <span class="order-member">${o.member}</span>
                  </div>
                  <div class="order-recipe">${icon} ${o.recipe_name}${tag}</div>
                  ${noteHtml}
                  <div class="order-actions">
                    ${viewBtn}
                    ${statusHtml}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });

    if (noMeal.length > 0) {
      dayHtml += `
        <div class="meal-group">
          <div class="meal-group-header">
            <span class="meal-group-time">📋 其他订单</span>
          </div>
          <div class="meal-group-items">
            ${noMeal.map(o => {
              const statusHtml = o.status === 'done'
                ? '<span class="status-done">✅ 已完成</span>'
                : '<span class="status-pending">⏳ 未完成</span>';
              const noteHtml = o.note ? `<div class="order-note">💬 ${o.note}</div>` : '';
              const icon = o.recipe_id ? '🍽️' : '✏️';
              const tag = o.recipe_id ? '' : ' <span class="custom-tag">自定义</span>';
              const viewBtn = o.recipe_id ? `<button class="btn-detail" onclick="viewRecipe(${o.recipe_id})">查看做法</button>` : '';
              return `
                <div class="order-item">
                  <div class="order-header">
                    <span class="order-member">${o.member}</span>
                  </div>
                  <div class="order-recipe">${icon} ${o.recipe_name}${tag}</div>
                  ${noteHtml}
                  <div class="order-actions">
                    ${viewBtn}
                    ${statusHtml}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // 汇总
    const summary = {};
    dayOrders.forEach(o => {
      if (!summary[o.recipe_name]) summary[o.recipe_name] = 0;
      summary[o.recipe_name]++;
    });

    html += `
      <div class="history-date-group">
        <h2 class="history-date-title">✅ ${date}(共 ${dayOrders.length} 份)</h2>
        ${dayHtml}
        <div class="order-summary">
          <h3>📊 当日汇总</h3>
          ${Object.entries(summary).map(([name, count]) =>
            `<div class="summary-item"><span>${name}</span><span class="count">${count} 份</span></div>`
          ).join('')}
        </div>
      </div>
    `;
  });

  list.innerHTML = html;
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

initModalSwipe('modal-recipe', closeModal);
initModalSwipe('modal-detail', closeDetailModal);
loadAdminRecipes();
