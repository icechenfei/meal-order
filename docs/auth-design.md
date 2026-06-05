# 点餐系统权限设计文档

## 背景

当前系统所有登录用户都能访问点餐页面和厨房管理页面，需要区分「普通用户」和「管理员」角色。

## 设计方案

采用 **Supabase user_metadata** 存储角色信息，前端根据角色控制页面访问权限。

### 角色定义

| 角色 | 权限 | 说明 |
|------|------|------|
| 普通用户（默认） | 点餐页面（index.html） | 家庭成员 |
| 管理员 | 点餐 + 厨房管理（admin.html） | 厨师/家长 |

### 技术实现

#### 1. 存储方式：user_metadata

在 Supabase Auth 的 `user.user_metadata` 中存储 `role` 字段：

```json
{
  "role": "admin"
}
```

- 普通用户：无 role 字段或 `role: "user"`
- 管理员：`role: "admin"`

#### 2. 设置管理员（手动操作）

在 Supabase Dashboard 中操作：
- Authentication → 选择用户 → Raw User Meta Data
- 添加 `"role": "admin"`

或通过 API（service_role key）：
```bash
curl -X PUT "https://yrqparacjtjkgozfwsqj.supabase.co/auth/v1/admin/users/{user_id}" \
  -H "Authorization: Bearer {service_role_key}" \
  -H "Content-Type: application/json" \
  -d '{"user_metadata": {"role": "admin"}}'
```

#### 3. 前端改动

**新增 `js/auth.js`** — 统一认证模块：
```javascript
// 获取当前用户角色
async function getUserRole() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return session.user.user_metadata?.role || 'user';
}

// 检查是否为管理员
async function isAdmin() {
  return (await getUserRole()) === 'admin';
}

// 通用认证检查（所有页面调用）
async function checkAuth(requiredRole = 'user') {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'login.html?redirect=' + encodeURIComponent(location.pathname);
    return null;
  }
  const role = session.user.user_metadata?.role || 'user';
  if (requiredRole === 'admin' && role !== 'admin') {
    window.location.href = 'index.html'; // 非管理员跳转首页
    return null;
  }
  return session;
}
```

**index.html 改动**：
- 引入 `js/auth.js`
- 调用 `checkAuth('user')`（所有登录用户可访问）
- 如果用户是管理员，显示「厨房管理」入口按钮

**admin.html 改动**：
- 引入 `js/auth.js`
- 调用 `checkAuth('admin')`（仅管理员可访问）
- 非管理员自动跳转到 index.html

**login.html 改动**：
- 登录成功后，检查角色决定跳转目标
- 管理员可选跳转到 admin.html

#### 4. 页面入口控制

index.html 底部或顶部增加管理员入口：
```html
<div id="admin-entry" style="display:none">
  <a href="admin.html" class="btn-admin">🔧 厨房管理</a>
</div>
```

### 安全说明

⚠️ 此方案为**前端权限控制**，安全性有限（用户可手动访问 admin.html URL）。

如需更强安全性，后续可：
1. 使用 Supabase RLS + profiles 表做后端权限校验
2. 或使用 Supabase Edge Functions 做服务端鉴权

对于家庭内部使用的点餐系统，前端控制已够用。

### 改动文件清单

| 文件 | 改动内容 |
|------|----------|
| `js/auth.js` | 新增，统一认证模块 |
| `login.html` | 登录后根据角色跳转 |
| `index.html` | 调用 checkAuth，管理员显示厨房管理入口 |
| `admin.html` | 调用 checkAuth('admin')，非管理员跳转 |
| `css/style.css` | 管理员入口按钮样式 |

### Supabase 后台操作

1. 创建用户：Authentication → Users → Add User
2. 设置管理员：选择用户 → Raw User Meta Data → `{"role": "admin"}`
