import { supabase } from '@/lib/supabase'
import POClient from './POClient'

export default async function POPage() {
  const [{ data: pos }, { data: vendors }] = await Promise.all([
    supabase.from('purchase_orders').select('*, vendor:vendors(name,vendor_id)').order('order_date', { ascending: false }),
    supabase.from('vendors').select('id,vendor_id,name').eq('active', true),
  ])
  return <POClient pos={pos || []} vendors={vendors || []} />
}
