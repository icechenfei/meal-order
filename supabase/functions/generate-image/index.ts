import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SEEDREAM_API_KEY = Deno.env.get('SEEDREAM_API_KEY') || ''
const SEEDREAM_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

serve(async (req) => {
  try {
    const { prompt } = await req.json()

    // 1. 调用 Seedream 生成图片
    const genRes = await fetch(SEEDREAM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SEEDREAM_API_KEY}`
      },
      body: JSON.stringify({
        model: 'doubao-seedream-4-5-251128',
        prompt,
        sequential_image_generation: 'disabled',
        response_format: 'url',
        size: '2048x2048',
        stream: false,
        watermark: false
      })
    })

    const genData = await genRes.json()
    if (!genData.data || genData.data.length === 0) {
      return new Response(JSON.stringify({ error: '图片生成失败' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 2. 下载图片
    const imgRes = await fetch(genData.data[0].url)
    const imgBlob = new Uint8Array(await imgRes.arrayBuffer())

    // 3. 上传到 Supabase Storage
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const fileName = `seedream/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(fileName, imgBlob, { contentType: 'image/jpeg' })

    if (uploadError) {
      return new Response(JSON.stringify({ error: '上传失败: ' + uploadError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 4. 返回公开 URL
    const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName)

    return new Response(JSON.stringify({ url: urlData.publicUrl }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
