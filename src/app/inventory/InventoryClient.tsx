'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { LineItem } from '@/types'

const fmt = (n?: number | null) => n != null ? `$${Number(n).toFixed(2)}` : '—'

export default function InventoryClient({ items: initial }: { items: LineItem[] }) {
  const [items, setItems] = useState(initial)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pushing, setPushing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'ready' | 'live'>('all')
  const [pushLog, setPushLog] = useState<string[]>([])

  const filtered = items.filter(i => {
    if (filter === 'ready') return i.ready_to_upload && !i.shopify_published
    if (filter === 'live') return i.shopify_published
    return true
  })

  const readyCount = items.filter(i => i.ready_to_upload && !i.shopify_published).length
  const liveCount = items.filter(i => i.shopify_published).length

  function toggleSelect(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function selectAllReady() {
    setSelected(new Set(items.filter(i => i.ready_to_upload && !i.shopify_published).map(i => i.id)))
  }

  async function markReady(id: string, ready: boolean) {
    await supabase.from('line_items').update({ ready_to_upload: ready }).eq('id', id)
    setItems(its => its.map(i => i.id === id ? { ...i, ready_to_upload: ready } : i))
  }

  async function pushToShopify() {
    if (!selected.size) return
    setPushing(true)
    setPushLog([`Pushing ${selected.size} SKU(s) to Shopify...`])
    try {
      const res = await fetch('/api/shopify/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: [...selected] }),
      })
      const result = await res.json()
      setPushLog(result.log || ['Done'])
      if (result.success) {
        setItems(its => its.map(i =>
          selected.has(i.id) ? { ...i, shopify_published: true, shopify_product_id: result.ids?.[i.id] || i.shopify_product_id } : i
        ))
        setSelected(new Set())
      }
    } catch (e) {
      setPushLog(l => [...l, `Error: ${e}`])
    } finally { setPushing(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{readyCount} ready to push · {liveCount} live on Shopify</p>
        </div>
        <div className="flex gap-2 items-center">
          {readyCount > 0 && selected.size === 0 && (
            <button className="btn-ghost text-xs" onClick={selectAllReady}>Select all ready ({readyCount})</button>
          )}
          {selected.size > 0 && (
            <button className="btn-primary" onClick={pushToShopify} disabled={pushing}>
              {pushing ? 'Pushing...' : `Push ${selected.size} to Shopify →`}
            </button>
          )}
        </div>
      </div>

      {pushLog.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 mb-5 font-mono text-xs text-zinc-300 space-y-1">
          {pushLog.map((l, i) => <p key={i}>{l}</p>)}
          <button className="text-zinc-500 hover:text-zinc-300 mt-2" onClick={() => setPushLog([])}>Clear log</button>
        </div>
      )}

      <div className="flex gap-1 mb-4">
        {([['all', 'All SKUs'], ['ready', `Ready (${readyCount})`], ['live', `Live (${liveCount})`]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-all ${filter === v ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-zinc-800">
            <tr>
              <th className="th w-10"></th>
              <th className="th">SKU</th>
              <th className="th">Product</th>
              <th className="th">Category</th>
              <th className="th">Qty</th>
              <th className="th">Landed/Unit</th>
              <th className="th">Price</th>
              <th className="th">Margin</th>
              <th className="th">PO</th>
              <th className="th">Status</th>
              <th className="th">Ready</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="td text-center text-zinc-500 py-12">No items in this view.</td></tr>
            )}
            {filtered.map(i => (
              <tr key={i.id} className={`table-row ${selected.has(i.id) ? 'bg-zinc-800/60' : ''}`}>
                <td className="td pl-4">
                  {!i.shopify_published && (
                    <input type="checkbox" className="accent-[#C9A84C] w-4 h-4"
                      checked={selected.has(i.id)} onChange={() => toggleSelect(i.id)} />
                  )}
                </td>
                <td className="td font-mono text-[#C9A84C] text-xs">{i.sku}</td>
                <td className="td">
                  <p className="font-medium text-zinc-200 text-sm">{i.product_name}</p>
                  <p className="text-xs text-zinc-500">{(i as any).vendor?.name}</p>
                </td>
                <td className="td"><span className="badge badge-zinc text-xs">{i.category}</span></td>
                <td className="td text-center">{i.qty_ordered}</td>
                <td className="td">{fmt(i.landed_cost_per_unit)}</td>
                <td className="td text-[#C9A84C] font-medium">{fmt(i.shopify_price)}</td>
                <td className="td">
                  {i.margin_pct != null && (
                    <span className={`badge ${i.margin_pct >= 40 ? 'badge-green' : i.margin_pct >= 20 ? 'badge-gold' : 'badge-red'}`}>
                      {i.margin_pct.toFixed(1)}%
                    </span>
                  )}
                </td>
                <td className="td text-xs text-zinc-400">{(i as any).purchase_order?.po_number}</td>
                <td className="td">
                  {i.shopify_published
                    ? <span className="badge badge-green">Live</span>
                    : i.ready_to_upload
                      ? <span className="badge badge-gold">Ready</span>
                      : <span className="badge badge-zinc">Pending</span>}
                </td>
                <td className="td">
                  {!i.shopify_published && (
                    <input type="checkbox" className="accent-[#C9A84C] w-4 h-4"
                      checked={i.ready_to_upload}
                      onChange={e => markReady(i.id, e.target.checked)} />
                  )}
                  {i.shopify_published && i.shopify_product_id && (
                    <a href={`https://admin.shopify.com/store/venzaura/products/${i.shopify_product_id}`}
                      target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline">View ↗</a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
