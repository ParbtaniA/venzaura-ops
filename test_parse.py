import urllib.request, json, sys

with open('/tmp/test_invoice.pdf', 'rb') as f:
    pdf_data = f.read()

boundary = 'venzaura_boundary_xyz'
crlf = b'\r\n'
body = (
    b'--' + boundary.encode() + crlf +
    b'Content-Disposition: form-data; name="file"; filename="invoice.pdf"' + crlf +
    b'Content-Type: application/pdf' + crlf + crlf +
    pdf_data + crlf +
    b'--' + boundary.encode() + b'--' + crlf
)

req = urllib.request.Request(
    'http://localhost:3000/api/invoice-parse',
    data=body, method='POST',
    headers={'Content-Type': 'multipart/form-data; boundary=' + boundary}
)

try:
    with urllib.request.urlopen(req, timeout=90) as resp:
        result = json.loads(resp.read())
    if result.get('error'):
        print('API ERROR:', result['error'][:400])
        if result.get('raw'):
            print('RAW:', result['raw'][:200])
    else:
        p = result['data']
        print('SUCCESS')
        print('Vendor:', p['vendor']['name'], '|', p['vendor']['vendor_id_suggestion'])
        print('Invoice:', p['po']['invoice_number'], '|', p['po']['invoice_date'])
        print('Items:', len(p['line_items']))
        print('Grand Total INR:', p['po']['grand_total_foreign'])
        print('Notes:', p.get('parsing_notes', '')[:150])
        print()
        for i, item in enumerate(p['line_items'][:5]):
            print(f"  {i+1}. {item['sku_original']} | {item['product_name']} | qty:{item['qty']} | {item['unit_cost_foreign']} INR")
        if len(p['line_items']) > 5:
            print(f"  ... and {len(p['line_items'])-5} more")
except Exception as e:
    print('EXCEPTION:', str(e)[:400])
