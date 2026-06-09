/** @type {import('next').NextConfig} */

const BACKEND_URL = process.env.BACKEND_URL || 'https://ross-house-backend-production.up.railway.app';

const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['localhost', 'images.pexels.com', 'app-nueva-production.up.railway.app', 'ross-house-backend-production.up.railway.app'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
}

module.exports = nextConfig
