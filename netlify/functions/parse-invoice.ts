// Netlify background function — 15 minute timeout, no inactivity limit
// Receives base64 PDF, calls Claude, returns parsed invoice JSON

import type { Handler } from '@netlify/functions'

const PROMPT = `Extract all data from this jewelry invoice and return ONLY valid JSON.
No markdown, no explanation, no code fences — just raw JSON.

{
  "vendor": { "name": "string", "vendor_id_suggestion": "string e.g. IND-MR", "country": "string", "currency": "string" },
  "po": {
    "invoice_number": "string", "invoice_date": "YYYY-MM-DD", "reference_number": "string or null",
    "items_summary": "string", "qty_total": 0, "currency": "INR",
    "subtotal_foreign": 0, "gst_foreign": 0, "shipping_foreign": 0,
    "gateway_fee_foreign": 0, "other_charges_foreign": 0, "grand_total_foreign": 0, "notes": "string"
  },
  "line_items": [{
    "sku_original": "exact SKU e.g. BG-665-72", "sku_suggestion": "prefixed e.g. MR-BG-665-72",
    "product_name": "descriptive name e.g. Bangle BG-665-72 Ruby Green 2x2",
    "category": "Bangles|Necklaces|Earrings|Bracelets|Rings|Sets|Anklets|Other",
    "color": "string", "size": "string or null", "qty": 0,
    "unit_cost_foreign": 0, "line_total_foreign": 0, "section": "REGULAR PRODUCTS|NET PRICED PRODUCTS|OTHER"
  }],
  "payment": { "amount_foreign": 0, "currency": "INR", "notes": "string" },
  "parsing_notes": "any ambiguities"
}

payment.amount_foreign must equal po.grand_total_foreign.
Category: BG-=Bangles, CH-=Necklaces, ER-=Earrings, BR-=Bracelets, RN-/RG-=Rings.
Extract ALL line items. vendor_id_suggestion: initials e.g. Manek Ratna=IND-MR.`

const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const { base64, mimeType } = body
    if (!base64) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No file data' }) }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: mimeType || 'application/pdf', data: base64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Claude error: ' + err }) }
    }

    const data = await response.json()
    let rawText: string = data.content?.[0]?.text || ''

    // Clean JSON
    rawText = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const start = rawText.search(/[{[]/)
    if (start > 0) rawText = rawText.slice(start)
    const fc = rawText[0]
    if (fc === '{' || fc === '[') {
      const last = rawText.lastIndexOf(fc === '{' ? '}' : ']')
      if (last > 0) rawText = rawText.slice(0, last + 1)
    }

    const parsed = JSON.parse(rawText)
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: parsed }) }
  } catch (e: unknown) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }) }
  }
}

export { handler }
