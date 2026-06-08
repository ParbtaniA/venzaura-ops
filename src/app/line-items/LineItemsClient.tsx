'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { LineItem, Category, Currency } from '@/types'

const CATEGORIES: Category[] = ['Necklaces','Earrings','Bracelets','Bangles','Rings','Sets','Anklets','Other']
const CURRENCIES: Currency[] = ['INR','USD','EUR','GBP']
const fmt = (n?: number | null) => n != null ? `$${Number(n).toFixed(2)}` : '—'
const MARKUP = 3.5

function roundToRetail(n: number): number {
  if (n <= 5)  return 4.99
  if (n <= 10) return 9.99
  if (n <= 15) return 14.99
  if (n <= 20) return 19.99
  if (n <= 25) return 24.99
  if (n <= 30) return 29.99
  if (n <= 35) return 34.99
  if (n <= 40) return 39.99
  if (n <= 50) return 49.99
  return Math.ceil(n / 5) * 5 - 0.01
}

const EMPTY: Partial<LineItem> = {
  currency: 'INR', qty_ordered: 1, freight_share_pct: 15,
  ready_to_upload: false, shopify_published: false,
}

export default function LineItemsClient({ items: initial, pos, vendors }: {
  items: LineItem[]
  pos: { id: string; po_number: string }[]
  vendors: { id: string; vendor_id: string; name: string }[]
}) {
  const [items, setItems] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Partial<LineItem>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catFilter, setCatFilter] = useState<Category | 'All'>('All')
  const [search, setSearch] = useState('')
  const [priceOverridden, setPriceOverridden] = useState(false)

  // Live-computed values derived from form inputs
  const unitCost      = Number(editing.unit_cost_foreign) || 0
  const fxRate        = Number(editing.fx_rate) || 0
  const freight       = Number(editing.freight_share_pct) ?? 15
  const landedPerUnit = unitCost * fxRate * (1 + freight / 100)
  const autoPrice     = landedPerUnit > 0 ? roundToRetail(landedPerUnit * MARKUP) : 0
  const currentPrice  = Number(editing.shopify_price) || 0
  const liveMargin    = currentPrice > 0 && landedPerUnit > 0
    ? (currentPrice - landedPerUnit) / currentPrice * 100
    : null

  // Auto-fill price when cost inputs change, unless user has manually set it
  useEffect(() => {
    if (!priceOverridden && landedPerUnit > 0) {
      setEditing(p => ({ ...p, shopify_price: autoPrice }))
    }
  }, [unitCost, fxRate, freight]) // eslint-disable-line react-hooks/exhaustive-deps

  function openEdit(item: LineItem) {
    setEditing(item)
    setPriceOverridden(true) // existing item — keep its saved price
    setShowForm(true)
    setError(null)
  }
  function openNew() {
    setEditing(EMPTY)
    setPriceOverridden(false) // new item — auto-fill price
    setShowForm(true)
    setError(null)
  }
  function resetToAuto() {
    setPriceOverridden(false)
    setEditing(p => ({ ...p, shopify_price: autoPrice }))
  }

  const filtered = items.filter(i => {
    const matchCat = catFilter === 'All' || i.category === catFilter
    const matchQ   = !search ||
      i.sku.toLowerCase().includes(search.toLowerCase()) ||
      i.product_name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchQ
  })

  const avgMargin = (() => {
    const ms = items.filter(i => i.margin_pct != null).map(i => i.margin_pct!)
    return ms.length ? ms.reduce((s, m) => s + m, 0) / ms.length : 0
  })()

  async function save() {
    setSaving(true); setError(null)
    try {
      if (!editing.line_id || !editing.sku || !editing.product_name || !editing.category) {
        setError('Line ID, SKU, Product Name and Category are required.')
        return
      }
      const { id, created_at, updated_at,
              unit_cost_usd, landed_cost_per_unit, total_landed_cost, margin_pct,
              ...payload } = editing as LineItem & Record<string, unknown>
      if (id) {
        const { data, error: err } = await supabase
          .from('line_items').update(payload).eq('id', id as string)
          .select('*, vendor:vendors(name,vendor_id), purchase_order:purchase_orders(po_number)').single()
        if (err) { setError(err.message); return }
        if (data) setItems(its => its.map(i => i.id === data.id ? data : i))
      } else {
        const { data, error: err } = await supabase
          .from('line_items').insert(payload)
          .select('*, vendor:vendors(name,vendor_id), purchase_order:purchase_orders(po_number)').single()
        if (err) { setError(err.message); return }
        if (data) setItems(its => [data, ...its])
      }
      setShowForm(false); setEditing(EMPTY); setPriceOverridden(false)
    } finally { setSaving(false) }
  }

  const F = (k: keyof LineItem) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setEditing(p => ({ ...p, [k]: e.target.value }))
  const FC = (k: keyof LineItem) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setEditing(p => ({ ...p, [k]: e.target.checked }))
  const onPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPriceOverridden(true)
    setEditing(p => ({ ...p, shopify_price: Number(e.target.value) }))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Line Items / SKUs</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {items.length} SKUs · avg margin {avgMargin.toFixed(1)}% · {MARKUP}x markup default
          </p>
        </div>
        <button className="btn-primary" onClick={openNew}>+ Add SKU</button>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <input className="input max-w-xs" placeholder="Search SKU or name..."
          value={search} onChange={e => setSearch(e.target.value)} />
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
              <th className="th">SKU</th><th className="th">Product</th><th className="th">Cat</th>
              <th className="th">Qty</th><th className="th">Unit Cost</th><th className="th">FX</th>
              <th className="th">Landed/Unit</th><th className="th">Retail</th><th className="th">Margin</th>
              <th className="th">PO</th><th className="th">Ready</th><th className="th">Live</th>
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
                    <span className={`badge text-xs ${i.margin_pct >= 60 ? 'badge-green' : i.margin_pct >= 40 ? 'badge-gold' : 'badge-red'}`}>
                      {i.margin_pct.toFixed(1)}%
                    </span>
                  )}
                </td>
                <td className="td text-xs text-zinc-400">{(i as any).purchase_order?.po_number}</td>
                <td className="td text-center">
                  {i.ready_to_upload
                    ? <span className="badge badge-gold text-xs">Ready</span>
                    : <span className="text-zinc-600 text-xs">—</span>}
                </td>
                <td className="td text-center">
                  {i.shopify_published
                    ? <span className="badge badge-green text-xs">Live</span>
                    : <span className="text-zinc-600 text-xs">—</span>}
                </td>
                <td className="td">
                  <button className="btn-ghost text-xs py-1 px-2" onClick={() => openEdit(i)}>Edit</button>
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
              <button className="btn-ghost text-xs" onClick={() => { setShowForm(false); setError(null) }}>✕</button>
            </div>

            <div className="p-5 grid grid-cols-2 gap-4">
              <div><label className="label">Line ID *</label>
                <input className="input" placeholder="LI-001" value={editing.line_id || ''} onChange={F('line_id')} />
              </div>
              <div><label className="label">SKU *</label>
                <input className="input" placeholder="MR-BG-001" value={editing.sku || ''} onChange={F('sku')} />
              </div>
              <div className="col-span-2"><label className="label">Product Name *</label>
                <input className="input" value={editing.product_name || ''} onChange={F('product_name')} />
              </div>
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
              <div><label className="label">Qty Ordered *</label>
                <input className="input" type="number" min="1" value={editing.qty_ordered || ''} onChange={F('qty_ordered')} />
              </div>
              <div><label className="label">Unit Cost (Foreign) *</label>
                <input className="input" type="number" step="0.01" placeholder="360"
                  value={editing.unit_cost_foreign || ''} onChange={F('unit_cost_foreign')} />
              </div>
              <div><label className="label">Currency</label>
                <select className="select" value={editing.currency || 'INR'} onChange={F('currency')}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="label">FX Rate (to USD) *</label>
                <input className="input" type="number" step="0.000001" placeholder="0.010506"
                  value={editing.fx_rate || ''} onChange={F('fx_rate')} />
              </div>
              <div><label className="label">Freight Share %</label>
                <input className="input" type="number" step="0.1" placeholder="15"
                  value={editing.freight_share_pct ?? 15} onChange={F('freight_share_pct')} />
              </div>

              {/* ── Pricing panel ── */}
              <div className="col-span-2 border border-zinc-700 rounded-xl p-4 bg-zinc-800/40">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Pricing</p>
                  {landedPerUnit > 0 && (
                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                      <span>Landed: <span className="text-zinc-300 font-mono">{fmt(landedPerUnit)}</span></span>
                      <span>{MARKUP}x auto: <span className="text-[#C9A84C] font-mono">{fmt(autoPrice)}</span></span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="label mb-0">Retail Price (USD)</label>
                      {priceOverridden && landedPerUnit > 0 && (
                        <button type="button" onClick={resetToAuto}
                          className="text-xs text-[#C9A84C] hover:text-[#D4B86A] transition-colors">
                          ↺ Reset to {MARKUP}x
                        </button>
                      )}
                    </div>
                    <input className="input" type="number" step="0.01"
                      value={editing.shopify_price || ''} onChange={onPriceChange} />
                  </div>
                  <div>
                    <label className="label">Compare At (strikethrough)</label>
                    <input className="input" type="number" step="0.01"
                      value={editing.compare_at_price || ''} onChange={F('compare_at_price')} />
                  </div>
                </div>

                {/* Live margin readout */}
                {liveMargin !== null && (
                  <div className={`mt-3 flex items-center gap-2 text-sm ${liveMargin >= 60 ? 'text-emerald-400' : liveMargin >= 40 ? 'text-[#C9A84C]' : 'text-red-400'}`}>
                    <span className="text-xs font-mono text-zinc-400">{fmt(landedPerUnit)} cost</span>
                    <span className="text-zinc-600">→</span>
                    <span className="text-xs font-mono text-zinc-300">{fmt(currentPrice)} retail</span>
                    <span className="text-zinc-600">=</span>
                    <span className="font-semibold">{liveMargin.toFixed(1)}% margin</span>
                    {priceOverridden && autoPrice > 0 && currentPrice !== autoPrice && (
                      <span className="text-zinc-600 text-xs ml-auto">({MARKUP}x = {fmt(autoPrice)})</span>
                    )}
                  </div>
                )}
              </div>

              <div><label className="label">Weight (grams)</label>
                <input className="input" type="number" value={editing.weight_grams || ''} onChange={F('weight_grams')} />
              </div>
              <div><label className="label">Shopify Handle</label>
                <input className="input" placeholder="gold-bangle-ruby-green" value={editing.shopify_handle || ''} onChange={F('shopify_handle')} />
              </div>
              <div className="col-span-2"><label className="label">Tags</label>
                <input className="input" placeholder="gold, bangles, imitation" value={editing.tags || ''} onChange={F('tags')} />
              </div>
              <div className="col-span-2"><label className="label">Image URL</label>
                <input className="input" type="url" value={editing.image_url || ''} onChange={F('image_url')} />
              </div>
              <div className="col-span-2"><label className="label">Product Description</label>
                <textarea className="input" rows={3} value={editing.product_description || ''} onChange={F('product_description')} />
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <input type="checkbox" id="ready" className="accent-[#C9A84C] w-4 h-4"
                  checked={editing.ready_to_upload || false} onChange={FC('ready_to_upload')} />
                <label htmlFor="ready" className="text-sm text-zinc-300 cursor-pointer">Ready to upload to Shopify</label>
              </div>
            </div>

            {error && (
              <div className="mx-5 mb-2 bg-red-900/30 border border-red-800/50 rounded-lg px-3 py-2 text-sm text-red-400">{error}</div>
            )}
            <div className="flex justify-end gap-2 p-5 border-t border-zinc-800">
              <button className="btn-ghost" onClick={() => { setShowForm(false); setError(null) }}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving...' : 'Save SKU'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
