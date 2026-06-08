import urllib.request, json

with open('/tmp/test_invoice.pdf', 'rb') as f:
    pdf_data = f.read()

boundary = 'venzaura_xyz'
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
        print('SUCCESS:', json.dumps(result['data'], indent=2)[:300])
except urllib.error.HTTPError as e:
    full = json.loads(e.read().decode())
    raw = full.get('raw', '')
    print('RAW LEN:', len(raw))
    print('LAST 200:', raw[-200:])
    # Try to parse the raw ourselves
    try:
        cleaned = raw.strip()
        # find last } 
        last = cleaned.rfind('}')
        if last > 0:
            cleaned = cleaned[:last+1]
        parsed = json.loads(cleaned)
        print('PARSED OK — items:', len(parsed.get('line_items', [])))
    except Exception as pe:
        print('MANUAL PARSE FAIL:', str(pe))
        print('PROBLEM AREA:', raw[max(0,len(raw)-300):])
except Exception as e:
    print('EXC:', str(e))
