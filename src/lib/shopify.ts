import type { LineItem } from '@/types'

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN!
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN!
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-07'
const BASE_URL = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}`

async function shopifyFetch(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_TOKEN,
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Shopify API error ${res.status}: ${err}`)
  }
  return res.json()
}

export async function pushProductToShopify(item: LineItem): Promise<string> {
  const handle = item.shopify_handle ||
    item.product_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const product = {
    title: item.product_name,
    body_html: item.product_description || `<p>${item.product_name}</p>`,
    vendor: 'VenzAura',
    product_type: item.category,
    tags: item.tags || `${item.category.toLowerCase()}, venzaura, imitation jewelry`,
    handle,
    status: 'active',
    variants: [{
      sku: item.sku,
      price: item.shopify_price?.toFixed(2) || '0.00',
      compare_at_price: item.compare_at_price?.toFixed(2) || null,
      inventory_management: 'shopify',
      inventory_quantity: item.qty_ordered,
      weight: item.weight_grams || 50,
      weight_unit: 'g',
      cost: item.landed_cost_per_unit?.toFixed(2) || '0.00',
      taxable: true,
      requires_shipping: true,
    }],
    images: item.image_url ? [{ src: item.image_url, alt: item.product_name }] : [],
  }

  const data = await shopifyFetch('/products.json', {
    method: 'POST',
    body: JSON.stringify({ product }),
  })

  return data.product.id.toString()
}

export async function updateShopifyProduct(shopifyProductId: string, item: Partial<LineItem>) {
  const updates: Record<string, unknown> = {}
  if (item.shopify_price !== undefined) {
    updates.variants = [{ price: item.shopify_price.toFixed(2) }]
  }
  if (item.product_name) updates.title = item.product_name
  if (item.product_description) updates.body_html = item.product_description

  return shopifyFetch(`/products/${shopifyProductId}.json`, {
    method: 'PUT',
    body: JSON.stringify({ product: updates }),
  })
}

export async function syncShopifyOrders(since?: string) {
  const dateParam = since ? `&created_at_min=${since}` : ''
  const data = await shopifyFetch(
    `/orders.json?status=any&limit=250&fields=id,name,created_at,customer,total_price,subtotal_price,total_tax,total_discounts,financial_status,fulfillment_status,line_items${dateParam}`
  )
  return data.orders
}

export async function getOrdersForPeriod(startDate: string, endDate: string) {
  const data = await shopifyFetch(
    `/orders.json?status=any&limit=250&created_at_min=${startDate}&created_at_max=${endDate}&fields=id,name,created_at,total_price,subtotal_price,financial_status,line_items`
  )
  return data.orders
}

export async function getShopifyRevenueSummary(year: number, month: number) {
  const start = new Date(year, month - 1, 1).toISOString()
  const end = new Date(year, month, 0, 23, 59, 59).toISOString()
  const orders = await getOrdersForPeriod(start, end)

  const paid = orders.filter((o: { financial_status: string }) =>
    ['paid', 'partially_paid'].includes(o.financial_status)
  )

  const gross = paid.reduce((sum: number, o: { total_price: string }) =>
    sum + parseFloat(o.total_price || '0'), 0)

  const itemCounts: Record<string, { name: string; qty: number; revenue: number }> = {}
  for (const order of paid) {
    for (const item of (order.line_items || [])) {
      const key = item.sku || item.title
      if (!itemCounts[key]) itemCounts[key] = { name: item.title, qty: 0, revenue: 0 }
      itemCounts[key].qty += item.quantity
      itemCounts[key].revenue += parseFloat(item.price) * item.quantity
    }
  }

  const topSkus = Object.entries(itemCounts)
    .map(([sku, v]) => ({ sku, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  return { gross, orderCount: paid.length, topSkus }
}
