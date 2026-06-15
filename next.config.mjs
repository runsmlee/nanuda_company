/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: false,  // 이미지 최적화 활성화
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.nanudacompany.com',
        port: '',
        pathname: '/images/**',
      }
    ],
  },
  async headers() {
    return [
      {
        source: '/images/book-reader/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, noimageindex, noarchive, nosnippet',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}

export default nextConfig
