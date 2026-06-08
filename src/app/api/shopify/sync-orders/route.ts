import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { syncShopifyOrders } from '@/lib/shopify'

export async function POST(req: NextRequest) {
  const { since } = await req.json().catch(() => ({}))
  const db = createServerClient()

  try {
    const orders = await syncShopifyOrders(since)
    let inserted = 0
    let updated = 0

    for (const order of orders) {
      const record = {
        shopify_order_id: order.id.toString(),
        order_number: order.name,
        order_date: order.created_at,
        customer_name: order.customer
          ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
          : null,
        customer_email: order.customer?.email || null,
        total_price: parseFloat(order.total_price || '0'),
        subtotal_price: parseFloat(order.subtotal_price || '0'),
        total_tax: parseFloat(order.total_tax || '0'),
        total_discounts: parseFloat(order.total_discounts || '0'),
        financial_status: order.financial_status,
        fulfillment_status: order.fulfillment_status,
        line_items: order.line_items,
      }

      const { data: existing } = await db
        .from('shopify_orders')
        .select('id')
        .eq('shopify_order_id', record.shopify_order_id)
        .single()

      if (existing) {
        await db.from('shopify_orders').update(record).eq('shopify_order_id', record.shopify_order_id)
        updated++
      } else {
        await db.from('shopify_orders').insert(record)
        inserted++
      }
    }

    return NextResponse.json({
      success: true,
      total: orders.length,
      inserted,
      updated,
      message: `Synced ${orders.length} orders (${inserted} new, ${updated} updated)`,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
