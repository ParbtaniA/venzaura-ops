'use client'
import { useState } from 'react'
import type { MonthlyReport } from '@/types'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']
const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

function Row({ label, value, neg, bold, highlight }: { label: string; value: number; neg?: boolean; bold?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex justify-between items-center text-sm py-1 ${bold ? 'font-semibold' : ''}`}>
      <span className="text-zinc-400">{label}</span>
      <span className={highlight ? 'text-[#C9A84C]' : neg && value < 0 ? 'text-red-400' : 'text-zinc-200'}>
        {fmt(value)}
      </span>
    </div>
  )
}

export default function ReportsClient({ reports: initial }: { reports: MonthlyReport[] }) {
  const [reports, setReports] = useState(initial)
  const [selected, setSelected] = useState<MonthlyReport | null>(initial[0] || null)
  const [syncing, setSyncing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [msg, setMsg] = useState('')

  async function generate() {
    setSyncing(true); setMsg('')
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      })
      const data = await res.json()
      if (data.report) {
        setReports(r => {
          const idx = r.findIndex(x => x.year === data.report.year && x.month === data.report.month)
          if (idx >= 0) { const n = [...r]; n[idx] = data.report; return n }
          return [data.report, ...r]
        })
        setSelected(data.report)
        setMsg('Report generated')
      }
    } catch { setMsg('Failed to generate') }
    finally { setSyncing(false) }
  }

  async function exportPDF() {
    if (!selected) return
    setExporting(true)
    try {
      const res = await fetch('/api/reports/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: selected.id }),
      })
      const data = await res.json()

      // Build and download a simple HTML report
      const html = `<!DOCTYPE html>
<html><head><title>VenzAura Report</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;color:#1a1a1a}
h1{color:#C9A84C}table{width:100%;border-collapse:collapse;margin:16px 0}
td,th{padding:8px 12px;border-bottom:1px solid #eee;text-align:left}
th{background:#f5f5f5;font-weight:600}.total{font-weight:700;border-top:2px solid #333}
</style></head><body>
<h1>${data.title}</h1>
<p>Period: ${data.period} &nbsp;|&nbsp; Generated: ${data.generated}</p>
<h2>Revenue</h2><table>${data.revenue.map((r: {label:string;value:string}) => `<tr><td>${r.label}</td><td>${r.value}</td></tr>`).join('')}</table>
<h2>Expenses</h2><table>${data.expenses.map((r: {label:string;value:string}) => `<tr><td>${r.label}</td><td>${r.value}</td></tr>`).join('')}</table>
<h2>Bottom Line</h2>
<table><tr class="total"><td>Gross Profit</td><td>${data.summary.grossProfit}</td></tr>
<tr><td>Gross Margin</td><td>${data.summary.margin}</td></tr></table>
${data.topSkus?.length ? `<h2>Top SKUs</h2><table><tr><th>SKU</th><th>Name</th><th>Qty</th><th>Revenue</th></tr>${data.topSkus.map((s: {sku:string;name:string;qty:number;revenue:number}) => `<tr><td>${s.sku}</td><td>${s.name}</td><td>${s.qty}</td><td>$${s.revenue.toFixed(2)}</td></tr>`).join('')}</table>` : ''}
</body></html>`

      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `VenzAura_${selected.year}_${MONTHS[selected.month - 1]}_Report.html`
      a.click()
      URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Monthly P&L · accountant-ready exports</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {msg && <p className="text-xs text-zinc-400">{msg}</p>}
          <select className="select w-24" value={year} onChange={e => setYear(+e.target.value)}>
            {[2024,2025,2026,2027].map(y => <option key={y}>{y}</option>)}
          </select>
          <select className="select w-28" value={month} onChange={e => setMonth(+e.target.value)}>
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <button className="btn-ghost" onClick={generate} disabled={syncing}>{syncing ? 'Generating...' : '↻ Generate'}</button>
          {selected && <button className="btn-primary" onClick={exportPDF} disabled={exporting}>{exporting ? 'Exporting...' : '↓ Export'}</button>}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-3 space-y-2">
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">History</p>
          {reports.length === 0 && <p className="text-xs text-zinc-600">No reports yet.</p>}
          {reports.map(r => (
            <button key={r.id} onClick={() => setSelected(r)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${selected?.id === r.id ? 'border-[#C9A84C] bg-zinc-800' : 'border-zinc-800 hover:border-zinc-700'}`}>
              <p className="text-sm font-medium">{MONTHS[r.month-1]} {r.year}</p>
              <p className={`text-xs mt-0.5 ${r.gross_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(r.gross_profit)}</p>
            </button>
          ))}
        </div>

        <div className="col-span-9">
          {!selected ? (
            <div className="card flex items-center justify-center h-48">
              <p className="text-zinc-500 text-sm">Select or generate a report</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{MONTHS_FULL[selected.month-1]} {selected.year}</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">VenzAura Operations Report</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold text-emerald-400">{fmt(selected.gross_profit)}</p>
                  <p className="text-xs text-zinc-500">{selected.gross_margin_pct.toFixed(1)}% margin</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="card">
                  <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Revenue</p>
                  <Row label="Gross revenue" value={selected.gross_revenue} />
                  <Row label="Refunds" value={-selected.refunds} neg />
                  <Row label="Net revenue" value={selected.net_revenue} bold />
                  <div className="divider" />
                  <Row label="Shopify fees" value={-selected.shopify_fees} neg />
                  <Row label="Net after fees" value={selected.net_revenue - selected.shopify_fees} bold highlight />
                </div>
                <div className="card">
                  <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Expenses</p>
                  <Row label="Vendor payments (COGS)" value={-selected.vendor_payments} neg />
                  <Row label="Wire / transfer fees" value={-selected.wire_fees} neg />
                  <Row label="Freight & duties" value={-selected.freight_duties} neg />
                  <Row label="Shopify subscription" value={-selected.shopify_subscription} neg />
                  <Row label="Other expenses" value={-selected.other_expenses} neg />
                  <div className="divider" />
                  <Row label="Total expenses" value={-selected.total_expenses} neg bold />
                </div>
              </div>

              <div className="card">
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Gross profit</p>
                    <p className="text-2xl font-semibold text-emerald-400">{fmt(selected.gross_profit)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Gross margin</p>
                    <p className="text-2xl font-semibold text-[#C9A84C]">{selected.gross_margin_pct.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Top SKU count</p>
                    <p className="text-2xl font-semibold">{selected.top_skus?.length ?? 0}</p>
                  </div>
                </div>
              </div>

              {selected.top_skus && selected.top_skus.length > 0 && (
                <div className="card">
                  <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Top SKUs this month</p>
                  {selected.top_skus.map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-600 w-4">{i+1}</span>
                        <span className="font-mono text-[#C9A84C] text-xs">{s.sku}</span>
                        <span className="text-sm text-zinc-300">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-zinc-400">
                        <span>{s.qty} units</span>
                        <span className="text-emerald-400 font-medium">{fmt(s.revenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
