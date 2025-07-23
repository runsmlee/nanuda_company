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
        hostname: 'nanudacompany.com',
        port: '',
        pathname: '/images/**',
      }
    ],
  },
}

export default nextConfig
