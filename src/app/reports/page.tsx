import { createServerClient } from '@/lib/supabase'
import ReportsClient from './ReportsClient'

export default async function ReportsPage() {
  const db = createServerClient()

  // Pull all payments and POs for live P&L calculation
  const [{ data: payments }, { data: pos }, { data: orders }, { data: lineItems }] = await Promise.all([
    db.from('payments').select('payment_date, amount_usd, wire_fee_usd, amount_foreign, fx_rate, currency, logged_in_qbo').order('payment_date', { ascending: false }),
    db.from('purchase_orders').select('order_date, freight_usd, duties_usd, other_fees_usd, landed_cost_usd, status').order('order_date', { ascending: false }),
    db.from('shopify_orders').select('order_date, total_price, order_number, customer_name, line_items_count').order('order_date', { ascending: false }),
    db.from('line_items').select('sku, product_name, category, shopify_price, landed_cost_per_unit, margin_pct, qty_ordered, shopify_published'),
  ])

  const shopifyConnected = !!process.env.SHOPIFY_ADMIN_API_TOKEN &&
    process.env.SHOPIFY_ADMIN_API_TOKEN !== 'your_shopify_admin_token_here'

  return (
    <ReportsClient
      payments={payments || []}
      pos={pos || []}
      orders={orders || []}
      lineItems={lineItems || []}
      shopifyConnected={shopifyConnected}
    />
  )
}
