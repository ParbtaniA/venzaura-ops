import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'VenzAura Ops',
  description: 'VenzAura Operations Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden bg-zinc-950">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-7xl mx-auto">{children}</div>
        </main>
      </body>
    </html>
  )
}
