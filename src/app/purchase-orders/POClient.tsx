'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { PurchaseOrder, POStatus, Currency } from '@/types'

const STATUSES: POStatus[] = ['Ordered', 'In Transit', 'Received', 'Cancelled']
const CURRENCIES: Currency[] = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'CNY']
const fmt = (n?: number | null) => n != null ? `$${Number(n).toFixed(2)}` : '—'
const EMPTY: Partial<PurchaseOrder> = { currency: 'INR', status: 'Ordered', freight_usd: 0, duties_usd: 0, other_fees_usd: 0 }

const statusColor = (s: POStatus) => {
  if (s === 'Received') return 'badge-green'
  if (s === 'In Transit') return 'badge-blue'
  if (s === 'Cancelled') return 'badge-red'
  return 'badge-gold'
}

export default function POClient({ pos: initial, vendors }: {
  pos: PurchaseOrder[]
  vendors: { id: string; vendor_id: string; name: string }[]
}) {
  const [pos, setPos] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Partial<PurchaseOrder>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<POStatus | 'All'>('All')

  const filtered = statusFilter === 'All' ? pos : pos.filter(p => p.status === statusFilter)
  const totalLanded = pos.filter(p => p.status !== 'Cancelled').reduce((s, p) => s + (p.landed_cost_usd || 0), 0)

  async function save() {
    setSaving(true)
    try {
      if (editing.id) {
        const { data } = await supabase.from('purchase_orders').update(editing).eq('id', editing.id).select('*, vendor:vendors(name,vendor_id)').single()
        if (data) setPos(ps => ps.map(p => p.id === data.id ? data : p))
      } else {
        const { data } = await supabase.from('purchase_orders').insert(editing).select('*, vendor:vendors(name,vendor_id)').single()
        if (data) setPos(ps => [data, ...ps])
      }
      setShowForm(false); setEditing(EMPTY)
    } finally { setSaving(false) }
  }

  const F = (k: keyof PurchaseOrder) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setEditing(p => ({ ...p, [k]: e.target.value }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Purchase Orders</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{pos.length} POs · {fmt(totalLanded)} total landed cost</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(EMPTY); setShowForm(true) }}>+ New PO</button>
      </div>

      <div className="flex gap-1 mb-4 flex-wrap">
        {(['All', ...STATUSES] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-all ${statusFilter === s ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
            {s} {s !== 'All' && `(${pos.filter(p => p.status === s).length})`}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-zinc-800">
            <tr>
              <th className="th">PO #</th>
              <th className="th">Date</th>
              <th className="th">Vendor</th>
              <th className="th">Invoice</th>
              <th className="th">CCY</th>
              <th className="th">FX Rate</th>
              <th className="th">Subtotal</th>
              <th className="th">Freight</th>
              <th className="th">Duties</th>
              <th className="th">Landed Cost</th>
              <th className="th">ETA</th>
              <th className="th">Status</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={13} className="td text-center text-zinc-500 py-12">No purchase orders found.</td></tr>
            )}
            {filtered.map(p => (
              <tr key={p.id} className="table-row">
                <td className="td font-mono text-[#C9A84C] text-xs">{p.po_number}</td>
                <td className="td text-xs text-zinc-400">{p.order_date}</td>
                <td className="td text-sm">{(p as any).vendor?.name || '—'}</td>
                <td className="td text-xs text-zinc-400">{p.invoice_number || '—'}</td>
                <td className="td"><span className="badge badge-zinc">{p.currency}</span></td>
                <td className="td text-xs font-mono">{p.fx_rate || '—'}</td>
                <td className="td text-xs">{fmt(p.subtotal_usd)}</td>
                <td className="td text-xs">{p.freight_usd ? fmt(p.freight_usd) : '—'}</td>
                <td className="td text-xs">{p.duties_usd ? fmt(p.duties_usd) : '—'}</td>
                <td className="td font-semibold text-[#C9A84C]">{fmt(p.landed_cost_usd)}</td>
                <td className="td text-xs text-zinc-400">{p.expected_arrival || '—'}</td>
                <td className="td"><span className={`badge ${statusColor(p.status)}`}>{p.status}</span></td>
                <td className="td">
                  <button className="btn-ghost text-xs py-1 px-2" onClick={() => { setEditing(p); setShowForm(true) }}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h2 className="text-base font-semibold">{editing.id ? 'Edit PO' : 'New Purchase Order'}</h2>
              <button className="btn-ghost text-xs" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div><label className="label">PO Number *</label><input className="input" placeholder="PO-2026-001" value={editing.po_number || ''} onChange={F('po_number')} /></div>
              <div><label className="label">Order Date *</label><input className="input" type="date" value={editing.order_date || ''} onChange={F('order_date')} /></div>
              <div><label className="label">Vendor *</label>
                <select className="select" value={editing.vendor_id || ''} onChange={F('vendor_id')}>
                  <option value="">Select vendor...</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.vendor_id} — {v.name}</option>)}
                </select>
              </div>
              <div><label className="label">Invoice #</label><input className="input" value={editing.invoice_number || ''} onChange={F('invoice_number')} /></div>
              <div><label className="label">Currency</label>
                <select className="select" value={editing.currency || 'INR'} onChange={F('currency')}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="label">FX Rate (to USD)</label><input className="input" type="number" step="0.000001" placeholder="0.012000" value={editing.fx_rate || ''} onChange={F('fx_rate')} /></div>
              <div><label className="label">Qty Total</label><input className="input" type="number" value={editing.qty_total || ''} onChange={F('qty_total')} /></div>
              <div><label className="label">Unit Cost (Foreign)</label><input className="input" type="number" step="0.01" value={editing.unit_cost_foreign || ''} onChange={F('unit_cost_foreign')} /></div>
              <div><label className="label">Freight (USD)</label><input className="input" type="number" step="0.01" value={editing.freight_usd || ''} onChange={F('freight_usd')} /></div>
              <div><label className="label">Duties / Customs (USD)</label><input className="input" type="number" step="0.01" value={editing.duties_usd || ''} onChange={F('duties_usd')} /></div>
              <div><label className="label">Other Fees (USD)</label><input className="input" type="number" step="0.01" value={editing.other_fees_usd || ''} onChange={F('other_fees_usd')} /></div>
              <div><label className="label">Status</label>
                <select className="select" value={editing.status || 'Ordered'} onChange={F('status')}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="label">Expected Arrival</label><input className="input" type="date" value={editing.expected_arrival || ''} onChange={F('expected_arrival')} /></div>
              <div><label className="label">Actual Arrival</label><input className="input" type="date" value={editing.actual_arrival || ''} onChange={F('actual_arrival')} /></div>
              <div className="col-span-2"><label className="label">Items Summary</label><textarea className="input" rows={2} placeholder="Necklace sets x20, Earring sets x30" value={editing.items_summary || ''} onChange={F('items_summary')} /></div>
              <div className="col-span-2"><label className="label">Notes</label><textarea className="input" rows={2} value={editing.notes || ''} onChange={F('notes')} /></div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-zinc-800">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save PO'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
