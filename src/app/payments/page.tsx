import { createServerClient } from '@/lib/supabase'
import PaymentsClient from './PaymentsClient'

export default async function PaymentsPage() {
  const [{ data: payments }, { data: vendors }, { data: pos }] = await Promise.all([
    createServerClient().from('payments').select('*, vendor:vendors(name,vendor_id), purchase_order:purchase_orders(po_number)').order('payment_date', { ascending: false }),
    createServerClient().from('vendors').select('id,vendor_id,name').eq('active', true),
    createServerClient().from('purchase_orders').select('id,po_number').order('po_number'),
  ])
  return <PaymentsClient payments={payments || []} vendors={vendors || []} pos={pos || []} />
}
