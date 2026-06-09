/**
 * 公共模块 - 编辑订单弹窗逻辑（app.js 和 admin.js 共用）
 */

async function openEditOrderModal(id) {
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', id).single();
  if (error || !order) { toast('加载失败'); return; }

  const { data: recipes } = await supabase.from('recipes').select('id, name').order('name');
  const select = document.getElementById('edit-order-recipe');
  const customInput = document.getElementById('edit-order-custom');
  const isCustom = !order.recipe_id;

  select.innerHTML = `<option value="__custom">✏️ 自定义输入</option>` + (recipes || []).map(r =>
    `<option value="${r.id}"${r.id === order.recipe_id ? ' selected' : ''}>${r.name}</option>`
  ).join('');

  if (isCustom) {
    select.value = '__custom';
    customInput.value = order.recipe_name;
    customInput.style.display = 'block';
  } else {
    customInput.style.display = 'none';
    customInput.value = '';
  }

  document.getElementById('edit-order-id').value = id;
  document.getElementById('edit-order-note').value = order.note || '';
  document.getElementById('modal-edit-order').classList.add('active');
}

function toggleEditCustom() {
  const select = document.getElementById('edit-order-recipe');
  const customInput = document.getElementById('edit-order-custom');
  customInput.style.display = select.value === '__custom' ? 'block' : 'none';
}

async function saveEditOrder(callback) {
  const id = document.getElementById('edit-order-id').value;
  const select = document.getElementById('edit-order-recipe');
  const customInput = document.getElementById('edit-order-custom');
  const note = document.getElementById('edit-order-note').value.trim();

  let recipeId, recipeName;
  if (select.value === '__custom') {
    recipeName = customInput.value.trim();
    if (!recipeName) { toast('请输入菜名'); return; }
    recipeId = null;
  } else {
    recipeId = parseInt(select.value);
    recipeName = select.options[select.selectedIndex].text;
  }

  const { error } = await supabase.from('orders').update({
    recipe_id: recipeId,
    recipe_name: recipeName,
    note: note
  }).eq('id', id);

  if (error) { toast('保存失败：' + error.message); return; }

  closeEditOrderModal();
  toast('已修改');
  if (callback) callback();
}

function closeEditOrderModal() {
  document.getElementById('modal-edit-order').classList.remove('active');
}
