# Supabase RLS 权限配置

## 概述

在 Supabase 中启用 Row Level Security (RLS)，为 `recipes` 和 `orders` 表添加后端权限控制，确保即使绕过前端也无法越权操作。

## 配置步骤

### 1. 创建 profiles 表

```sql
-- 创建 profiles 表，关联 auth.users
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建触发器：用户注册时自动创建 profile
CREATE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### 2. 为已有用户创建 profile 记录

```sql
-- 为所有已有用户补全 profiles 记录
INSERT INTO profiles (id, role)
SELECT id, COALESCE(raw_user_meta_data->>'role', 'user')
FROM auth.users
ON CONFLICT (id) DO NOTHING;
```

### 3. 设置管理员角色

通过 Supabase Dashboard：
- **Authentication → Users → 选择用户**
- 在 **Raw User Meta Data** 中添加 `"role": "admin"`
- 或者手动更新 profiles 表：

```sql
UPDATE profiles SET role = 'admin' WHERE id = '<user-uuid>';
```

### 4. recipes 表 RLS 策略

```sql
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- 所有人可读
CREATE POLICY "recipes_select" ON recipes
  FOR SELECT USING (true);

-- 仅 admin 可新增
CREATE POLICY "recipes_insert" ON recipes
  FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- 仅 admin 可更新
CREATE POLICY "recipes_update" ON recipes
  FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- 仅 admin 可删除
CREATE POLICY "recipes_delete" ON recipes
  FOR DELETE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
```

### 5. orders 表 RLS 策略

> **注意：** 当前 orders 表没有 `user_id` 字段，无法严格校验"自己的订单"。
> 如需完整实现，先执行以下语句添加字段：

```sql
ALTER TABLE orders ADD COLUMN user_id UUID REFERENCES auth.users;
```

更新订单数据的 user_id（可选，已有订单会设为 NULL）：

```sql
-- 当前无法追溯 user_id，新订单需要由前端传入
```

然后执行 RLS 配置：

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 所有人可读
CREATE POLICY "orders_select" ON orders
  FOR SELECT USING (true);

-- 登录用户可插入自己的订单（如果已添加 user_id 列）
CREATE POLICY "orders_insert" ON orders
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- admin 可更新所有订单
CREATE POLICY "orders_update" ON orders
  FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- admin 可删除所有订单
CREATE POLICY "orders_delete" ON orders
  FOR DELETE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
```

### 6. 前端 JS 配套改动

如果添加了 `user_id` 列，下单时需要传入当前用户 ID：

```javascript
// js/app.js — placeOrder 函数中
const { data: { session } } = await supabase.auth.getSession();

const { error } = await supabase.from('orders').insert({
  user_id: session?.user?.id,  // 新增
  member: currentMember,
  recipe_id: currentRecipe.id,
  recipe_name: currentRecipe.name,
  note: note,
  status: 'pending'
});
```

## 验证方法

在 Supabase Dashboard 中：
1. **SQL Editor** 中逐条执行以上 SQL
2. 用普通用户的 anon key 尝试通过 API 直接 INSERT/DELETE recipes，应被拒绝
3. 用普通用户的 anon key 尝试通过 API 直接 UPDATE/DELETE orders，应被拒绝

## 回滚方法

如需移除 RLS，执行：

```sql
ALTER TABLE recipes DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recipes_select ON recipes;
DROP POLICY IF EXISTS recipes_insert ON recipes;
DROP POLICY IF EXISTS recipes_update ON recipes;
DROP POLICY IF EXISTS recipes_delete ON recipes;
DROP POLICY IF EXISTS orders_select ON orders;
DROP POLICY IF EXISTS orders_insert ON orders;
DROP POLICY IF EXISTS orders_update ON orders;
DROP POLICY IF EXISTS orders_delete ON orders;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user;
DROP TABLE IF EXISTS profiles;
```
