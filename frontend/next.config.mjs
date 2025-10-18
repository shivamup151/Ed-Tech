/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    authInterrupts: true,
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Optimize resource loading
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Reduce preloading warnings
  poweredByHeader: false,
  generateEtags: false,
};

export default nextConfig;
