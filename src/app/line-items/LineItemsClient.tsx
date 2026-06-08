'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { LineItem, Category, Currency } from '@/types'

const CATEGORIES: Category[] = ['Necklaces','Earrings','Bracelets','Bangles','Rings','Sets','Anklets','Other']
const CURRENCIES: Currency[] = ['INR','USD','EUR','GBP']
const fmt = (n?: number | null) => n != null ? `$${Number(n).toFixed(2)}` : '—'
const EMPTY: Partial<LineItem> = { currency: 'INR', qty_ordered: 1, freight_share_pct: 15, ready_to_upload: false, shopify_published: false }

export default function LineItemsClient({ items: initial, pos, vendors }: {
  items: LineItem[]
  pos: { id: string; po_number: string }[]
  vendors: { id: string; vendor_id: string; name: string }[]
}) {
  const [items, setItems] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Partial<LineItem>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [catFilter, setCatFilter] = useState<Category | 'All'>('All')
  const [search, setSearch] = useState('')

  const filtered = items.filter(i => {
    const matchCat = catFilter === 'All' || i.category === catFilter
    const matchSearch = !search || i.sku.toLowerCase().includes(search.toLowerCase()) || i.product_name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const avgMargin = (() => {
    const ms = items.filter(i => i.margin_pct != null).map(i => i.margin_pct!)
    return ms.length ? ms.reduce((s, m) => s + m, 0) / ms.length : 0
  })()

  async function save() {
    setSaving(true)
    try {
      if (editing.id) {
        const { data } = await supabase.from('line_items').update(editing).eq('id', editing.id).select('*, vendor:vendors(name,vendor_id), purchase_order:purchase_orders(po_number)').single()
        if (data) setItems(its => its.map(i => i.id === data.id ? data : i))
      } else {
        const { data } = await supabase.from('line_items').insert(editing).select('*, vendor:vendors(name,vendor_id), purchase_order:purchase_orders(po_number)').single()
        if (data) setItems(its => [data, ...its])
      }
      setShowForm(false); setEditing(EMPTY)
    } finally { setSaving(false) }
  }

  const F = (k: keyof LineItem) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setEditing(p => ({ ...p, [k]: e.target.value }))
  const FC = (k: keyof LineItem) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditing(p => ({ ...p, [k]: e.target.checked }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Line Items / SKUs</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{items.length} SKUs · avg margin {avgMargin.toFixed(1)}%</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(EMPTY); setShowForm(true) }}>+ Add SKU</button>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <input className="input max-w-xs" placeholder="Search SKU or name..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-1 flex-wrap">
          {(['All', ...CATEGORIES] as const).map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all ${catFilter === c ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-zinc-800">
            <tr>
              <th className="th">SKU</th>
              <th className="th">Product</th>
              <th className="th">Category</th>
              <th className="th">Qty</th>
              <th className="th">Unit Cost</th>
              <th className="th">FX</th>
              <th className="th">Landed/Unit</th>
              <th className="th">Price</th>
              <th className="th">Margin</th>
              <th className="th">PO</th>
              <th className="th">Ready</th>
              <th className="th">Live</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={13} className="td text-center text-zinc-500 py-12">No SKUs found.</td></tr>
            )}
            {filtered.map(i => (
              <tr key={i.id} className="table-row">
                <td className="td font-mono text-[#C9A84C] text-xs">{i.sku}</td>
                <td className="td">
                  <p className="text-sm font-medium text-zinc-200">{i.product_name}</p>
                  <p className="text-xs text-zinc-500">{(i as any).vendor?.name}</p>
                </td>
                <td className="td"><span className="badge badge-zinc text-xs">{i.category}</span></td>
                <td className="td text-center text-sm">{i.qty_ordered}</td>
                <td className="td text-xs">{i.unit_cost_foreign?.toLocaleString()} {i.currency}</td>
                <td className="td text-xs font-mono">{i.fx_rate}</td>
                <td className="td text-xs">{fmt(i.landed_cost_per_unit)}</td>
                <td className="td font-medium text-[#C9A84C]">{fmt(i.shopify_price)}</td>
                <td className="td">
                  {i.margin_pct != null && (
                    <span className={`badge text-xs ${i.margin_pct >= 50 ? 'badge-green' : i.margin_pct >= 30 ? 'badge-gold' : 'badge-red'}`}>
                      {i.margin_pct.toFixed(1)}%
                    </span>
                  )}
                </td>
                <td className="td text-xs text-zinc-400">{(i as any).purchase_order?.po_number}</td>
                <td className="td text-center">
                  {i.ready_to_upload ? <span className="badge badge-gold text-xs">✓</span> : <span className="text-zinc-600 text-xs">—</span>}
                </td>
                <td className="td text-center">
                  {i.shopify_published ? <span className="badge badge-green text-xs">Live</span> : <span className="text-zinc-600 text-xs">—</span>}
                </td>
                <td className="td">
                  <button className="btn-ghost text-xs py-1 px-2" onClick={() => { setEditing(i); setShowForm(true) }}>Edit</button>
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
              <h2 className="text-base font-semibold">{editing.id ? 'Edit SKU' : 'Add SKU'}</h2>
              <button className="btn-ghost text-xs" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div><label className="label">Line ID *</label><input className="input" placeholder="LI-001" value={editing.line_id || ''} onChange={F('line_id')} /></div>
              <div><label className="label">SKU *</label><input className="input" placeholder="IND01-NECK-0001" value={editing.sku || ''} onChange={F('sku')} /></div>
              <div className="col-span-2"><label className="label">Product Name *</label><input className="input" value={editing.product_name || ''} onChange={F('product_name')} /></div>
              <div><label className="label">Category *</label>
                <select className="select" value={editing.category || ''} onChange={F('category')}>
                  <option value="">Select...</option>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="label">Vendor</label>
                <select className="select" value={editing.vendor_id || ''} onChange={F('vendor_id')}>
                  <option value="">Select vendor...</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.vendor_id} — {v.name}</option>)}
                </select>
              </div>
              <div><label className="label">Purchase Order</label>
                <select className="select" value={editing.po_id || ''} onChange={F('po_id')}>
                  <option value="">Select PO...</option>
                  {pos.map(p => <option key={p.id} value={p.id}>{p.po_number}</option>)}
                </select>
              </div>
              <div><label className="label">Qty Ordered *</label><input className="input" type="number" value={editing.qty_ordered || ''} onChange={F('qty_ordered')} /></div>
              <div><label className="label">Unit Cost (Foreign) *</label><input className="input" type="number" step="0.01" value={editing.unit_cost_foreign || ''} onChange={F('unit_cost_foreign')} /></div>
              <div><label className="label">Currency</label>
                <select className="select" value={editing.currency || 'INR'} onChange={F('currency')}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="label">FX Rate *</label><input className="input" type="number" step="0.000001" value={editing.fx_rate || ''} onChange={F('fx_rate')} /></div>
              <div><label className="label">Freight Share % (default 15)</label><input className="input" type="number" step="0.1" value={editing.freight_share_pct ?? 15} onChange={F('freight_share_pct')} /></div>
              <div><label className="label">Shopify Price (USD)</label><input className="input" type="number" step="0.01" value={editing.shopify_price || ''} onChange={F('shopify_price')} /></div>
              <div><label className="label">Compare At Price</label><input className="input" type="number" step="0.01" value={editing.compare_at_price || ''} onChange={F('compare_at_price')} /></div>
              <div><label className="label">Weight (grams)</label><input className="input" type="number" value={editing.weight_grams || ''} onChange={F('weight_grams')} /></div>
              <div><label className="label">Shopify Handle</label><input className="input" placeholder="gold-layered-necklace" value={editing.shopify_handle || ''} onChange={F('shopify_handle')} /></div>
              <div><label className="label">Tags</label><input className="input" placeholder="gold, necklace, imitation" value={editing.tags || ''} onChange={F('tags')} /></div>
              <div><label className="label">Image URL</label><input className="input" type="url" value={editing.image_url || ''} onChange={F('image_url')} /></div>
              <div className="col-span-2"><label className="label">Product Description</label><textarea className="input" rows={3} value={editing.product_description || ''} onChange={F('product_description')} /></div>
              <div className="flex items-center gap-2 col-span-2">
                <input type="checkbox" id="ready" className="accent-[#C9A84C] w-4 h-4" checked={editing.ready_to_upload || false} onChange={FC('ready_to_upload')} />
                <label htmlFor="ready" className="text-sm text-zinc-300 cursor-pointer">Ready to upload to Shopify</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-zinc-800">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save SKU'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
