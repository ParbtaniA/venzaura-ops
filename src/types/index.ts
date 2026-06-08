export type VendorStatus = 'active' | 'inactive'
export type POStatus = 'Ordered' | 'In Transit' | 'Received' | 'Cancelled'
export type PaymentMethod = 'Wire (SWIFT)' | 'PayPal' | 'Zelle' | 'ACH' | 'Other'
export type Category = 'Necklaces' | 'Earrings' | 'Bracelets' | 'Bangles' | 'Rings' | 'Sets' | 'Anklets' | 'Other'
export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'CNY'

export interface Vendor {
  id: string
  vendor_id: string
  name: string
  country: string
  currency: Currency
  contact_name?: string
  contact_email?: string
  whatsapp?: string
  payment_method?: PaymentMethod
  bank_details?: string
  avg_lead_days?: number
  min_order_usd?: number
  notes?: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface PurchaseOrder {
  id: string
  po_number: string
  order_date: string
  vendor_id: string
  invoice_number?: string
  items_summary?: string
  qty_total?: number
  unit_cost_foreign?: number
  currency: Currency
  fx_rate?: number
  subtotal_usd?: number
  freight_usd: number
  duties_usd: number
  other_fees_usd: number
  landed_cost_usd?: number
  expected_arrival?: string
  actual_arrival?: string
  status: POStatus
  notes?: string
  created_at: string
  updated_at: string
  vendor?: Vendor
}

export interface LineItem {
  id: string
  line_id: string
  po_id: string
  vendor_id: string
  sku: string
  product_name: string
  category: Category
  qty_ordered: number
  unit_cost_foreign: number
  currency: Currency
  fx_rate: number
  unit_cost_usd?: number
  freight_share_pct: number
  landed_cost_per_unit?: number
  total_landed_cost?: number
  shopify_price?: number
  margin_pct?: number
  shopify_handle?: string
  shopify_product_id?: string
  product_description?: string
  tags?: string
  image_url?: string
  compare_at_price?: number
  weight_grams?: number
  ready_to_upload: boolean
  shopify_published: boolean
  created_at: string
  updated_at: string
  vendor?: Vendor
  purchase_order?: PurchaseOrder
}

export interface Payment {
  id: string
  payment_id: string
  payment_date: string
  vendor_id: string
  po_id?: string
  payment_method: PaymentMethod
  amount_foreign: number
  currency: Currency
  fx_rate: number
  amount_usd?: number
  wire_fee_usd: number
  total_out_usd?: number
  bank_account?: string
  reference_number?: string
  logged_in_qbo: boolean
  notes?: string
  created_at: string
  updated_at: string
  vendor?: Vendor
  purchase_order?: PurchaseOrder
}

export interface ShopifyOrder {
  id: string
  shopify_order_id: string
  order_number?: string
  order_date: string
  customer_name?: string
  customer_email?: string
  total_price?: number
  subtotal_price?: number
  total_tax?: number
  total_discounts?: number
  financial_status?: string
  fulfillment_status?: string
  line_items?: ShopifyLineItem[]
  created_at: string
}

export interface ShopifyLineItem {
  id: string
  title: string
  sku?: string
  quantity: number
  price: string
  vendor?: string
}

export interface MonthlyReport {
  id: string
  year: number
  month: number
  gross_revenue: number
  refunds: number
  net_revenue: number
  shopify_fees: number
  vendor_payments: number
  wire_fees: number
  freight_duties: number
  shopify_subscription: number
  other_expenses: number
  total_expenses: number
  gross_profit: number
  gross_margin_pct: number
  top_skus?: TopSKU[]
  notes?: string
  finalized: boolean
  created_at: string
  updated_at: string
}

export interface TopSKU {
  sku: string
  name: string
  qty: number
  revenue: number
}

export interface DashboardStats {
  totalVendors: number
  activeVendors: number
  openPOs: number
  totalPOValue: number
  readyToUpload: number
  publishedProducts: number
  mtdRevenue: number
  mtdOrders: number
  totalPaymentsOut: number
  pendingQBO: number
  avgMargin: number
}
