import type { MetadataRoute } from 'next'
import { SITE_META_DESCRIPTION, SITE_NAME } from '@/lib/site-config'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: `${SITE_NAME} - 나누다컴퍼니`,
    short_name: SITE_NAME,
    description: SITE_META_DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#242424',
    theme_color: '#D97706',
    lang: 'ko-KR',
    categories: ['books', 'education', 'lifestyle'],
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
