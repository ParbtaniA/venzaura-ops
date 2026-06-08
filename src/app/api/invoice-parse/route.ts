import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const PROMPT = [
  'Extract all data from this jewelry invoice and return ONLY valid JSON matching this exact structure.',
  'No markdown, no explanation, no code fences — just raw JSON.',
  '',
  '{',
  '  "vendor": { "name": "string", "vendor_id_suggestion": "string e.g. IND-MR", "country": "string", "currency": "string" },',
  '  "po": {',
  '    "invoice_number": "string",',
  '    "invoice_date": "YYYY-MM-DD",',
  '    "reference_number": "string or null",',
  '    "items_summary": "string",',
  '    "qty_total": 0,',
  '    "currency": "INR",',
  '    "subtotal_foreign": 0,',
  '    "gst_foreign": 0,',
  '    "shipping_foreign": 0,',
  '    "gateway_fee_foreign": 0,',
  '    "other_charges_foreign": 0,',
  '    "grand_total_foreign": 0,',
  '    "notes": "string"',
  '  },',
  '  "line_items": [',
  '    {',
  '      "sku_original": "exact SKU from invoice e.g. BG-665-72",',
  '      "sku_suggestion": "prefixed SKU e.g. MR-BG-665-72",',
  '      "product_name": "descriptive name e.g. Bangle BG-665-72 Ruby Green 2x2",',
  '      "category": "Bangles|Necklaces|Earrings|Bracelets|Rings|Sets|Anklets|Other",',
  '      "color": "string",',
  '      "size": "string or null",',
  '      "qty": 0,',
  '      "unit_cost_foreign": 0,',
  '      "line_total_foreign": 0,',
  '      "section": "REGULAR PRODUCTS|NET PRICED PRODUCTS|OTHER"',
  '    }',
  '  ],',
  '  "payment": { "amount_foreign": 0, "currency": "INR", "notes": "string" },',
  '  "parsing_notes": "any ambiguities or missing data"',
  '}',
  '',
  'IMPORTANT: payment.amount_foreign must equal po.grand_total_foreign.',
  'Category mapping: BG- = Bangles, CH- = Necklaces, ER- = Earrings.',
  'Extract ALL line items. Do not skip any SKU.',
  'vendor_id_suggestion: initials e.g. Manek Ratna = IND-MR.',
].join('\n')

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = (file.type && file.type !== 'application/octet-stream') ? file.type : 'application/pdf'

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
            { type: 'document', source: { type: 'base64', media_type: mimeType, data: base64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ error: 'Claude API error: ' + err }, { status: 500 })
    }

    const claudeData = await response.json()
    const rawText: string = claudeData.content?.[0]?.text || ''

    let cleaned = rawText.trim()
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const jsonStart = cleaned.search(/[{[]/)
    if (jsonStart > 0) cleaned = cleaned.slice(jsonStart)
    const firstChar = cleaned[0]
    if (firstChar === '{' || firstChar === '[') {
      const lastIdx = cleaned.lastIndexOf(firstChar === '{' ? '}' : ']')
      if (lastIdx > 0) cleaned = cleaned.slice(0, lastIdx + 1)
    }

    try {
      const parsed = JSON.parse(cleaned)
      return NextResponse.json({ success: true, data: parsed })
    } catch {
      return NextResponse.json({ error: 'Failed to parse JSON', raw: rawText.substring(0, 500) }, { status: 500 })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
