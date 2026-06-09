# 订单推送配置说明

## 功能说明

当有新订单时，自动通过企业微信群机器人 Webhook 推送通知。

## 部署步骤

### 1. 安装 Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Windows
scoop install supabase

# Linux
curl -fsSL https://cli.supabase.com/install.sh | sh
```

### 2. 登录 Supabase

```bash
supabase login
```

### 3. 关联项目

```bash
cd /root/.openclaw/workspace/meal-order
supabase link --project-ref yrqparacjtjkgozfwsqj
```

### 4. 部署 Edge Function

```bash
supabase functions deploy order-notify
```

### 5. 创建 Database Webhook

在 Supabase Dashboard 中操作：

1. 进入 **Database** → **Webhooks**
2. 点击 **Create a new webhook**
3. 填写配置：
   - **Name**: `order-notify`
   - **Table**: `orders`
   - **Events**: 勾选 `INSERT`
   - **Type**: HTTP Request
   - **Method**: POST
   - **URL**: `https://yrqparacjtjkgozfwsqj.supabase.co/functions/v1/order-notify`
   - **Headers**:
     - `Authorization`: `Bearer {你的 supabase service_role key}`
     - `Content-Type`: `application/json`
4. 点击 **Save**

## 测试

1. 在点餐系统提交一个订单
2. 检查企业微信群是否收到通知
3. 查看 Supabase Edge Function 日志：
   ```bash
   supabase functions logs order-notify
   ```

## 消息格式

```markdown
### 🍽️ 新订单：红烧肉
> **点餐人**：xxx@xxx.com
> **菜品**：红烧肉
> **备注**：少放盐（如果有）
```

## 注意事项

1. 企业微信群机器人 Webhook 无频率限制，家庭使用完全够用
2. Webhook Key 已硬编码在 Edge Function 中，无需额外配置环境变量
3. Edge Function 有免费额度，每月 50 万次调用
4. 确保 supabase service_role key 安全，不要泄露

## 可选优化

- [ ] 合并同一顿饭的多个订单为一条消息（等所有菜都点完再通知）
- [ ] 支持订单完成通知（厨师标记完成时通知点餐人）
- [ ] 支持取消订单通知
