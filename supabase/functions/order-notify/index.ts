import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const WECHAT_WEBHOOK = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=5374b6dd-6759-40e2-8ecd-627410c02036'

serve(async (req) => {
  try {
    const payload = await req.json()
    const { type, table, record } = payload

    if (table !== 'orders' || type !== 'INSERT') {
      return new Response('OK', { status: 200 })
    }

    const { member, recipe_name, note, recipe_id } = record
    const icon = recipe_id ? '🍽️' : '✏️'

    // 构建 Markdown 消息
    let content = `### ${icon} 新订单：${recipe_name}\n`;
    content += `> **点餐人**：${member}\n`;
    content += `> **菜品**：${recipe_name}\n`;
    if (note) content += `> **备注**：${note}\n`;

    const body = JSON.stringify({
      msgtype: 'markdown',
      markdown: { content }
    })

    const response = await fetch(WECHAT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    })

    const result = await response.json()
    console.log('企业微信响应:', result)

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
