/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cache bust: clear stale module references (v3 - clear phantom app/actions/data)
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['ccxt', 'protobufjs'],

  // Compression and optimization
  compress: true,
  productionBrowserSourceMaps: false,
  swcMinify: true,
  optimizeFonts: true,
  optimizePackageImports: [
    'lucide-react',
    'framer-motion',
    '@radix-ui/react-dialog',
    '@radix-ui/react-label',
    '@radix-ui/react-select',
    '@radix-ui/react-tabs',
    '@radix-ui/react-tooltip',
    '@radix-ui/react-dropdown-menu',
    '@base-ui/react',
  ],

  // PWA: service worker must never be cached so updates are picked up immediately
  async headers() {
    return [
      // Service worker — never cache
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      // /_next/static — content-hashed by Next.js; safe to cache for 1 year
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Manifest
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
      // Images — cache for 30 days
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000' },
        ],
      },
      // API routes — no cache (dynamic)
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-cache, no-store, must-revalidate' },
        ],
      },
    ]
  },

}

export default nextConfig
