'use client'
import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

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

type ParsedInvoice = {
  vendor: {
    name: string
    vendor_id_suggestion: string
    country: string
    currency: string
  }
  po: {
    invoice_number: string
    invoice_date: string
    reference_number: string | null
    items_summary: string
    qty_total: number
    currency: string
    subtotal_foreign: number
    gst_foreign: number
    shipping_foreign: number
    gateway_fee_foreign: number
    other_charges_foreign: number
    grand_total_foreign: number
    notes: string
  }
  line_items: {
    sku_original: string
    sku_suggestion: string
    product_name: string
    category: string
    color: string
    size: string | null
    qty: number
    unit_cost_foreign: number
    line_total_foreign: number
    section: string
  }[]
  payment: {
    amount_foreign: number
    currency: string
    notes: string
  }
  parsing_notes: string
}

type Stage = 'upload' | 'parsing' | 'review' | 'saving' | 'done'

export default function InvoiceUploadClient() {
  const [stage, setStage] = useState<Stage>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedInvoice | null>(null)
  const [fxRate, setFxRate] = useState('0.010506')
  const [freightPct, setFreightPct] = useState('22.59')
  const [editedItems, setEditedItems] = useState<ParsedInvoice['line_items']>([])
  const [savedSummary, setSavedSummary] = useState<{ vendor: string; po: string; skus: number; total: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const fx = parseFloat(fxRate) || 0
  const freight = parseFloat(freightPct) || 0

  function landedCost(unitForeign: number) {
    return unitForeign * fx * (1 + freight / 100)
  }
  function retailPrice(unitForeign: number) {
    const lc = landedCost(unitForeign)
    return lc > 0 ? roundToRetail(lc * MARKUP) : 0
  }
  function margin(unitForeign: number, price: number) {
    const lc = landedCost(unitForeign)
    return price > 0 && lc > 0 ? ((price - lc) / price * 100) : 0
  }

  async function handleFile(file: File) {
    if (!file) return
    setStage('parsing')
    setParseError(null)

    // Convert to base64 and call the Netlify background function
    // (avoids the 10s serverless timeout on the Next.js API route)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string
        const base64 = dataUrl.split(',')[1]
        const mimeType = file.type || 'application/pdf'

        const res = await fetch('/.netlify/functions/parse-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64, mimeType }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          setParseError(json.error || 'Parse failed')
          setStage('upload')
          return
        }
        setParsed(json.data)
        setEditedItems(json.data.line_items)
        setStage('review')
      } catch (e: unknown) {
        setParseError(e instanceof Error ? e.message : String(e))
        setStage('upload')
      }
    }
    reader.onerror = () => { setParseError('Failed to read file'); setStage('upload') }
    reader.readAsDataURL(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function updateItem(idx: number, field: string, value: string | number) {
    setEditedItems(its => its.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  async function confirmAndSave() {
    if (!parsed) return
    setStage('saving'); setSaveError(null)

    try {
      // 1. Upsert vendor
      const { data: vendor, error: ve } = await supabase
        .from('vendors')
        .upsert({
          vendor_id: parsed.vendor.vendor_id_suggestion,
          name: parsed.vendor.name,
          country: parsed.vendor.country,
          currency: parsed.vendor.currency,
          active: true,
        }, { onConflict: 'vendor_id' })
        .select().single()
      if (ve) throw new Error('Vendor: ' + ve.message)

      // 2. Generate PO number
      const poNum = `PO-${parsed.vendor.vendor_id_suggestion}-${parsed.po.invoice_date.substring(0, 7).replace('-', '')}-${parsed.po.invoice_number.substring(0, 8)}`

      // Compute freight USD from shipping + gateway fees
      const shippingUsd = (parsed.po.shipping_foreign + parsed.po.gateway_fee_foreign) * fx

      const { data: po, error: poe } = await supabase
        .from('purchase_orders')
        .upsert({
          po_number: poNum,
          order_date: parsed.po.invoice_date,
          vendor_id: vendor.id,
          invoice_number: parsed.po.invoice_number,
          items_summary: parsed.po.items_summary,
          qty_total: parsed.po.qty_total,
          unit_cost_foreign: parsed.po.subtotal_foreign,
          currency: parsed.po.currency,
          fx_rate: fx,
          freight_usd: parseFloat(shippingUsd.toFixed(2)),
          duties_usd: parseFloat((parsed.po.gst_foreign * fx).toFixed(2)),
          other_fees_usd: parseFloat((parsed.po.other_charges_foreign * fx).toFixed(2)),
          status: 'Ordered',
          notes: parsed.po.notes,
        }, { onConflict: 'po_number' })
        .select().single()
      if (poe) throw new Error('PO: ' + poe.message)

      // 3. Upsert all line items
      const lineRecords = editedItems.map((item, idx) => {
        const lc = landedCost(item.unit_cost_foreign)
        const price = retailPrice(item.unit_cost_foreign)
        return {
          line_id: `LI-${parsed.vendor.vendor_id_suggestion}-${parsed.po.invoice_number.replace(/[^A-Z0-9]/gi, '')}-${String(idx + 1).padStart(3, '0')}`,
          po_id: po.id,
          vendor_id: vendor.id,
          sku: item.sku_suggestion,
          product_name: item.product_name,
          category: item.category,
          qty_ordered: item.qty,
          unit_cost_foreign: item.unit_cost_foreign,
          currency: parsed.po.currency,
          fx_rate: fx,
          freight_share_pct: freight,
          shopify_price: price,
          tags: `${parsed.vendor.name.toLowerCase().replace(/\s+/g, '-')}, ${item.category.toLowerCase()}, ${item.color?.toLowerCase() || ''}, imitation jewelry`,
          ready_to_upload: false,
          shopify_published: false,
        }
      })

      const { error: le } = await supabase
        .from('line_items')
        .upsert(lineRecords, { onConflict: 'line_id' })
      if (le) throw new Error('Line items: ' + le.message)

      // 4. Upsert payment record
      const totalUsd = parsed.po.grand_total_foreign * fx
      const { error: pye } = await supabase
        .from('payments')
        .upsert({
          payment_id: `PAY-${parsed.vendor.vendor_id_suggestion}-${parsed.po.invoice_number.replace(/[^A-Z0-9]/gi, '')}`,
          payment_date: parsed.po.invoice_date,
          vendor_id: vendor.id,
          po_id: po.id,
          payment_method: 'Wire (SWIFT)',
          amount_foreign: parsed.po.grand_total_foreign,
          currency: parsed.po.currency,
          fx_rate: fx,
          wire_fee_usd: 25,
          reference_number: parsed.po.invoice_number,
          logged_in_qbo: false,
          notes: `Auto-imported from invoice ${parsed.po.invoice_number}. ${parsed.po.notes || ''}`.trim(),
        }, { onConflict: 'payment_id' })
      if (pye) throw new Error('Payment: ' + pye.message)

      setSavedSummary({
        vendor: parsed.vendor.name,
        po: poNum,
        skus: editedItems.length,
        total: `$${totalUsd.toFixed(2)}`,
      })
      setStage('done')
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : String(e))
      setStage('review')
    }
  }

  // ── UPLOAD STAGE ────────────────────────────────────────────────────────
  if (stage === 'upload') return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Invoice Import</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Upload a PDF invoice — everything auto-populates</p>
        </div>
      </div>

      {parseError && (
        <div className="bg-red-900/30 border border-red-800/50 rounded-xl p-4 mb-5 text-sm text-red-400">{parseError}</div>
      )}

      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${dragOver ? 'border-[#C9A84C] bg-[#C9A84C]/5' : 'border-zinc-700 hover:border-zinc-500'}`}
      >
        <div className="text-4xl mb-4 text-zinc-600">⊕</div>
        <p className="text-zinc-300 font-medium mb-1">Drop your invoice PDF here</p>
        <p className="text-zinc-500 text-sm">or click to browse — supports any vendor invoice</p>
        <p className="text-zinc-600 text-xs mt-3">PDF · JPG · PNG</p>
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      </div>

      <div className="mt-8 grid grid-cols-3 gap-4">
        {[
          { icon: '⊡', title: 'Reads every line item', desc: 'SKU, color, size, qty, unit cost — all extracted automatically' },
          { icon: '⊞', title: 'Creates vendor + PO', desc: 'Vendor record and purchase order created or updated' },
          { icon: '◈', title: 'Prices at 3.5x', desc: 'Retail price auto-set, FX and freight applied, margin shown' },
        ].map(c => (
          <div key={c.title} className="card-sm">
            <p className="text-lg text-[#C9A84C] mb-2">{c.icon}</p>
            <p className="text-sm font-medium text-zinc-200 mb-1">{c.title}</p>
            <p className="text-xs text-zinc-500">{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )

  // ── PARSING STAGE ───────────────────────────────────────────────────────
  if (stage === 'parsing') return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-4">
      <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      <p className="text-zinc-300 font-medium">Reading invoice...</p>
      <p className="text-zinc-500 text-sm">Claude is extracting all line items, costs, and vendor details</p>
    </div>
  )

  // ── DONE STAGE ──────────────────────────────────────────────────────────
  if (stage === 'done' && savedSummary) return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-6">
      <div className="text-5xl text-emerald-400">✓</div>
      <div className="text-center">
        <p className="text-xl font-semibold text-zinc-100 mb-1">Invoice imported</p>
        <p className="text-zinc-400 text-sm">{savedSummary.vendor} · {savedSummary.po} · {savedSummary.skus} SKUs · {savedSummary.total}</p>
      </div>
      <div className="flex gap-3">
        <a href="/line-items" className="btn-primary">View Line Items →</a>
        <a href="/purchase-orders" className="btn-ghost">View PO</a>
        <button className="btn-ghost" onClick={() => { setStage('upload'); setParsed(null); setEditedItems([]) }}>
          Import Another
        </button>
      </div>
    </div>
  )

  // ── REVIEW STAGE ────────────────────────────────────────────────────────
  if (stage !== 'review' && stage !== 'saving') return null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Review Import</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Check everything below, then confirm to save</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => { setStage('upload'); setParsed(null) }}>← Back</button>
          <button className="btn-primary" onClick={confirmAndSave} disabled={stage === 'saving'}>
            {stage === 'saving' ? 'Saving...' : `Confirm & Save ${editedItems.length} SKUs →`}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="bg-red-900/30 border border-red-800/50 rounded-xl p-4 mb-5 text-sm text-red-400">{saveError}</div>
      )}

      {parsed?.parsing_notes && (
        <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-4 mb-5 text-sm text-amber-400">
          <span className="font-medium">Note: </span>{parsed.parsing_notes}
        </div>
      )}

      {/* FX + Freight controls */}
      <div className="card mb-5">
        <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">FX Rate & Costs</p>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="label">FX Rate (INR → USD)</label>
            <input className="input" type="number" step="0.000001" value={fxRate}
              onChange={e => setFxRate(e.target.value)} />
          </div>
          <div>
            <label className="label">Freight Share %</label>
            <input className="input" type="number" step="0.1" value={freightPct}
              onChange={e => setFreightPct(e.target.value)} />
          </div>
          <div>
            <label className="label">Markup</label>
            <div className="input bg-zinc-700/50 text-zinc-400 flex items-center">{MARKUP}x (fixed)</div>
          </div>
          <div>
            <label className="label">Grand Total (Foreign)</label>
            <div className="input bg-zinc-700/50 text-zinc-400 flex items-center">
              {parsed?.po.currency} {parsed?.po.grand_total_foreign.toLocaleString()}
              <span className="ml-2 text-zinc-500">= ${(( parsed?.po.grand_total_foreign || 0) * fx).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Vendor + PO summary */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="card-sm">
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Vendor</p>
          <p className="font-semibold text-zinc-100">{parsed?.vendor.name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{parsed?.vendor.vendor_id_suggestion} · {parsed?.vendor.country} · {parsed?.vendor.currency}</p>
        </div>
        <div className="card-sm">
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Purchase Order</p>
          <p className="font-semibold text-zinc-100">{parsed?.po.invoice_number}</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {parsed?.po.invoice_date} · Qty {parsed?.po.qty_total} · {parsed?.po.currency} {parsed?.po.subtotal_foreign.toLocaleString()} goods
          </p>
          {parsed && (parsed.po.gst_foreign > 0 || parsed.po.shipping_foreign > 0) && (
            <p className="text-xs text-zinc-600 mt-0.5">
              + GST {parsed.po.gst_foreign} + Shipping {parsed.po.shipping_foreign}
              {parsed.po.gateway_fee_foreign > 0 ? ` + Gateway ${parsed.po.gateway_fee_foreign}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Line items table */}
      <div className="card p-0 overflow-x-auto">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-zinc-500">{editedItems.length} line items</p>
          <p className="text-xs text-zinc-500">Edit SKU name or category before saving</p>
        </div>
        <table className="w-full">
          <thead className="border-b border-zinc-800">
            <tr>
              <th className="th">#</th>
              <th className="th">Original SKU</th>
              <th className="th">Suggested SKU</th>
              <th className="th">Product Name</th>
              <th className="th">Category</th>
              <th className="th">Qty</th>
              <th className="th">Unit Cost</th>
              <th className="th">Landed/Unit</th>
              <th className="th">Retail</th>
              <th className="th">Margin</th>
            </tr>
          </thead>
          <tbody>
            {editedItems.map((item, idx) => {
              const lc   = landedCost(item.unit_cost_foreign)
              const rp   = retailPrice(item.unit_cost_foreign)
              const mg   = margin(item.unit_cost_foreign, rp)
              return (
                <tr key={idx} className="table-row">
                  <td className="td text-zinc-600 text-xs">{idx + 1}</td>
                  <td className="td font-mono text-zinc-400 text-xs">{item.sku_original}</td>
                  <td className="td">
                    <input
                      className="input text-xs py-1 font-mono"
                      value={item.sku_suggestion}
                      onChange={e => updateItem(idx, 'sku_suggestion', e.target.value)}
                    />
                  </td>
                  <td className="td">
                    <input
                      className="input text-xs py-1"
                      value={item.product_name}
                      onChange={e => updateItem(idx, 'product_name', e.target.value)}
                    />
                  </td>
                  <td className="td">
                    <select className="select text-xs py-1"
                      value={item.category}
                      onChange={e => updateItem(idx, 'category', e.target.value)}>
                      {['Necklaces','Earrings','Bracelets','Bangles','Rings','Sets','Anklets','Other'].map(c =>
                        <option key={c}>{c}</option>
                      )}
                    </select>
                  </td>
                  <td className="td text-center text-sm">{item.qty}</td>
                  <td className="td text-xs text-zinc-400">{item.unit_cost_foreign} {parsed?.po.currency}</td>
                  <td className="td text-xs text-zinc-300">${lc.toFixed(2)}</td>
                  <td className="td font-medium text-[#C9A84C]">${rp.toFixed(2)}</td>
                  <td className="td">
                    <span className={`badge text-xs ${mg >= 60 ? 'badge-green' : mg >= 40 ? 'badge-gold' : 'badge-red'}`}>
                      {mg.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mt-5">
        <button className="btn-primary" onClick={confirmAndSave} disabled={stage === 'saving'}>
          {stage === 'saving' ? 'Saving...' : `Confirm & Save ${editedItems.length} SKUs →`}
        </button>
      </div>
    </div>
  )
}
