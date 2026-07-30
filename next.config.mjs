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
      // Service worker — never cache
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      // /_next/static/chunks — these include server-action client reference manifests
      // (e.g. app/actions/data:xxxx) which are NOT content-hashed in Turbopack dev mode.
      // Must always be revalidated to prevent "module factory not available" errors.
      {
        source: '/_next/static/chunks/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
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
