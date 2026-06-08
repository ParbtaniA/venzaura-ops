-- VenzAura Operations Platform — Supabase Schema
-- Run this entire file in Supabase SQL Editor

-- VENDORS
create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  vendor_id text unique not null,
  name text not null,
  country text not null,
  currency text not null default 'INR',
  contact_name text,
  contact_email text,
  whatsapp text,
  payment_method text,
  bank_details text,
  avg_lead_days integer,
  min_order_usd numeric(10,2),
  notes text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PURCHASE ORDERS
create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text unique not null,
  order_date date not null,
  vendor_id uuid references vendors(id) on delete restrict,
  invoice_number text,
  items_summary text,
  qty_total integer,
  unit_cost_foreign numeric(12,2),
  currency text not null default 'INR',
  fx_rate numeric(12,6),
  freight_usd numeric(10,2) default 0,
  duties_usd numeric(10,2) default 0,
  other_fees_usd numeric(10,2) default 0,
  expected_arrival date,
  actual_arrival date,
  status text not null default 'Ordered'
    check (status in ('Ordered','In Transit','Received','Cancelled')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Computed columns as generated columns
alter table purchase_orders
  add column if not exists subtotal_usd numeric(12,2)
    generated always as (unit_cost_foreign * fx_rate) stored;

alter table purchase_orders
  add column if not exists landed_cost_usd numeric(12,2)
    generated always as (
      (unit_cost_foreign * fx_rate) + freight_usd + duties_usd + other_fees_usd
    ) stored;

-- LINE ITEMS
create table if not exists line_items (
  id uuid primary key default gen_random_uuid(),
  line_id text unique not null,
  po_id uuid references purchase_orders(id) on delete cascade,
  vendor_id uuid references vendors(id) on delete restrict,
  sku text not null,
  product_name text not null,
  category text not null
    check (category in ('Necklaces','Earrings','Bracelets','Bangles','Rings','Sets','Anklets','Other')),
  qty_ordered integer not null,
  unit_cost_foreign numeric(10,2) not null,
  currency text not null default 'INR',
  fx_rate numeric(12,6) not null,
  freight_share_pct numeric(5,2) default 15,
  shopify_price numeric(10,2),
  shopify_handle text,
  shopify_product_id text,
  product_description text,
  tags text,
  image_url text,
  compare_at_price numeric(10,2),
  weight_grams numeric(8,2),
  ready_to_upload boolean default false,
  shopify_published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table line_items
  add column if not exists unit_cost_usd numeric(10,2)
    generated always as (unit_cost_foreign * fx_rate) stored;

alter table line_items
  add column if not exists landed_cost_per_unit numeric(10,2)
    generated always as (
      (unit_cost_foreign * fx_rate) * (1 + freight_share_pct / 100)
    ) stored;

alter table line_items
  add column if not exists total_landed_cost numeric(12,2)
    generated always as (
      qty_ordered * ((unit_cost_foreign * fx_rate) * (1 + freight_share_pct / 100))
    ) stored;

alter table line_items
  add column if not exists margin_pct numeric(5,2)
    generated always as (
      case when shopify_price > 0 then
        ((shopify_price - (unit_cost_foreign * fx_rate * (1 + freight_share_pct / 100))) / shopify_price) * 100
      else null end
    ) stored;

-- PAYMENTS
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  payment_id text unique not null,
  payment_date date not null,
  vendor_id uuid references vendors(id) on delete restrict,
  po_id uuid references purchase_orders(id) on delete set null,
  payment_method text not null
    check (payment_method in ('Wire (SWIFT)','PayPal','Zelle','ACH','Other')),
  amount_foreign numeric(12,2) not null,
  currency text not null default 'INR',
  fx_rate numeric(12,6) not null,
  wire_fee_usd numeric(8,2) default 0,
  bank_account text,
  reference_number text,
  logged_in_qbo boolean default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table payments
  add column if not exists amount_usd numeric(12,2)
    generated always as (amount_foreign * fx_rate) stored;

alter table payments
  add column if not exists total_out_usd numeric(12,2)
    generated always as ((amount_foreign * fx_rate) + wire_fee_usd) stored;

-- SHOPIFY ORDERS
create table if not exists shopify_orders (
  id uuid primary key default gen_random_uuid(),
  shopify_order_id text unique not null,
  order_number text,
  order_date timestamptz not null,
  customer_name text,
  customer_email text,
  total_price numeric(10,2),
  subtotal_price numeric(10,2),
  total_tax numeric(10,2),
  total_discounts numeric(10,2),
  financial_status text,
  fulfillment_status text,
  line_items jsonb,
  created_at timestamptz default now()
);

-- MONTHLY REPORTS
create table if not exists monthly_reports (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  month integer not null check (month between 1 and 12),
  gross_revenue numeric(12,2) default 0,
  refunds numeric(12,2) default 0,
  net_revenue numeric(12,2) default 0,
  shopify_fees numeric(10,2) default 0,
  vendor_payments numeric(12,2) default 0,
  wire_fees numeric(10,2) default 0,
  freight_duties numeric(10,2) default 0,
  shopify_subscription numeric(8,2) default 39,
  other_expenses numeric(10,2) default 0,
  total_expenses numeric(12,2) default 0,
  gross_profit numeric(12,2) default 0,
  gross_margin_pct numeric(5,2) default 0,
  top_skus jsonb,
  notes text,
  finalized boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(year, month)
);

-- INDEXES
create index if not exists idx_po_vendor on purchase_orders(vendor_id);
create index if not exists idx_po_status on purchase_orders(status);
create index if not exists idx_li_po on line_items(po_id);
create index if not exists idx_li_sku on line_items(sku);
create index if not exists idx_li_ready on line_items(ready_to_upload);
create index if not exists idx_payments_vendor on payments(vendor_id);
create index if not exists idx_payments_date on payments(payment_date);
create index if not exists idx_orders_date on shopify_orders(order_date);
create index if not exists idx_reports_period on monthly_reports(year, month);

-- UPDATED_AT TRIGGER
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create or replace trigger vendors_updated_at before update on vendors
  for each row execute function update_updated_at();
create or replace trigger po_updated_at before update on purchase_orders
  for each row execute function update_updated_at();
create or replace trigger li_updated_at before update on line_items
  for each row execute function update_updated_at();
create or replace trigger payments_updated_at before update on payments
  for each row execute function update_updated_at();
create or replace trigger reports_updated_at before update on monthly_reports
  for each row execute function update_updated_at();

-- ROW LEVEL SECURITY
alter table vendors enable row level security;
alter table purchase_orders enable row level security;
alter table line_items enable row level security;
alter table payments enable row level security;
alter table shopify_orders enable row level security;
alter table monthly_reports enable row level security;

-- Policies: allow all for authenticated users
do $$ begin
  if not exists (select 1 from pg_policies where tablename='vendors' and policyname='auth_all_vendors') then
    create policy "auth_all_vendors" on vendors for all using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='purchase_orders' and policyname='auth_all_po') then
    create policy "auth_all_po" on purchase_orders for all using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='line_items' and policyname='auth_all_li') then
    create policy "auth_all_li" on line_items for all using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='payments' and policyname='auth_all_payments') then
    create policy "auth_all_payments" on payments for all using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='shopify_orders' and policyname='auth_all_orders') then
    create policy "auth_all_orders" on shopify_orders for all using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='monthly_reports' and policyname='auth_all_reports') then
    create policy "auth_all_reports" on monthly_reports for all using (auth.role() = 'authenticated');
  end if;
end $$;
