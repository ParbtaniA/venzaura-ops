import { supabase } from '@/lib/supabase'
import LineItemsClient from './LineItemsClient'

export default async function LineItemsPage() {
  const [{ data: items }, { data: pos }, { data: vendors }] = await Promise.all([
    supabase.from('line_items').select('*, vendor:vendors(name,vendor_id), purchase_order:purchase_orders(po_number)').order('created_at', { ascending: false }),
    supabase.from('purchase_orders').select('id,po_number').order('po_number'),
    supabase.from('vendors').select('id,vendor_id,name').eq('active', true),
  ])
  return <LineItemsClient items={items || []} pos={pos || []} vendors={vendors || []} />
}
