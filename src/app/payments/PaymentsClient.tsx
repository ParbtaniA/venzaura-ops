'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Payment, PaymentMethod, Currency } from '@/types'

const METHODS: PaymentMethod[] = ['Wire (SWIFT)', 'PayPal', 'Zelle', 'ACH', 'Other']
const CURRENCIES: Currency[] = ['INR', 'USD', 'EUR', 'GBP', 'AED']
const fmt = (n?: number | null) => n != null ? `$${Number(n).toFixed(2)}` : '—'
const EMPTY: Partial<Payment> = { currency: 'INR', wire_fee_usd: 0, logged_in_qbo: false }

export default function PaymentsClient({ payments: initial, vendors, pos }: {
  payments: Payment[]
  vendors: { id: string; vendor_id: string; name: string }[]
  pos: { id: string; po_number: string }[]
}) {
  const [payments, setPayments] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Partial<Payment>>(EMPTY)
  const [saving, setSaving] = useState(false)

  const totalOut = payments.reduce((s, p) => s + (p.total_out_usd || 0), 0)
  const pendingQBO = payments.filter(p => !p.logged_in_qbo).length

  async function save() {
    setSaving(true)
    try {
      if (editing.id) {
        const { data } = await supabase.from('payments').update(editing).eq('id', editing.id).select('*, vendor:vendors(name,vendor_id), purchase_order:purchase_orders(po_number)').single()
        if (data) setPayments(ps => ps.map(p => p.id === data.id ? data : p))
      } else {
        const { data } = await supabase.from('payments').insert(editing).select('*, vendor:vendors(name,vendor_id), purchase_order:purchase_orders(po_number)').single()
        if (data) setPayments(ps => [data, ...ps])
      }
      setShowForm(false); setEditing(EMPTY)
    } finally { setSaving(false) }
  }

  async function toggleQBO(id: string, logged: boolean) {
    await supabase.from('payments').update({ logged_in_qbo: logged }).eq('id', id)
    setPayments(ps => ps.map(p => p.id === id ? { ...p, logged_in_qbo: logged } : p))
  }

  const F = (k: keyof Payment) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setEditing(p => ({ ...p, [k]: e.target.value }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Payment Log</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{fmt(totalOut)} total out · {pendingQBO > 0 ? `${pendingQBO} not logged in QBO` : 'all logged in QBO'}</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(EMPTY); setShowForm(true) }}>+ Log Payment</button>
      </div>

      {pendingQBO > 0 && (
        <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-3 mb-4">
          <p className="text-sm text-amber-400">{pendingQBO} payment{pendingQBO > 1 ? 's' : ''} not yet logged in QuickBooks — check the QBO column below</p>
        </div>
      )}

      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-zinc-800">
            <tr>
              <th className="th">Pay ID</th>
              <th className="th">Date</th>
              <th className="th">Vendor</th>
              <th className="th">PO</th>
              <th className="th">Method</th>
              <th className="th">Amount</th>
              <th className="th">CCY</th>
              <th className="th">FX Rate</th>
              <th className="th">USD Amt</th>
              <th className="th">Wire Fee</th>
              <th className="th">Total Out</th>
              <th className="th">QBO</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr><td colSpan={13} className="td text-center text-zinc-500 py-12">No payments logged yet.</td></tr>
            )}
            {payments.map(p => (
              <tr key={p.id} className="table-row">
                <td className="td font-mono text-[#C9A84C] text-xs">{p.payment_id}</td>
                <td className="td text-xs text-zinc-400">{p.payment_date}</td>
                <td className="td text-sm">{(p as any).vendor?.name || '—'}</td>
                <td className="td text-xs text-zinc-400">{(p as any).purchase_order?.po_number || '—'}</td>
                <td className="td text-xs">{p.payment_method}</td>
                <td className="td text-xs">{p.amount_foreign?.toLocaleString()}</td>
                <td className="td"><span className="badge badge-zinc text-xs">{p.currency}</span></td>
                <td className="td text-xs font-mono">{p.fx_rate}</td>
                <td className="td">{fmt(p.amount_usd)}</td>
                <td className="td text-red-400 text-xs">{p.wire_fee_usd ? fmt(p.wire_fee_usd) : '—'}</td>
                <td className="td font-semibold text-red-400">{fmt(p.total_out_usd)}</td>
                <td className="td">
                  <input type="checkbox" className="accent-[#C9A84C] w-4 h-4"
                    checked={p.logged_in_qbo} onChange={e => toggleQBO(p.id, e.target.checked)} />
                </td>
                <td className="td">
                  <button className="btn-ghost text-xs py-1 px-2" onClick={() => { setEditing(p); setShowForm(true) }}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
          {payments.length > 0 && (
            <tfoot>
              <tr className="border-t border-zinc-700">
                <td colSpan={10} className="td text-right text-xs text-zinc-500 font-medium pr-4">Total out (USD)</td>
                <td className="td font-bold text-red-400">{fmt(totalOut)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h2 className="text-base font-semibold">{editing.id ? 'Edit Payment' : 'Log Payment'}</h2>
              <button className="btn-ghost text-xs" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div><label className="label">Payment ID *</label><input className="input" placeholder="PAY-001" value={editing.payment_id || ''} onChange={F('payment_id')} /></div>
              <div><label className="label">Date *</label><input className="input" type="date" value={editing.payment_date || ''} onChange={F('payment_date')} /></div>
              <div><label className="label">Vendor *</label>
                <select className="select" value={editing.vendor_id || ''} onChange={F('vendor_id')}>
                  <option value="">Select vendor...</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.vendor_id} — {v.name}</option>)}
                </select>
              </div>
              <div><label className="label">Purchase Order</label>
                <select className="select" value={editing.po_id || ''} onChange={F('po_id')}>
                  <option value="">Select PO (optional)...</option>
                  {pos.map(p => <option key={p.id} value={p.id}>{p.po_number}</option>)}
                </select>
              </div>
              <div><label className="label">Payment Method *</label>
                <select className="select" value={editing.payment_method || ''} onChange={F('payment_method')}>
                  <option value="">Select...</option>
                  {METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div><label className="label">Currency</label>
                <select className="select" value={editing.currency || 'INR'} onChange={F('currency')}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="label">Amount (Foreign) *</label><input className="input" type="number" step="0.01" value={editing.amount_foreign || ''} onChange={F('amount_foreign')} /></div>
              <div><label className="label">FX Rate (to USD) *</label><input className="input" type="number" step="0.000001" placeholder="0.012000" value={editing.fx_rate || ''} onChange={F('fx_rate')} /></div>
              <div><label className="label">Wire Fee (USD)</label><input className="input" type="number" step="0.01" value={editing.wire_fee_usd || ''} onChange={F('wire_fee_usd')} /></div>
              <div><label className="label">Bank / Account Used</label><input className="input" placeholder="Chase Business x4821" value={editing.bank_account || ''} onChange={F('bank_account')} /></div>
              <div className="col-span-2"><label className="label">Reference / Confirmation #</label><input className="input" value={editing.reference_number || ''} onChange={F('reference_number')} /></div>
              <div className="col-span-2"><label className="label">Notes</label><textarea className="input" rows={2} value={editing.notes || ''} onChange={F('notes')} /></div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-zinc-800">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Payment'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
