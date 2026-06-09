let editingId = null;
window._mealIngredients = [];
let _allRecipes = [];
let _adminCategory = '全部';
let _adminSearchQuery = '';


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
  if (cats.length <= 1) { bar.innerHTML = ''; return; }
  const allCats = ['全部', ...cats];
  bar.innerHTML = allCats.map(c =>
    `<button class="category-tag${c === _adminCategory ? ' active' : ''}" onclick="selectAdminCategory('${c}')">${c}</button>`
  ).join('');
}

function selectAdminCategory(cat) {
  _adminCategory = cat;
  document.querySelectorAll('#admin-category-bar .category-tag').forEach(t => {
    t.classList.toggle('active', t.textContent === cat);
  });
  renderAdminRecipes();
}

function onAdminSearchInput() {
  _adminSearchQuery = document.getElementById('admin-recipe-search').value.trim().toLowerCase();
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

  if (data.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="emoji">📖</div><p>还没有菜谱，点击“添加”创建</p></div>';
    return;
  }

  list.innerHTML = data.map(r => {
    const thumb = r.image
      ? `<img class="thumb" src="${r.image}">`
      : '<div class="thumb-placeholder">🍲</div>';
    return `
      <div class="admin-recipe-item">
        ${thumb}
        <div class="info">
          <h3>${r.name}</h3>
          <span class="cat">${r.category || '其他'}</span>
        </div>
        <div class="actions">
          <button class="btn-view" onclick="viewRecipe(${r.id})">查看</button>
          <button class="btn-edit" onclick="editRecipe(${r.id})">编辑</button>
          <button class="btn-delete" onclick="deleteRecipe(${r.id})">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

function showAddRecipe() {
  editingId = null;
  window._autoImageUrl = null;
  document.getElementById('modal-title').textContent = '添加菜谱';
  document.getElementById('recipe-form').reset();
  document.getElementById('recipe-id').value = '';
  document.getElementById('image-preview').style.display = 'none';
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

  document.getElementById('modal-recipe').classList.add('active');
  loadCategories();
}

async function saveRecipe(e) {
  e.preventDefault();

  const name = document.getElementById('recipe-name').value.trim();
  if (!name) { toast('请输入菜名'); return; }

  const data = {
    name,
    category: document.getElementById('recipe-category').value.trim() || '其他',
    ingredients: document.getElementById('recipe-ingredients').value.trim(),
    steps: document.getElementById('recipe-steps').value.trim(),
  };

  const fileInput = document.getElementById('recipe-image');
  if (fileInput.files[0]) {
    const file = fileInput.files[0];
    if (file.size > 5 * 1024 * 1024) { toast('图片不能超过 5MB'); return; }
    const ext = file.name.split('.').pop();
    const fileName = Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
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
  list.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  document.getElementById('modal-auto-image').classList.add('active');

  // 根据菜名、配菜、做法生成提示词
  let prompt = `一道中式家常菜「${dishName}」`;
  if (ingredients) {
    const ingList = ingredients.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 5).join('、');
    prompt += `，主要食材：${ingList}`;
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
      prompt += `，烹饪方式：${cookingMethods.join('、')}`;
    }
  }
  prompt += `。成品盛盘，色泽诱人，表面油亮，点缀葱花，木制餐桌，暖色自然光，食物摄影，4K超高清，浅景深，逼真写实`;

  console.log('Seedream prompt:', prompt);

  try {
    const res = await fetch(SEEDREAM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SEEDREAM_API_KEY}`
      },
      body: JSON.stringify({
        model: 'doubao-seedream-4-5-251128',
        prompt: prompt,
        sequential_image_generation: 'disabled',
        response_format: 'url',
        size: '1024x1024',
        stream: false,
        watermark: false
      })
    });

    const data = await res.json();

    if (data.error) {
      list.innerHTML = `<div class="empty-state"><p>生成失败：${data.error.message || '未知错误'}</p></div>`;
      return;
    }

    if (!data.data || data.data.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>生成失败，请重试</p></div>';
      return;
    }

    list.innerHTML = `
      <div class="auto-image-result">
        <img src="${data.data[0].url}" alt="${dishName}">
        <div class="auto-image-actions">
          <button class="btn-auto-accept" onclick="acceptGeneratedImage('${data.data[0].url}')">✅ 使用这张</button>
          <button class="btn-auto-retry" onclick="autoImage()">🔄 重新生成</button>
        </div>
      </div>
    `;
  } catch (e) {
    console.error('Seedream 生成失败:', e);
    list.innerHTML = '<div class="empty-state"><p>生成失败，请重试</p></div>';
  }
}

async function acceptGeneratedImage(url) {
  closeAutoImageModal();
  toast('正在上传图片...');

  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const file = new File([blob], 'recipe.jpg', { type: 'image/jpeg' });

    const fileName = Date.now() + '_' + Math.random().toString(36).slice(2) + '.jpg';
    const { error } = await supabase.storage.from('images').upload(fileName, file);
    if (error) { toast('上传失败：' + error.message); return; }

    const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName);

    const preview = document.getElementById('image-preview');
    preview.src = urlData.publicUrl;
    preview.style.display = 'block';

    window._autoImageUrl = urlData.publicUrl;
    toast('配图成功');
  } catch (e) {
    console.error('上传失败:', e);
    toast('上传失败，请重试');
  }
}

async function selectAutoImage(url) {
  closeAutoImageModal();
  toast('正在下载图片...');

  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const file = new File([blob], 'recipe.jpg', { type: 'image/jpeg' });

    const fileName = Date.now() + '_' + Math.random().toString(36).slice(2) + '.jpg';
    const { error } = await supabase.storage.from('images').upload(fileName, file);
    if (error) { toast('上传失败：' + error.message); return; }

    const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName);

    const preview = document.getElementById('image-preview');
    preview.src = urlData.publicUrl;
    preview.style.display = 'block';

    // 标记已选择图片（保存时使用）
    window._autoImageUrl = urlData.publicUrl;
    toast('配图成功');
  } catch (e) {
    console.error('下载失败:', e);
    toast('下载失败，请重试');
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

  const today = new Date();
  const ymd = today.toISOString().split('T')[0];

  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .gte('created_at', ymd + 'T00:00:00')
    .order('created_at', { ascending: false });

  if (error) { console.error(error); list.innerHTML = ''; return; }

  if (!orders || orders.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="emoji">📋</div><p>今天还没有人点餐</p></div>';
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
            ${noMealIngs.length > 0 ? `<button class="btn-ingredients" onclick="showIngredients('今日食材', ${idx})">🥬 食材</button>` : ''}
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
    <h3>📊 今日汇总(共 ${total} 份)</h3>
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

  const today = new Date();
  const ymd = today.toISOString().split('T')[0];

  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .lt('created_at', ymd + 'T00:00:00')
    .order('created_at', { ascending: false });

  if (error) { console.error(error); list.innerHTML = ''; return; }

  if (!orders || orders.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="emoji">📅</div><p>还没有历史点餐记录</p></div>';
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
        <h2 class="history-date-title">📅 ${date}（共 ${dayOrders.length} 份）</h2>
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

loadAdminRecipes();
