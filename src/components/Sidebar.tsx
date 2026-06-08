'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/', icon: '◈', label: 'Dashboard' },
  { href: '/upload', icon: '⊕', label: 'Import Invoice' },
  { href: '/vendors', icon: '⊞', label: 'Vendors' },
  { href: '/purchase-orders', icon: '⊟', label: 'Purchase Orders' },
  { href: '/line-items', icon: '≡', label: 'Line Items / SKUs' },
  { href: '/inventory', icon: '⊡', label: 'Inventory' },
  { href: '/payments', icon: '⊠', label: 'Payment Log' },
  { href: '/orders', icon: '◉', label: 'Shopify Orders' },
  { href: '/reports', icon: '⊕', label: 'Reports' },
]

export default function Sidebar() {
  const path = usePathname()
  return (
    <aside className="w-56 flex-shrink-0 border-r border-zinc-800 flex flex-col h-screen bg-zinc-950">
      <div className="px-4 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[#C9A84C] flex items-center justify-center">
            <span className="text-zinc-950 text-xs font-bold">V</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100">VenzAura</p>
            <p className="text-xs text-zinc-500">Operations</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        <p className="text-xs text-zinc-600 uppercase tracking-widest px-3 mb-2">Menu</p>
        {nav.map(({ href, icon, label }) => {
          const active = path === href || (href !== '/' && path.startsWith(href))
          return (
            <Link key={href} href={href} className={active ? 'sidebar-link-active' : 'sidebar-link'}>
              <span className="text-base w-4 text-center gold-accent">{icon}</span>
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="px-4 py-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">VenzAura Ops v1.0</p>
        <p className="text-xs text-zinc-700">ayaz@venzaura.com</p>
      </div>
    </aside>
  )
}
