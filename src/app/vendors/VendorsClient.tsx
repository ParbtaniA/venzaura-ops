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

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.vendor_id.toLowerCase().includes(search.toLowerCase()) ||
    v.country.toLowerCase().includes(search.toLowerCase())
  )

  async function save() {
    setSaving(true)
    try {
      if (editing.id) {
        const { data } = await supabase.from('vendors').update(editing).eq('id', editing.id).select().single()
        if (data) setVendors(vs => vs.map(v => v.id === data.id ? data : v))
      } else {
        const { data } = await supabase.from('vendors').insert(editing).select().single()
        if (data) setVendors(vs => [data, ...vs])
      }
      setShowForm(false)
      setEditing(EMPTY)
    } finally { setSaving(false) }
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
                  </div>
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
            <div className="flex justify-end gap-2 p-5 border-t border-zinc-800">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Vendor'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
