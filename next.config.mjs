/** @type {import('next').NextConfig} */
const nextConfig = {
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
  async redirects() {
    return [
      // apex(non-www) → www 영구(308) 리다이렉트로 도메인 정규화 통합.
      // Vercel 엣지에서 처리되면 이 규칙은 도달하지 않지만, 코드로 308을 보장한다.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'nanudacompany.com' }],
        destination: 'https://www.nanudacompany.com/:path*',
        permanent: true,
      },
    ]
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
        source: '/books/meet-on-the-road/:path*',
        headers: [
          {
            key: 'Content-Language',
            value: 'en',
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
