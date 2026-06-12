import { MetadataRoute } from 'next'
import { BOOKS_DATA } from '@/lib/books-data'
import { BLOG_POSTS } from '@/lib/blog-data'
import {
  bookPublishedDate,
  bookUrl,
  columnUrl,
  SITE_UPDATED_AT,
  SITE_URL,
} from '@/lib/site-config'

const siteUpdatedAt = new Date(SITE_UPDATED_AT)
const latestBlogDate = BLOG_POSTS.reduce((latest, post) => {
  const postDate = new Date(post.date)
  return postDate > latest ? postDate : latest
}, siteUpdatedAt)

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    {
      url: SITE_URL,
      lastModified: siteUpdatedAt,
      changeFrequency: 'weekly' as const,
      priority: 1,
    },
    {
      url: `${SITE_URL}/column`,
      lastModified: latestBlogDate,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
  ]

  const bookPages = BOOKS_DATA.map((book) => ({
    url: bookUrl(book.id),
    lastModified: new Date(bookPublishedDate(book)),
    changeFrequency: 'monthly' as const,
    priority: 0.9,
  }))

  const blogPages = BLOG_POSTS.map((post) => ({
    url: columnUrl(post.id),
    lastModified: new Date(post.date),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...bookPages, ...blogPages]
}
