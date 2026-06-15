import { MetadataRoute } from 'next'
import { BOOKS_DATA } from '@/lib/books-data'
import { BLOG_POSTS } from '@/lib/blog-data'
import { AUTHORS } from '@/lib/authors-data'
import { getAllBookReaderIds, getBookReaderIndex } from '@/lib/book-reader'
import {
  authorUrl,
  bookChapterUrl,
  bookPublishedDate,
  bookReaderUrl,
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

  const readerPages = getAllBookReaderIds().flatMap((bookId) => {
    const index = getBookReaderIndex(bookId)
    if (!index) return []

    return [
      {
        url: bookReaderUrl(bookId),
        lastModified: siteUpdatedAt,
        changeFrequency: 'monthly' as const,
        priority: 0.85,
      },
      ...index.chapters.map((chapter) => ({
        url: bookChapterUrl(bookId, chapter.slug),
        lastModified: siteUpdatedAt,
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      })),
    ]
  })

  const blogPages = BLOG_POSTS.map((post) => ({
    url: columnUrl(post.id),
    lastModified: new Date(post.date),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  const authorPages = AUTHORS.map((author) => ({
    url: authorUrl(author.slug),
    lastModified: siteUpdatedAt,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  return [...staticPages, ...bookPages, ...readerPages, ...blogPages, ...authorPages]
}
