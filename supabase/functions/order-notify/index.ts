import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const WECHAT_WEBHOOK = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=5374b6dd-6759-40e2-8ecd-627410c02036'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

serve(async (req) => {
  try {
    const payload = await req.json()
    const { type, table, record } = payload

    if (table !== 'orders' || type !== 'INSERT') {
      return new Response('OK', { status: 200 })
    }

    // 已通知过的跳过（同 meal_id 的后续订单）
    if (record.notified) {
      return new Response('OK', { status: 200 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // 查同一次提交的所有菜品
    const { data: orders } = await supabase
      .from('orders')
      .select('member, recipe_name, note, recipe_id')
      .eq('meal_id', record.meal_id)

    if (!orders || orders.length === 0) {
      return new Response('OK', { status: 200 })
    }

    const first = orders[0]
    const icon = first.recipe_id ? '🍽️' : '✏️'
    const dishList = orders.map((o: any, i: number) => {
      let line = `${i + 1}. ${o.recipe_name}`
      if (o.note) line += `（${o.note}）`
      return line
    }).join('\n')

    let content = `${icon} 新订单（${orders.length}道菜）\n`
    content += `点餐人：${first.member}\n`
    content += `${dishList}`

    const body = JSON.stringify({
      msgtype: 'text',
      text: { content }
    })

    await fetch(WECHAT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    })

    return new Response(JSON.stringify({ success: true }), {
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
