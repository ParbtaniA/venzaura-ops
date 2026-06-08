import { createServerClient } from '@/lib/supabase'
import InventoryClient from './InventoryClient'

export default async function InventoryPage() {
  const { data } = await createServerClient().from('line_items')
    .select('*, vendor:vendors(name), purchase_order:purchase_orders(po_number,status)')
    .order('ready_to_upload', { ascending: false })
  return <InventoryClient items={data || []} />
}
