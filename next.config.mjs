/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // ccxt uses CJS internals (protobufjs) that must not be bundled by Turbopack
  serverExternalPackages: ['ccxt', 'protobufjs'],

  // Compression and optimization
  compress: true,
  productionBrowserSourceMaps: false,
  swcMinify: true,
  optimizeFonts: true,
  optimizePackageImports: ['@radix-ui/react-dialog'],

  // PWA: service worker must never be cached so updates are picked up immediately
  async headers() {
    return [
      // Service worker — no cache
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
      // Manifest
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
      // Static assets — cache for 1 year (versioned by Next.js)
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
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

  // Response headers for security and performance
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/api/health',
          destination: '/api/health',
        },
      ],
    }
  },
}

export default nextConfig
