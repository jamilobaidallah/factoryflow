/** @type {import('next').NextConfig} */

// When building the Electron desktop app, output static files that Electron
// can load directly without a running server.
const isElectronBuild = process.env.NEXT_BUILD_TARGET === 'electron';

const nextConfig = {
  ...(isElectronBuild && {
    output: 'export',
    // Assets use default leading-slash paths. In Electron, the custom
    // app:// protocol handler resolves /_next/static/... to the matching
    // file inside the static export directory.
  }),

  images: {
    // Static export can't use Next.js image optimization (requires server)
    ...(isElectronBuild && { unoptimized: true }),
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // Performance optimizations
  reactStrictMode: true,

  // Enable SWC minification for faster builds
  swcMinify: true,

  // Optimize package imports - tree shake heavy libraries
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-tooltip',
    ],
  },

  // Compiler options for production optimization
  compiler: {
    // Remove console.log in production (keep console.error and console.warn)
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  // Headers for caching static assets (not used in Electron static export)
  ...(!isElectronBuild && { async headers() {
    return [
      {
        source: '/:all*(svg|jpg|png|webp|avif|ico|woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  } }),
}

module.exports = nextConfig;
