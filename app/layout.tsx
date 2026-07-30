import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'ArbitrageIQ — Discover Arbitrage Opportunities Before Everyone Else',
  description: 'Monitor prices across global exchanges, compare spreads, estimate transaction costs, and identify potential arbitrage opportunities using AI-powered analytics.',
  generator: 'v0.app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ArbitrageIQ',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
      {
        url: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#050816' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={inter.className} style={{ backgroundColor: '#050816' }}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ArbitrageIQ" />
      </head>
      <body className="antialiased font-sans" style={{ backgroundColor: '#050816', color: '#FFFFFF' }}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
        <SwCleanup />
      </body>
    </html>
  )
}

// Unregisters ALL service workers and clears ALL caches so stale JS chunks
// never block page loads. Runs once on every page load — no re-registration.
function SwCleanup() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function() {
  if (!('serviceWorker' in navigator)) return;
  // Unregister every SW registration
  navigator.serviceWorker.getRegistrations().then(function(regs) {
    regs.forEach(function(reg) { reg.unregister(); });
  });
  // Delete every Cache Storage entry
  if (window.caches) {
    caches.keys().then(function(names) {
      names.forEach(function(name) { caches.delete(name); });
    });
  }
})();
        `,
      }}
    />
  )
}
