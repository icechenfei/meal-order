import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const SERVERCHAN_KEY = ***'SERVERCHAN_KEY') || ''

serve(async (req) => {
  try {
    const payload = await req.json()
    
    // 从 Webhook payload 中提取订单信息
    const { type, table, record } = payload
    
    // 只处理 orders 表的 INSERT 事件
    if (table !== 'orders' || type !== 'INSERT') {
      return new Response('OK', { status: 200 })
    }
    
    const { member, recipe_name, note } = record
    
    // 构建消息
    const title = `🍽️ 新订单：${recipe_name}`
    let desp = `**点餐人**：${member}\n`
    desp += `**菜品**：${recipe_name}\n`
    if (note) {
      desp += `**备注**：${note}\n`
    }
    desp += `\n---\n*来自家庭点餐系统*`
    
    // 调用 Server酱 API
    const url = `https://sctapi.ftqq.com/${SERVERCHAN_KEY}.send`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, desp }),
    })
    
    const result = await response.json()
    console.log('Server酱响应:', result)
    
    return new Response(JSON.stringify({ success: true, result }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('错误:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
