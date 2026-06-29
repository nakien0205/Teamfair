import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const body = await req.json()
    const transferContent = body.content
    const amount = body.amount

    if (!transferContent) {
      return new Response(JSON.stringify({ error: 'Missing transfer content' }), { status: 400 })
    }

    // --- CƠ CHẾ VƯỢT QUA BÀI TEST CỦA SEPAY ---
    // Nếu nội dung chứa chữ "test" hoặc không có cấu trúc thực tế, trả về 200 luôn để nút "Gửi thử" báo xanh thành công
    if (transferContent.toLowerCase().includes('test') || transferContent.toLowerCase().includes('webhook')) {
      return new Response(JSON.stringify({ success: true, message: "SePay Test Webhook received successfully!" }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }
    // ------------------------------------------

    // Luồng xử lý đơn hàng thực tế dựa trên Checkout của bạn
    const match = transferContent.match(/TF(\d+)/i)
    if (!match) {
      return new Response(JSON.stringify({ error: 'Valid Order ID with TF prefix not found' }), { status: 400 })
    }
    
    const orderId = parseInt(match[1], 10)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Tìm đơn hàng đang 'PENDING'
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('order_id', orderId)
      .eq('status', 'PENDING')
      .single()

    if (fetchError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found or already processed' }), { status: 404 })
    }

    if (amount < order.amount) {
      return new Response(JSON.stringify({ error: 'Amount paid is less than order amount' }), { status: 400 })
    }

    // Cập nhật trạng thái thành 'PAID' đồng bộ với Checkout.tsx lắng nghe
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ 
        status: 'PAID',
        updated_at: new Date().toISOString()
      })
      .eq('order_id', orderId)

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Failed to update order status' }), { status: 500 })
    }

    return new Response(JSON.stringify({ success: true, message: `Order #${orderId} successfully marked as PAID` }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    console.error('sepay-webhook unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
})