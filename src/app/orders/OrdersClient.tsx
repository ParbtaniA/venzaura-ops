'use client'
import { useState } from 'react'
import type { ShopifyOrder } from '@/types'

const fmt = (n?: number | null) =>
  n != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n) : '—'

export default function OrdersClient({ orders: initial }: { orders: ShopifyOrder[] }) {
  const [orders, setOrders] = useState(initial)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  const paidOrders = orders.filter(o => o.financial_status === 'paid')
  const totalRevenue = paidOrders.reduce((s, o) => s + (o.total_price || 0), 0)
  const avgOrder = paidOrders.length ? totalRevenue / paidOrders.length : 0

  async function syncOrders() {
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await fetch('/api/shopify/sync-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      setSyncMsg(data.message || (data.error ? `Error: ${data.error}` : 'Sync complete'))
      if (data.success) window.location.reload()
    } catch {
      setSyncMsg('Sync failed — check Shopify credentials in .env.local')
    } finally { setSyncing(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Shopify Orders</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{orders.length} orders · {fmt(totalRevenue)} revenue</p>
        </div>
        <div className="flex items-center gap-3">
          {syncMsg && <p className="text-xs text-zinc-400">{syncMsg}</p>}
          <button className="btn-primary" onClick={syncOrders} disabled={syncing}>
            {syncing ? 'Syncing...' : '↻ Sync from Shopify'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="stat-card"><p className="stat-label">Total Orders</p><p className="stat-value">{orders.length}</p></div>
        <div className="stat-card"><p className="stat-label">Paid</p><p className="stat-value text-emerald-400">{paidOrders.length}</p></div>
        <div className="stat-card"><p className="stat-label">Total Revenue</p><p className="stat-value text-emerald-400">{fmt(totalRevenue)}</p></div>
        <div className="stat-card"><p className="stat-label">Avg Order Value</p><p className="stat-value">{fmt(avgOrder)}</p></div>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-zinc-800">
            <tr>
              <th className="th">Order #</th>
              <th className="th">Date</th>
              <th className="th">Customer</th>
              <th className="th">Items</th>
              <th className="th">Total</th>
              <th className="th">Payment</th>
              <th className="th">Fulfillment</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={7} className="td text-center text-zinc-500 py-12">
                No orders yet. Click Sync to pull from Shopify.
              </td></tr>
            )}
            {orders.map(o => (
              <tr key={o.id} className="table-row">
                <td className="td font-mono text-[#C9A84C] text-xs">{o.order_number}</td>
                <td className="td text-xs text-zinc-400">
                  {new Date(o.order_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="td">
                  <p className="text-sm">{o.customer_name || 'Guest'}</p>
                  <p className="text-xs text-zinc-500">{o.customer_email}</p>
                </td>
                <td className="td text-xs text-zinc-400">
                  {Array.isArray(o.line_items) ? `${o.line_items.length} item${o.line_items.length !== 1 ? 's' : ''}` : '—'}
                </td>
                <td className="td font-medium text-zinc-100">{fmt(o.total_price)}</td>
                <td className="td">
                  <span className={`badge ${o.financial_status === 'paid' ? 'badge-green' : o.financial_status === 'refunded' ? 'badge-red' : 'badge-zinc'}`}>
                    {o.financial_status || '—'}
                  </span>
                </td>
                <td className="td">
                  <span className={`badge ${o.fulfillment_status === 'fulfilled' ? 'badge-green' : 'badge-zinc'}`}>
                    {o.fulfillment_status || 'unfulfilled'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
