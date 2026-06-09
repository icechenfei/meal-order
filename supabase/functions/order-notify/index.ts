import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webpush from "https://esm.sh/web-push@3.6.6"

const SERVERCHAN_KEY = Deno.env.get('SERVERCHAN_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || ''

webpush.setVapidDetails('mailto:admin@meal-order', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

serve(async (req) => {
  try {
    const payload = await req.json()
    const { type, table, record } = payload

    // 只处理 orders 表的 INSERT 事件
    if (table !== 'orders' || type !== 'INSERT') {
      return new Response('OK', { status: 200 })
    }

    const { member, recipe_name, note, recipe_id } = record

    // === 1. Server酱推送 ===
    if (SERVERCHAN_KEY) {
      const title = `🍽️ 新订单：${recipe_name}`
      let desp = `**点餐人**：${member}\n`
      desp += `**菜品**：${recipe_name}\n`
      if (note) desp += `**备注**：${note}\n`
      desp += `\n---\n*来自家庭点餐系统*`

      const url = `https://sctapi.ftqq.com/${SERVERCHAN_KEY}.send`
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, desp }),
      })
    }

    // === 2. Web Push 推送 ===
    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
      const { data: subs } = await supabase.from('push_subscriptions').select('subscription')

      if (subs && subs.length > 0) {
        const icon = recipe_id ? '🍽️' : '✏️'
        const pushPayload = JSON.stringify({
          title: `${icon} ${recipe_name}`,
          body: `${member} 点了一道菜${note ? '：' + note : ''}`,
          tag: 'new-order-' + record.id,
          url: '/meal-order/admin.html'
        })

        for (const sub of subs) {
          try {
            await webpush.sendNotification(sub.subscription, pushPayload)
          } catch (e) {
            console.error('Push 发送失败:', e.message)
            // 失败的订阅清理掉
            if (e.statusCode === 410) {
              await supabase.from('push_subscriptions')
                .delete()
                .eq('subscription', sub.subscription)
            }
          }
        }
      }
    }

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
