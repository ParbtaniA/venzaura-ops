'use client'
import { useState, useMemo } from 'react'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']
const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (n: number) => n.toFixed(1) + '%'

type Payment  = { payment_date: string; amount_usd: number; wire_fee_usd: number; logged_in_qbo?: boolean }
type PO       = { order_date: string; freight_usd: number; duties_usd: number; other_fees_usd: number; landed_cost_usd: number; status: string }
type Order    = { order_date: string; total_price: number; order_number: string; customer_name: string; line_items_count: number }
type LineItem = { sku: string; product_name: string; category: string; shopify_price: number; landed_cost_per_unit: number; margin_pct: number; qty_ordered: number; shopify_published: boolean }

type Props = {
  payments: Payment[]
  pos: PO[]
  orders: Order[]
  lineItems: LineItem[]
  shopifyConnected: boolean
}

function StatCard({ label, value, sub, color = 'text-zinc-100' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card-sm">
      <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function Row({ label, value, neg, bold, sub }: { label: string; value: number; neg?: boolean; bold?: boolean; sub?: string }) {
  const color = neg ? 'text-red-400' : value > 0 ? 'text-zinc-200' : 'text-zinc-500'
  return (
    <div className={`flex justify-between items-center py-1.5 ${bold ? 'font-semibold border-t border-zinc-700 mt-1 pt-2.5' : ''}`}>
      <div>
        <span className={bold ? 'text-zinc-200 text-sm' : 'text-zinc-400 text-sm'}>{label}</span>
        {sub && <p className="text-xs text-zinc-600">{sub}</p>}
      </div>
      <span className={`text-sm font-mono ${bold ? (value >= 0 ? 'text-emerald-400' : 'text-red-400') : color}`}>
        {neg && value !== 0 ? '-' : ''}{fmt(Math.abs(value))}
      </span>
    </div>
  )
}

export default function ReportsClient({ payments, pos, orders, lineItems, shopifyConnected }: Props) {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [view, setView]   = useState<'pl' | 'inventory' | 'payments'>('pl')

  // ── Period filter helpers ───────────────────────────────────────────────
  const inPeriod = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  }

  // ── P&L calculations ────────────────────────────────────────────────────
  const pl = useMemo(() => {
    const periodPayments = payments.filter(p => inPeriod(p.payment_date))
    const periodPOs      = pos.filter(p => inPeriod(p.order_date))
    const periodOrders   = orders.filter(o => inPeriod(o.order_date))

    const grossRevenue   = periodOrders.reduce((s, o) => s + (o.total_price || 0), 0)
    const orderCount     = periodOrders.length
    const cogs           = periodPayments.reduce((s, p) => s + (p.amount_usd || 0), 0)
    const wireFees       = periodPayments.reduce((s, p) => s + (p.wire_fee_usd || 0), 0)
    const freight        = periodPOs.reduce((s, p) => s + (p.freight_usd || 0) + (p.duties_usd || 0) + (p.other_fees_usd || 0), 0)
    // Shopify processing: 2.9% + $0.30/order (Basic plan estimate)
    const shopifyFees    = grossRevenue > 0 ? (grossRevenue * 0.029 + orderCount * 0.30) : 0
    const shopifySub     = 39 // $39/mo Basic plan
    const totalExpenses  = cogs + wireFees + freight + shopifyFees + shopifySub
    const grossProfit    = grossRevenue - totalExpenses
    const margin         = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0

    // YTD
    const ytdPayments = payments.filter(p => new Date(p.payment_date).getFullYear() === year)
    const ytdOrders   = orders.filter(o => new Date(o.order_date).getFullYear() === year)
    const ytdRevenue  = ytdOrders.reduce((s, o) => s + (o.total_price || 0), 0)
    const ytdCogs     = ytdPayments.reduce((s, p) => s + (p.amount_usd || 0) + (p.wire_fee_usd || 0), 0)
    const ytdProfit   = ytdRevenue - ytdCogs

    return { grossRevenue, orderCount, cogs, wireFees, freight, shopifyFees, shopifySub, totalExpenses, grossProfit, margin, ytdRevenue, ytdCogs, ytdProfit }
  }, [payments, pos, orders, year, month])

  // ── Inventory snapshot ─────────────────────────────────────────────────
  const inv = useMemo(() => {
    const totalSkus      = lineItems.length
    const publishedSkus  = lineItems.filter(i => i.shopify_published).length
    const totalInventory = lineItems.reduce((s, i) => s + (i.qty_ordered || 0), 0)
    const inventoryValue = lineItems.reduce((s, i) => s + ((i.landed_cost_per_unit || 0) * (i.qty_ordered || 0)), 0)
    const retailValue    = lineItems.reduce((s, i) => s + ((i.shopify_price || 0) * (i.qty_ordered || 0)), 0)
    const avgMargin      = lineItems.filter(i => i.margin_pct).reduce((s, i) => s + i.margin_pct, 0) / (lineItems.filter(i => i.margin_pct).length || 1)
    const byCategory     = lineItems.reduce((acc, i) => {
      acc[i.category] = (acc[i.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    return { totalSkus, publishedSkus, totalInventory, inventoryValue, retailValue, avgMargin, byCategory }
  }, [lineItems])

  // ── CSV export ─────────────────────────────────────────────────────────
  function exportCSV() {
    const rows = [
      ['VenzAura P&L Report', `${MONTHS_FULL[month-1]} ${year}`],
      [],
      ['REVENUE'],
      ['Shopify Orders', pl.orderCount],
      ['Gross Revenue', pl.grossRevenue.toFixed(2)],
      [],
      ['EXPENSES'],
      ['Vendor Payments (COGS)', pl.cogs.toFixed(2)],
      ['Wire Transfer Fees', pl.wireFees.toFixed(2)],
      ['Freight & Duties', pl.freight.toFixed(2)],
      ['Shopify Transaction Fees (est.)', pl.shopifyFees.toFixed(2)],
      ['Shopify Subscription', pl.shopifySub.toFixed(2)],
      ['Total Expenses', pl.totalExpenses.toFixed(2)],
      [],
      ['BOTTOM LINE'],
      ['Gross Profit', pl.grossProfit.toFixed(2)],
      ['Gross Margin %', pl.margin.toFixed(1) + '%'],
      [],
      ['YTD SUMMARY'],
      ['YTD Revenue', pl.ytdRevenue.toFixed(2)],
      ['YTD COGS + Fees', pl.ytdCogs.toFixed(2)],
      ['YTD Profit', pl.ytdProfit.toFixed(2)],
      [],
      ['INVENTORY SNAPSHOT'],
      ['Total SKUs', inv.totalSkus],
      ['Published on Shopify', inv.publishedSkus],
      ['Total Units', inv.totalInventory],
      ['Inventory at Cost', inv.inventoryValue.toFixed(2)],
      ['Inventory at Retail', inv.retailValue.toFixed(2)],
      ['Average Margin', inv.avgMargin.toFixed(1) + '%'],
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `VenzAura_${year}_${MONTHS[month-1]}_PL.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Payments export (for accountant) ──────────────────────────────────
  function exportPaymentsCSV() {
    const rows = [
      ['Payment ID', 'Date', 'Amount (Foreign)', 'Currency', 'FX Rate', 'Amount (USD)', 'Wire Fee (USD)', 'Total Out (USD)', 'Reconciled'],
      ...payments.map(p => [
        '', p.payment_date,
        '', '', '',
        (p.amount_usd || 0).toFixed(2),
        (p.wire_fee_usd || 0).toFixed(2),
        ((p.amount_usd || 0) + (p.wire_fee_usd || 0)).toFixed(2),
        p.logged_in_qbo ? 'Yes' : 'No'
      ])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `VenzAura_Payments_${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const tabs = [
    { id: 'pl', label: 'P&L' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'payments', label: 'Payment Log' },
  ] as const

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Live financials — no accounting software required</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select className="select w-24" value={year} onChange={e => setYear(+e.target.value)}>
            {[2024,2025,2026,2027].map(y => <option key={y}>{y}</option>)}
          </select>
          <select className="select w-28" value={month} onChange={e => setMonth(+e.target.value)}>
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <button className="btn-ghost text-xs" onClick={exportCSV}>↓ Export P&L</button>
          <button className="btn-ghost text-xs" onClick={exportPaymentsCSV}>↓ Export Payments</button>
        </div>
      </div>

      {/* Shopify connection banner */}
      {!shopifyConnected && (
        <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-4 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-zinc-200">Shopify not connected</p>
              <p className="text-xs text-zinc-500 mt-0.5">Revenue rows show $0 — connect Shopify to pull live order data into reports</p>
            </div>
          </div>
          <a href="/inventory" className="btn-ghost text-xs whitespace-nowrap">Connect Shopify →</a>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-zinc-800 pb-0">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setView(t.id)}
            className={`text-sm px-4 py-2 border-b-2 transition-all -mb-px ${view === t.id ? 'border-[#C9A84C] text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── P&L VIEW ─────────────────────────────────────────────────────── */}
      {view === 'pl' && (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Gross Revenue" value={fmt(pl.grossRevenue)}
              sub={`${pl.orderCount} orders`}
              color={pl.grossRevenue > 0 ? 'text-zinc-100' : 'text-zinc-500'} />
            <StatCard label="Total Expenses" value={fmt(pl.totalExpenses)} color="text-red-400" />
            <StatCard label="Gross Profit" value={fmt(pl.grossProfit)}
              sub={pct(pl.margin) + ' margin'}
              color={pl.grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'} />
            <StatCard label="YTD Profit" value={fmt(pl.ytdProfit)}
              sub={`${year} year-to-date`}
              color={pl.ytdProfit >= 0 ? 'text-[#C9A84C]' : 'text-red-400'} />
          </div>

          {/* Detailed P&L */}
          <div className="grid grid-cols-2 gap-4">
            <div className="card">
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">
                Revenue — {MONTHS_FULL[month-1]} {year}
                {!shopifyConnected && <span className="ml-2 text-amber-500">(Shopify not connected)</span>}
              </p>
              <Row label="Shopify gross revenue" value={pl.grossRevenue} />
              <Row label="Refunds / returns" value={0} neg sub="Manual adjustment" />
              <Row label="Net revenue" value={pl.grossRevenue} bold />
            </div>

            <div className="card">
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Expenses — {MONTHS_FULL[month-1]} {year}</p>
              <Row label="Vendor payments (COGS)" value={pl.cogs} neg />
              <Row label="Wire transfer fees" value={pl.wireFees} neg />
              <Row label="Freight & duties" value={pl.freight} neg />
              <Row label="Shopify transaction fees (est.)" value={pl.shopifyFees} neg
                sub="2.9% + $0.30/order" />
              <Row label="Shopify subscription" value={pl.shopifySub} neg sub="$39/mo Basic" />
              <Row label="Total expenses" value={pl.totalExpenses} neg bold />
            </div>
          </div>

          {/* Bottom line */}
          <div className="card">
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-4">Bottom Line</p>
            <div className="grid grid-cols-3 gap-8">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Gross Profit</p>
                <p className={`text-3xl font-semibold ${pl.grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(pl.grossProfit)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Gross Margin</p>
                <p className={`text-3xl font-semibold ${pl.margin >= 40 ? 'text-[#C9A84C]' : 'text-red-400'}`}>{pct(pl.margin)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-2">YTD ({year})</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-zinc-400">Revenue</span><span>{fmt(pl.ytdRevenue)}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-400">COGS + fees</span><span className="text-red-400">-{fmt(pl.ytdCogs)}</span></div>
                  <div className="flex justify-between font-semibold border-t border-zinc-700 pt-1 mt-1">
                    <span className="text-zinc-300">Profit</span>
                    <span className={pl.ytdProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmt(pl.ytdProfit)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Shopify setup guide */}
          {!shopifyConnected && (
            <div className="card border border-zinc-700">
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Connect Shopify to unlock revenue tracking</p>
              <div className="space-y-3 text-sm text-zinc-400">
                <div className="flex gap-3 items-start">
                  <span className="text-[#C9A84C] font-mono text-xs mt-0.5">1</span>
                  <span>Go to your Shopify Admin → <strong className="text-zinc-300">Settings → Apps and sales channels → Develop apps</strong></span>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-[#C9A84C] font-mono text-xs mt-0.5">2</span>
                  <span>Create a new app → Configure Admin API scopes: <code className="bg-zinc-800 px-1 rounded">read_orders</code>, <code className="bg-zinc-800 px-1 rounded">read_products</code>, <code className="bg-zinc-800 px-1 rounded">write_products</code></span>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-[#C9A84C] font-mono text-xs mt-0.5">3</span>
                  <span>Install the app → copy the <strong className="text-zinc-300">Admin API access token</strong> (starts with <code className="bg-zinc-800 px-1 rounded">shpat_</code>)</span>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-[#C9A84C] font-mono text-xs mt-0.5">4</span>
                  <span>Add it as <code className="bg-zinc-800 px-1 rounded">SHOPIFY_ADMIN_API_TOKEN</code> in your Netlify environment variables → redeploy</span>
                </div>
              </div>
              <p className="text-xs text-zinc-600 mt-4">Once connected, all reports will automatically pull live order data from Shopify.</p>
            </div>
          )}
        </div>
      )}

      {/* ── INVENTORY VIEW ─────────────────────────────────────────────────── */}
      {view === 'inventory' && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total SKUs" value={inv.totalSkus.toString()} sub={`${inv.publishedSkus} live on Shopify`} />
            <StatCard label="Total Units" value={inv.totalInventory.toString()} />
            <StatCard label="Inventory at Cost" value={fmt(inv.inventoryValue)} color="text-red-400" />
            <StatCard label="Inventory at Retail" value={fmt(inv.retailValue)} color="text-[#C9A84C]"
              sub={`${pct(inv.avgMargin)} avg margin`} />
          </div>

          <div className="card">
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">By Category</p>
            <div className="grid grid-cols-4 gap-4">
              {Object.entries(inv.byCategory).sort((a,b) => b[1]-a[1]).map(([cat, count]) => (
                <div key={cat} className="bg-zinc-800/40 rounded-xl p-3">
                  <p className="text-xs text-zinc-500">{cat}</p>
                  <p className="text-xl font-semibold mt-0.5">{count} <span className="text-xs text-zinc-500 font-normal">SKUs</span></p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-0 overflow-x-auto">
            <div className="px-4 py-3 border-b border-zinc-800">
              <p className="text-xs uppercase tracking-widest text-zinc-500">All SKUs — Margin Breakdown</p>
            </div>
            <table className="w-full">
              <thead className="border-b border-zinc-800">
                <tr>
                  <th className="th">SKU</th>
                  <th className="th">Product</th>
                  <th className="th">Category</th>
                  <th className="th">Qty</th>
                  <th className="th">Cost/Unit</th>
                  <th className="th">Retail</th>
                  <th className="th">Margin</th>
                  <th className="th">Stock Value</th>
                  <th className="th">Shopify</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.sort((a,b) => (b.margin_pct||0) - (a.margin_pct||0)).map((i, idx) => (
                  <tr key={idx} className="table-row">
                    <td className="td font-mono text-[#C9A84C] text-xs">{i.sku}</td>
                    <td className="td text-sm text-zinc-200">{i.product_name}</td>
                    <td className="td"><span className="badge badge-zinc text-xs">{i.category}</span></td>
                    <td className="td text-center text-sm">{i.qty_ordered}</td>
                    <td className="td text-xs text-zinc-400">${(i.landed_cost_per_unit||0).toFixed(2)}</td>
                    <td className="td text-sm font-medium text-[#C9A84C]">${(i.shopify_price||0).toFixed(2)}</td>
                    <td className="td">
                      <span className={`badge text-xs ${(i.margin_pct||0) >= 60 ? 'badge-green' : (i.margin_pct||0) >= 40 ? 'badge-gold' : 'badge-red'}`}>
                        {(i.margin_pct||0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="td text-xs text-zinc-400">${((i.landed_cost_per_unit||0)*(i.qty_ordered||0)).toFixed(2)}</td>
                    <td className="td">
                      {i.shopify_published
                        ? <span className="badge badge-green text-xs">Live</span>
                        : <span className="text-zinc-600 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PAYMENT LOG VIEW ────────────────────────────────────────────────── */}
      {view === 'payments' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Total Paid Out" value={fmt(payments.reduce((s,p) => s + (p.amount_usd||0) + (p.wire_fee_usd||0), 0))}
              sub={`${payments.length} payments`} color="text-red-400" />
            <StatCard label="Unreconciled"
              value={payments.filter(p => !p.logged_in_qbo).length.toString()}
              sub={`${payments.filter(p => !p.logged_in_qbo).length} payments not yet reconciled`} color="text-amber-400" />
            <StatCard label="Reconciled"
              value={payments.filter(p => p.logged_in_qbo).length.toString()}
              sub="confirmed" color="text-emerald-400" />
          </div>

          <div className="card p-0 overflow-x-auto">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-zinc-500">All Payments</p>
              <button className="btn-ghost text-xs" onClick={exportPaymentsCSV}>↓ Export CSV for accountant</button>
            </div>
            <table className="w-full">
              <thead className="border-b border-zinc-800">
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Amount (USD)</th>
                  <th className="th">Wire Fee</th>
                  <th className="th">Total Out</th>
                  <th className="th">Reconciled</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 && (
                  <tr><td colSpan={5} className="td text-center text-zinc-500 py-8">No payments yet.</td></tr>
                )}
                {payments.map((p, idx) => (
                  <tr key={idx} className="table-row">
                    <td className="td text-xs text-zinc-400">{p.payment_date}</td>
                    <td className="td text-sm">${(p.amount_usd||0).toFixed(2)}</td>
                    <td className="td text-xs text-red-400">{p.wire_fee_usd ? `$${p.wire_fee_usd.toFixed(2)}` : '—'}</td>
                    <td className="td font-semibold text-red-400">${((p.amount_usd||0)+(p.wire_fee_usd||0)).toFixed(2)}</td>
                    <td className="td">
                      <span className={`badge text-xs ${p.logged_in_qbo ? 'badge-green' : 'badge-zinc'}`}>
                        {p.logged_in_qbo ? '✓ Reconciled' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
