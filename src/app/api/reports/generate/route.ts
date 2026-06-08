import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getShopifyRevenueSummary } from '@/lib/shopify'

export async function POST(req: NextRequest) {
  const { year, month } = await req.json()
  const db = createServerClient()

  const monthStart = new Date(year, month - 1, 1).toISOString().split('T')[0]
  const monthEnd = new Date(year, month, 0).toISOString().split('T')[0]

  const { data: payments } = await db
    .from('payments')
    .select('amount_usd, wire_fee_usd')
    .gte('payment_date', monthStart)
    .lte('payment_date', monthEnd)

  const vendorPayments = (payments || []).reduce((s, p) => s + (p.amount_usd || 0), 0)
  const wireFees = (payments || []).reduce((s, p) => s + (p.wire_fee_usd || 0), 0)

  const { data: pos } = await db
    .from('purchase_orders')
    .select('freight_usd, duties_usd')
    .gte('order_date', monthStart)
    .lte('order_date', monthEnd)

  const freightDuties = (pos || []).reduce(
    (s, p) => s + (p.freight_usd || 0) + (p.duties_usd || 0), 0
  )

  let gross = 0
  let orderCount = 0
  let topSkus: { sku: string; name: string; qty: number; revenue: number }[] = []

  try {
    const shopifyData = await getShopifyRevenueSummary(year, month)
    gross = shopifyData.gross
    orderCount = shopifyData.orderCount
    topSkus = shopifyData.topSkus
  } catch {
    const start = new Date(year, month - 1, 1).toISOString()
    const end = new Date(year, month, 0, 23, 59, 59).toISOString()
    const { data: orders } = await db
      .from('shopify_orders')
      .select('total_price')
      .gte('order_date', start)
      .lte('order_date', end)
    gross = (orders || []).reduce((s, o) => s + (o.total_price || 0), 0)
    orderCount = (orders || []).length
  }

  const shopifyFees = gross * 0.029 + orderCount * 0.30
  const shopifySubscription = 39
  const netRevenue = gross
  const totalExpenses = vendorPayments + wireFees + freightDuties + shopifyFees + shopifySubscription
  const grossProfit = netRevenue - totalExpenses
  const grossMarginPct = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0

  const report = {
    year, month,
    gross_revenue: gross,
    refunds: 0,
    net_revenue: netRevenue,
    shopify_fees: shopifyFees,
    vendor_payments: vendorPayments,
    wire_fees: wireFees,
    freight_duties: freightDuties,
    shopify_subscription: shopifySubscription,
    other_expenses: 0,
    total_expenses: totalExpenses,
    gross_profit: grossProfit,
    gross_margin_pct: grossMarginPct,
    top_skus: topSkus,
  }

  const { data, error } = await db
    .from('monthly_reports')
    .upsert(report, { onConflict: 'year,month' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ report: data })
}
