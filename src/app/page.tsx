import DashboardClient from '@/components/DashboardClient'
import type { DashboardStats } from '@/types'

const EMPTY_STATS: DashboardStats = {
  totalVendors: 0, activeVendors: 0, openPOs: 0, totalPOValue: 0,
  readyToUpload: 0, publishedProducts: 0, mtdRevenue: 0, mtdOrders: 0,
  totalPaymentsOut: 0, pendingQBO: 0, avgMargin: 0,
}

async function getDashboardData(): Promise<DashboardStats> {
  try {
    const { createServerClient } = await import('@/lib/supabase')
    const supabase = createServerClient()
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [vendors, pos, lineItems, payments, orders] = await Promise.all([
      supabase.from('vendors').select('id, active'),
      supabase.from('purchase_orders').select('id, status, landed_cost_usd'),
      supabase.from('line_items').select('id, ready_to_upload, shopify_published, margin_pct'),
      supabase.from('payments').select('id, total_out_usd, logged_in_qbo'),
      supabase.from('shopify_orders').select('id, total_price, order_date').gte('order_date', monthStart),
    ])

    const vData = vendors.data || []
    const poData = pos.data || []
    const liData = lineItems.data || []
    const payData = payments.data || []
    const ordData = orders.data || []
    const margins = liData.filter(l => l.margin_pct != null).map(l => l.margin_pct as number)

    return {
      totalVendors: vData.length,
      activeVendors: vData.filter(v => v.active).length,
      openPOs: poData.filter(p => ['Ordered','In Transit'].includes(p.status)).length,
      totalPOValue: poData.reduce((s, p) => s + (p.landed_cost_usd || 0), 0),
      readyToUpload: liData.filter(l => l.ready_to_upload && !l.shopify_published).length,
      publishedProducts: liData.filter(l => l.shopify_published).length,
      mtdRevenue: ordData.reduce((s, o) => s + parseFloat(o.total_price || '0'), 0),
      mtdOrders: ordData.length,
      totalPaymentsOut: payData.reduce((s, p) => s + (p.total_out_usd || 0), 0),
      pendingQBO: payData.filter(p => !p.logged_in_qbo).length,
      avgMargin: margins.length ? margins.reduce((s, m) => s + m, 0) / margins.length : 0,
    }
  } catch {
    return EMPTY_STATS
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardData()
  return <DashboardClient stats={stats} />
}
