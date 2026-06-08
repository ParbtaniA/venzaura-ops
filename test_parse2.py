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
        print(resp.read().decode()[:600])
except urllib.error.HTTPError as e:
    body_err = e.read().decode()
    print('HTTP', e.code, ':', body_err[:600])
except Exception as e:
    print('EXC:', str(e)[:400])
