import { supabase } from '@/lib/supabase'
import ReportsClient from './ReportsClient'

export default async function ReportsPage() {
  const { data } = await supabase.from('monthly_reports')
    .select('*').order('year', { ascending: false }).order('month', { ascending: false })
  return <ReportsClient reports={data || []} />
}
