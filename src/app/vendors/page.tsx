import { createServerClient } from '@/lib/supabase'
import VendorsClient from './VendorsClient'

export default async function VendorsPage() {
  const { data } = await createServerClient().from('vendors').select('*').order('created_at', { ascending: false })
  return <VendorsClient vendors={data || []} />
}
