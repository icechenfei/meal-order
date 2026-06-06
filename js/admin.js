let editingId = null;
window._mealIngredients = [];

function showAdminTab(tab, btn) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  btn.classList.add('active');
  if (tab === 'recipes') loadAdminRecipes();
  if (tab === 'orders') loadOrders();
}

async function loadAdminRecipes() {
  const list = document.getElementById('admin-recipe-list');
  list.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error(error); list.innerHTML = ''; return; }

  if (!data || data.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="emoji">📖</div><p>还没有菜谱，点击"添加"创建</p></div>';
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
    if (uploadError) { toast('图片上传失败：' + uploadError.message); return; }
    const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName);
    data.image = urlData.publicUrl;
  }

  const { error } = editingId
    ? await supabase.from('recipes').update(data).eq('id', editingId)
    : await supabase.from('recipes').insert(data);

  if (error) { toast('保存失败：' + error.message); return; }

  closeModal();
  loadAdminRecipes();
  toast('保存成功');
}

async function deleteRecipe(id) {
  if (!confirm('确定删除这个菜谱？')) return;

  const { data: r } = await supabase.from('recipes').select('image').eq('id', id).single();
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) { toast('删除失败：' + error.message); return; }

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
    return `
      <div class="order-item">
        <div class="order-header">
          <span class="order-member">${o.member}</span>
          <span class="order-time">${time}</span>
        </div>
        <div class="order-recipe">🍽️ ${o.recipe_name}</div>
        ${noteHtml}
        <div class="order-actions">
          <button class="btn-detail" onclick="viewRecipe(${o.recipe_id})">查看做法</button>
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
    <h3>📊 今日汇总（共 ${total} 份）</h3>
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
  if (!confirm('确定删除这条点餐记录？')) return;
  const { error } = await supabase.from('orders').delete().eq('id', id);
  if (error) { toast('删除失败：' + error.message); return; }
  loadOrders();
  toast('已删除');
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
loadOrders();
