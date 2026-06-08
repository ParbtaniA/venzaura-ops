'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Vendor, Currency, PaymentMethod } from '@/types'

const CURRENCIES: Currency[] = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'CNY']
const PAYMENT_METHODS: PaymentMethod[] = ['Wire (SWIFT)', 'PayPal', 'Zelle', 'ACH', 'Other']
const EMPTY: Partial<Vendor> = { currency: 'INR', active: true }

export default function VendorsClient({ vendors: initial }: { vendors: Vendor[] }) {
  const [vendors, setVendors] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Partial<Vendor>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.vendor_id.toLowerCase().includes(search.toLowerCase()) ||
    v.country.toLowerCase().includes(search.toLowerCase())
  )

  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      if (!editing.vendor_id || !editing.name || !editing.country) {
        setError('Vendor ID, Name and Country are required.')
        return
      }
      // Strip read-only generated fields before sending
      const { id, created_at, updated_at, ...payload } = editing as Vendor
      if (id) {
        const { data, error: err } = await supabase.from('vendors').update(payload).eq('id', id).select().single()
        if (err) { setError(err.message); return }
        if (data) setVendors(vs => vs.map(v => v.id === data.id ? data : v))
      } else {
        const { data, error: err } = await supabase.from('vendors').insert(payload).select().single()
        if (err) { setError(err.message); return }
        if (data) setVendors(vs => [data, ...vs])
      }
      setShowForm(false)
      setEditing(EMPTY)
    } finally { setSaving(false) }
  }

  async function deleteVendor() {
    if (!deleteTarget) return
    setDeleting(true); setDeleteError(null)
    try {
      // Cascade: line_items → payments → purchase_orders → vendor
      const { data: vendorPOs } = await supabase.from('purchase_orders').select('id').eq('vendor_id', deleteTarget.id)
      if (vendorPOs?.length) {
        for (const po of vendorPOs) {
          await supabase.from('line_items').delete().eq('po_id', po.id)
          await supabase.from('payments').delete().eq('po_id', po.id)
        }
        const { error: poErr } = await supabase.from('purchase_orders').delete().eq('vendor_id', deleteTarget.id)
        if (poErr) { setDeleteError('Failed to delete POs: ' + poErr.message); return }
      }
      const { error: vErr } = await supabase.from('vendors').delete().eq('id', deleteTarget.id)
      if (vErr) { setDeleteError('Failed to delete vendor: ' + vErr.message); return }
      setVendors(vs => vs.filter(v => v.id !== deleteTarget.id))
      setDeleteTarget(null)
    } finally { setDeleting(false) }
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('vendors').update({ active }).eq('id', id)
    setVendors(vs => vs.map(v => v.id === id ? { ...v, active } : v))
  }

  const F = (k: keyof Vendor) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setEditing(p => ({ ...p, [k]: e.target.value }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Vendors</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{vendors.length} suppliers · {vendors.filter(v => v.active).length} active</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(EMPTY); setShowForm(true) }}>+ Add Vendor</button>
      </div>

      <div className="mb-4">
        <input className="input max-w-sm" placeholder="Search by name, ID, or country..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-zinc-800">
            <tr>
              <th className="th">Vendor ID</th>
              <th className="th">Name</th>
              <th className="th">Country</th>
              <th className="th">Currency</th>
              <th className="th">Contact</th>
              <th className="th">Payment</th>
              <th className="th">Lead Days</th>
              <th className="th">Min Order</th>
              <th className="th">Status</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="td text-center text-zinc-500 py-12">No vendors yet. Add your first supplier.</td></tr>
            )}
            {filtered.map(v => (
              <tr key={v.id} className="table-row">
                <td className="td font-mono text-[#C9A84C] text-xs">{v.vendor_id}</td>
                <td className="td font-medium">{v.name}</td>
                <td className="td">{v.country}</td>
                <td className="td"><span className="badge badge-zinc">{v.currency}</span></td>
                <td className="td">
                  <p className="text-xs">{v.contact_name}</p>
                  <p className="text-xs text-zinc-500">{v.contact_email}</p>
                </td>
                <td className="td text-xs">{v.payment_method}</td>
                <td className="td text-xs">{v.avg_lead_days ? `${v.avg_lead_days}d` : '—'}</td>
                <td className="td text-xs">{v.min_order_usd ? `$${v.min_order_usd}` : '—'}</td>
                <td className="td">
                  <span className={`badge ${v.active ? 'badge-green' : 'badge-zinc'}`}>{v.active ? 'Active' : 'Inactive'}</span>
                </td>
                <td className="td">
                  <div className="flex gap-1">
                    <button className="btn-ghost text-xs py-1 px-2" onClick={() => { setEditing(v); setShowForm(true) }}>Edit</button>
                    <button className="btn-ghost text-xs py-1 px-2" onClick={() => toggleActive(v.id, !v.active)}>
                      {v.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="text-xs py-1 px-2 rounded-lg text-red-500 hover:text-red-400 hover:bg-red-900/20 transition-all"
                      onClick={() => { setDeleteTarget(v); setDeleteError(null) }}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center text-red-400 text-lg flex-shrink-0">⚠</div>
                <div>
                  <h2 className="text-base font-semibold text-zinc-100">Delete Vendor?</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">This cannot be undone</p>
                </div>
              </div>
              <div className="bg-zinc-800/60 rounded-xl p-4 mb-4 text-sm space-y-1">
                <p><span className="text-zinc-500">Vendor:</span> <span className="text-[#C9A84C] font-mono">{deleteTarget.vendor_id}</span> — <span className="text-zinc-300">{deleteTarget.name}</span></p>
                <p><span className="text-zinc-500">Country:</span> <span className="text-zinc-300">{deleteTarget.country}</span></p>
              </div>
              <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2 mb-4">
                All purchase orders, line items, and payment records for this vendor will also be permanently deleted.
              </p>
              {deleteError && <p className="text-xs text-red-400 mb-3">{deleteError}</p>}
              <div className="flex gap-2 justify-end">
                <button className="btn-ghost" onClick={() => { setDeleteTarget(null); setDeleteError(null) }} disabled={deleting}>Cancel</button>
                <button className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  onClick={deleteVendor} disabled={deleting}>
                  {deleting ? 'Deleting...' : 'Yes, Delete Everything'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h2 className="text-base font-semibold">{editing.id ? 'Edit Vendor' : 'Add Vendor'}</h2>
              <button className="btn-ghost text-xs" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div><label className="label">Vendor ID *</label><input className="input" placeholder="IND-01" value={editing.vendor_id || ''} onChange={F('vendor_id')} /></div>
              <div><label className="label">Vendor Name *</label><input className="input" placeholder="Rajesh Jewels" value={editing.name || ''} onChange={F('name')} /></div>
              <div><label className="label">Country *</label><input className="input" placeholder="India" value={editing.country || ''} onChange={F('country')} /></div>
              <div><label className="label">Currency</label>
                <select className="select" value={editing.currency || 'INR'} onChange={F('currency')}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="label">Contact Name</label><input className="input" value={editing.contact_name || ''} onChange={F('contact_name')} /></div>
              <div><label className="label">Contact Email</label><input className="input" type="email" value={editing.contact_email || ''} onChange={F('contact_email')} /></div>
              <div><label className="label">WhatsApp / Phone</label><input className="input" placeholder="+91-98765-43210" value={editing.whatsapp || ''} onChange={F('whatsapp')} /></div>
              <div><label className="label">Payment Method</label>
                <select className="select" value={editing.payment_method || ''} onChange={F('payment_method')}>
                  <option value="">Select...</option>
                  {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div><label className="label">Avg Lead Time (days)</label><input className="input" type="number" value={editing.avg_lead_days || ''} onChange={F('avg_lead_days')} /></div>
              <div><label className="label">Min Order (USD)</label><input className="input" type="number" step="0.01" value={editing.min_order_usd || ''} onChange={F('min_order_usd')} /></div>
              <div className="col-span-2"><label className="label">Bank / Wire Details</label><textarea className="input" rows={2} value={editing.bank_details || ''} onChange={F('bank_details')} /></div>
              <div className="col-span-2"><label className="label">Notes</label><textarea className="input" rows={2} value={editing.notes || ''} onChange={F('notes')} /></div>
            </div>
            {error && <div className="mx-5 mb-2 bg-red-900/30 border border-red-800/50 rounded-lg px-3 py-2 text-sm text-red-400">{error}</div>}
            <div className="flex justify-end gap-2 p-5 border-t border-zinc-800">
              <button className="btn-ghost" onClick={() => { setShowForm(false); setError(null) }}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Vendor'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
