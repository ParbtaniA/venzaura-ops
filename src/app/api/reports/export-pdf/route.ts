import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export async function POST(req: NextRequest) {
  const { reportId } = await req.json()
  const db = createServerClient()

  const { data: r, error } = await db
    .from('monthly_reports')
    .select('*')
    .eq('id', reportId)
    .single()

  if (error || !r) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  const reportData = {
    title: `VenzAura Operations — ${MONTHS[r.month - 1]} ${r.year}`,
    generated: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    period: `${MONTHS[r.month - 1]} 1–${new Date(r.year, r.month, 0).getDate()}, ${r.year}`,
    revenue: [
      { label: 'Gross Revenue', value: fmt(r.gross_revenue) },
      { label: 'Refunds / Returns', value: fmt(-r.refunds) },
      { label: 'Net Revenue', value: fmt(r.net_revenue) },
      { label: 'Shopify Fees (est. 2.9% + $0.30)', value: fmt(-r.shopify_fees) },
      { label: 'Net After Fees', value: fmt(r.net_revenue - r.shopify_fees) },
    ],
    expenses: [
      { label: 'Vendor Payments (COGS)', value: fmt(-r.vendor_payments) },
      { label: 'Wire / Transfer Fees', value: fmt(-r.wire_fees) },
      { label: 'Freight & Duties', value: fmt(-r.freight_duties) },
      { label: 'Shopify Subscription', value: fmt(-r.shopify_subscription) },
      { label: 'Other Expenses', value: fmt(-r.other_expenses) },
      { label: 'Total Expenses', value: fmt(-r.total_expenses) },
    ],
    summary: {
      grossProfit: fmt(r.gross_profit),
      margin: `${r.gross_margin_pct.toFixed(1)}%`,
    },
    topSkus: r.top_skus || [],
    notes: r.notes || '',
  }

  return NextResponse.json(reportData)
}
