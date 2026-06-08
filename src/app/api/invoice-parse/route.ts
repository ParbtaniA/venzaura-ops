import { NextRequest, NextResponse } from 'next/server'

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
  '  "payment": { "amount_foreign": USE_GRAND_TOTAL_FROM_PO, "currency": "INR", "notes": "string" },',
  '  "parsing_notes": "any ambiguities or missing data"',
  '}',
  '',
  'Category mapping: BG- = Bangles, CH- = Necklaces, ER- = Earrings, NK- = Necklaces, BR- = Bracelets, RN-/RG- = Rings, ST-/SET- = Sets.',
  'Extract ALL line items including REGULAR PRODUCTS and NET PRICED PRODUCTS. Do not skip any SKU.',
  'For vendor_id_suggestion: take initials of vendor name e.g. Manek Ratna = IND-MR, Rajesh Jewels = IND-RJ.',
].join('\n')

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = (file.type && file.type !== 'application/octet-stream')
      ? file.type
      : 'application/pdf'

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: mimeType, data: base64 },
            },
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

    // Robustly extract JSON from Claude's response
    let cleaned = rawText.trim()
    // Strip markdown code fences if present
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    // If there's preamble text before the JSON object, find where JSON starts
    const jsonStart = cleaned.search(/[{[]/)
    if (jsonStart > 0) cleaned = cleaned.slice(jsonStart)
    // Trim any trailing text after the closing brace/bracket
    const firstChar = cleaned[0]
    if (firstChar === '{' || firstChar === '[') {
      const lastChar = firstChar === '{' ? '}' : ']'
      const lastIdx = cleaned.lastIndexOf(lastChar)
      if (lastIdx > 0) cleaned = cleaned.slice(0, lastIdx + 1)
    }

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse Claude response as JSON', raw: rawText },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: parsed })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
