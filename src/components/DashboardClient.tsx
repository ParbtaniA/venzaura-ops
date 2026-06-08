'use client'
import type { DashboardStats } from '@/types'
import Link from 'next/link'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function DashboardClient({ stats }: { stats: DashboardStats }) {
  const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">
            Good day — <span className="text-[#C9A84C]">VenzAura</span>
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">{month} · Operations overview</p>
        </div>
        <div className="flex gap-2">
          <Link href="/inventory" className="btn-primary">Push to Shopify →</Link>
          <Link href="/reports" className="btn-ghost">Reports</Link>
        </div>
      </div>

      {stats.readyToUpload > 0 && (
        <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#C9A84C]">
              {stats.readyToUpload} SKU{stats.readyToUpload > 1 ? 's' : ''} ready to push to Shopify
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">Inventory received and marked ready</p>
          </div>
          <Link href="/inventory" className="btn-primary text-xs">Review & Push</Link>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="stat-card">
          <p className="stat-label">MTD Revenue</p>
          <p className="stat-value text-emerald-400">{fmt(stats.mtdRevenue)}</p>
          <p className="text-xs text-zinc-500">{stats.mtdOrders} orders</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Avg Margin</p>
          <p className="stat-value">{stats.avgMargin.toFixed(1)}%</p>
          <p className="text-xs text-zinc-500">across all SKUs</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Total Paid Out</p>
          <p className="stat-value text-red-400">{fmt(stats.totalPaymentsOut)}</p>
          <p className="text-xs text-zinc-500">{stats.pendingQBO > 0 ? `${stats.pendingQBO} not in QBO` : 'all in QBO'}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Open POs</p>
          <p className="stat-value text-blue-400">{stats.openPOs}</p>
          <p className="text-xs text-zinc-500">{fmt(stats.totalPOValue)} total value</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="stat-card">
          <p className="stat-label">Active Vendors</p>
          <p className="stat-value">{stats.activeVendors}</p>
          <p className="text-xs text-zinc-500">of {stats.totalVendors} total</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Ready to Upload</p>
          <p className="stat-value text-[#C9A84C]">{stats.readyToUpload}</p>
          <p className="text-xs text-zinc-500">SKUs pending push</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Live on Shopify</p>
          <p className="stat-value text-emerald-400">{stats.publishedProducts}</p>
          <p className="text-xs text-zinc-500">active products</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">QBO Pending</p>
          <p className="stat-value text-amber-400">{stats.pendingQBO}</p>
          <p className="text-xs text-zinc-500">payments to log</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { href: '/vendors', title: 'Vendors', desc: 'Add or manage suppliers', icon: '⊞' },
          { href: '/purchase-orders', title: 'Purchase Orders', desc: 'Log new PO + landed cost', icon: '⊟' },
          { href: '/line-items', title: 'Line Items', desc: 'Per-SKU cost & margin', icon: '≡' },
          { href: '/payments', title: 'Payment Log', desc: 'Wire payments & FX rates', icon: '⊠' },
          { href: '/orders', title: 'Shopify Orders', desc: 'Sync & review orders', icon: '◉' },
          { href: '/reports', title: 'Reports', desc: 'Monthly P&L for accountant', icon: '⊕' },
        ].map(item => (
          <Link key={item.href} href={item.href} className="card hover:border-zinc-700 transition-all group">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl text-[#C9A84C]">{item.icon}</span>
              <p className="text-sm font-medium text-zinc-200 group-hover:text-white">{item.title}</p>
            </div>
            <p className="text-xs text-zinc-500">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
