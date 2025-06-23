import Link from "next/link"
import { notFound } from "next/navigation"
import { CustomCursor } from "@/components/custom-cursor"
import { BLOG_POSTS } from "@/lib/blog-data"
import { getBlogPostContent, getAllBlogPostIds } from "@/lib/markdown"
import { Metadata } from "next"

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateStaticParams() {
  const paths = getAllBlogPostIds()
  return paths.map((path) => ({
    id: path.params.id,
  }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const post = BLOG_POSTS.find((p) => p.id === id)
  
  if (!post) {
    return {
      title: "칼럼을 찾을 수 없습니다",
    }
  }

  return {
    title: `${post.title} | 나누다 칼럼`,
    description: post.excerpt,
    keywords: post.tags.join(", "),
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [post.image],
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [post.image],
    },
  }
}

export default async function ColumnDetailPage({ params }: PageProps) {
  const { id } = await params
  const post = BLOG_POSTS.find((p) => p.id === id)
  
  if (!post) {
    notFound()
  }

  // 마크다운 파일에서 콘텐츠 읽기
  const markdownContent = await getBlogPostContent(id)
  const content = markdownContent?.contentHtml || "<p>콘텐츠를 준비 중입니다.</p>"

  return (
    <div className="min-h-screen bg-primary-dark text-text-light">
      <CustomCursor />

      {/* Navigation */}
      <nav className="p-6 border-b border-text-gray/20">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-accent-orange hover:underline cursor-pointer">
            홈
          </Link>
          <span className="text-text-gray">•</span>
          <Link href="/column" className="text-accent-orange hover:underline cursor-pointer">
            칼럼
          </Link>
          <span className="text-text-gray">•</span>
          <span className="text-text-gray">{post.title}</span>
        </div>
      </nav>

      {/* Article */}
      <article className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <header className="mb-12">
          <div className="aspect-[16/9] rounded-lg overflow-hidden mb-8">
            <img src={post.image || "/placeholder.svg"} alt={post.title} className="w-full h-full object-cover" />
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm text-text-gray">
              <span className="bg-accent-orange text-white px-3 py-1 rounded-full">{post.category}</span>
              <span>{post.date}</span>
              <span>•</span>
              <span>{post.readTime} 읽기</span>
              <span>•</span>
              <span>by {post.author}</span>
            </div>

            <h1 className="font-playfair text-4xl lg:text-5xl font-normal leading-tight">{post.title}</h1>

            <p className="text-xl text-text-gray leading-relaxed">{post.excerpt}</p>

            <div className="flex gap-2 pt-4">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-sm bg-secondary-dark px-3 py-1 rounded text-text-gray cursor-pointer hover:bg-accent-orange hover:text-white transition-colors"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* Content */}
        <div
          className="prose prose-lg prose-invert max-w-none [&>h1]:text-3xl [&>h1]:font-playfair [&>h1]:font-normal [&>h1]:mb-6 [&>h1]:mt-12 [&>h2]:text-2xl [&>h2]:font-semibold [&>h2]:mb-4 [&>h2]:mt-10 [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:mb-3 [&>h3]:mt-8 [&>p]:mb-6 [&>p]:leading-relaxed [&>blockquote]:border-l-4 [&>blockquote]:border-accent-orange [&>blockquote]:pl-6 [&>blockquote]:italic [&>blockquote]:text-text-gray [&>blockquote]:my-8 [&>ul]:mb-6 [&>ul]:pl-6 [&>li]:mb-2 [&>strong]:text-accent-orange [&>img]:rounded-lg [&>img]:my-8"
          dangerouslySetInnerHTML={{ __html: content }}
        />

        {/* Share & Navigation */}
        <footer className="mt-16 pt-8 border-t border-text-gray/20">
          <div className="flex justify-between items-center">
            <div className="space-x-4">
              <span className="text-text-gray">공유하기:</span>
              <button className="text-accent-orange hover:underline cursor-pointer">Facebook</button>
              <button className="text-accent-orange hover:underline cursor-pointer">Twitter</button>
              <button className="text-accent-orange hover:underline cursor-pointer">링크 복사</button>
            </div>

            <Link
              href="/column"
              className="bg-accent-orange text-white px-6 py-3 rounded-lg hover:bg-accent-orange/90 transition-colors cursor-pointer"
            >
              다른 칼럼 보기
            </Link>
          </div>
        </footer>

        {/* Related Posts */}
        <div className="mt-16 pt-16 border-t border-text-gray/20">
          <h2 className="text-3xl font-playfair font-normal mb-8">관련 칼럼</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {BLOG_POSTS.filter((p) => p.id !== post.id && p.category === post.category)
              .slice(0, 2)
              .map((relatedPost) => (
                <Link key={relatedPost.id} href={`/column/${relatedPost.id}`} className="group cursor-pointer">
                  <div className="bg-secondary-dark rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
                    <div className="aspect-[16/9] overflow-hidden">
                      <img
                        src={relatedPost.image || "/placeholder.svg"}
                        alt={relatedPost.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-6">
                      <h3 className="font-semibold mb-2 group-hover:text-accent-orange transition-colors">
                        {relatedPost.title}
                      </h3>
                      <p className="text-text-gray text-sm">{relatedPost.excerpt}</p>
                    </div>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </article>
    </div>
  )
}
