import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { pushProductToShopify } from '@/lib/shopify'

export async function POST(req: NextRequest) {
  const { itemIds } = await req.json()
  const db = createServerClient()
  const log: string[] = []
  const ids: Record<string, string> = {}

  const { data: items, error } = await db.from('line_items').select('*').in('id', itemIds)
  if (error || !items) {
    return NextResponse.json({ success: false, log: ['Failed to fetch items from database'] }, { status: 500 })
  }

  for (const item of items) {
    try {
      log.push(`→ Pushing ${item.sku} — ${item.product_name}`)
      const shopifyId = await pushProductToShopify(item)
      await db.from('line_items').update({ shopify_published: true, shopify_product_id: shopifyId }).eq('id', item.id)
      ids[item.id] = shopifyId
      log.push(`✓ ${item.sku} is live on Shopify (#${shopifyId})`)
    } catch (e: unknown) {
      log.push(`✗ ${item.sku} failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const successCount = Object.keys(ids).length
  log.push(`\nDone: ${successCount}/${items.length} products pushed.`)
  return NextResponse.json({ success: successCount === items.length, log, ids })
}
