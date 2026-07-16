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
}

export default nextConfig
