import { createServerClient } from '@/lib/supabase'
import POClient from './POClient'

export default async function POPage() {
  const [{ data: pos }, { data: vendors }] = await Promise.all([
    createServerClient().from('purchase_orders').select('*, vendor:vendors(name,vendor_id)').order('order_date', { ascending: false }),
    createServerClient().from('vendors').select('id,vendor_id,name').eq('active', true),
  ])
  return <POClient pos={pos || []} vendors={vendors || []} />
}
