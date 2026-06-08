import { createServerClient } from '@/lib/supabase'
import OrdersClient from './OrdersClient'

export default async function OrdersPage() {
  const { data } = await createServerClient().from('shopify_orders')
    .select('*').order('order_date', { ascending: false }).limit(200)
  return <OrdersClient orders={data || []} />
}
