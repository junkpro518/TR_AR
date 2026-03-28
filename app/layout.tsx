import type { Metadata } from 'next'
import './globals.css'
import { BottomNav } from '@/components/BottomNav'

export const metadata: Metadata = {
  title: 'مُعلِّم | تعلم التركية والإنجليزية',
  description: 'معلم لغات شخصي بالذكاء الاصطناعي — يتكيّف مع مستواك ويتتبع تقدمك',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        {children}
        <BottomNav />
      </body>
    </html>
  )
}
