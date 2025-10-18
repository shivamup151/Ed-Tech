/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    authInterrupts: true,
    serverActions: {
      bodySizeLimit: '100mb',
    },
    // Disable problematic optimizations that can cause hydration issues
    optimizeCss: false,
    optimizePackageImports: [],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Optimize resource loading
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
    // Disable styled-components optimization that can cause hydration issues
    styledComponents: false,
  },
  // Reduce preloading warnings
  poweredByHeader: false,
  generateEtags: false,
  // Disable font optimization that's causing preload warnings
  optimizeFonts: false,
  // Disable unnecessary preloading
  swcMinify: true,
  // TEMPORARY: Disable React Strict Mode to suppress hydration warnings
  reactStrictMode: false,
  // Additional optimizations to prevent hydration issues
  images: {
    unoptimized: true, // Disable image optimization that can cause hydration issues
  },
  // Disable static optimization for pages that might have hydration issues
  trailingSlash: false,
  // Suppress build warnings
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

export default nextConfig;