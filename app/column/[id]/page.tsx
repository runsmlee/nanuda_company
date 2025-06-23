"use client"

import { useParams } from "next/navigation"
import { useEffect } from "react"
import Link from "next/link"
import { CustomCursor } from "@/components/custom-cursor"
import { BLOG_POSTS } from "@/components/blog-section"

// SEO를 위한 메타데이터 (실제 구현시 Next.js metadata API 사용)
const generateMetadata = (post: any) => ({
  title: `${post.title} | 나누다 칼럼`,
  description: post.excerpt,
  keywords: post.tags.join(", "),
  author: post.author,
  publishedTime: post.date,
})

export default function ColumnDetailPage() {
  const params = useParams()
  const post = BLOG_POSTS.find((p) => p.id === params.id)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [params.id])

  if (!post) {
    return (
      <div className="min-h-screen bg-primary-dark text-text-light flex items-center justify-center">
        <CustomCursor />
        <div className="text-center">
          <h1 className="text-4xl font-playfair mb-4">칼럼을 찾을 수 없습니다</h1>
          <Link href="/column" className="text-accent-orange hover:underline cursor-pointer">
            칼럼 목록으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  // 샘플 칼럼 내용 (실제로는 CMS나 마크다운에서 가져올 예정)
  const sampleContent = {
    "annapurna-behind-story": {
      content: `
        <p>안나푸르나 베이스캠프로 향하는 길에서 만난 가장 인상 깊었던 순간은 책에 담지 못한 이야기들이 많습니다.</p>
        
        <h2>예상치 못한 만남</h2>
        <p>고도 3,000미터를 넘어서면서 숨이 가빠지기 시작했을 때, 한 네팔 할머니를 만났습니다. 그분은 70세가 넘은 나이에도 매일 이 길을 오르내리며 생계를 이어가고 계셨죠.</p>
        
        <blockquote>"산은 우리에게 겸손함을 가르쳐준다"</blockquote>
        
        <p>할머니의 이 말씀이 지금도 제 마음에 깊이 남아있습니다. 히말라야의 웅장함 앞에서 느꼈던 인간의 작음, 그리고 그 작은 존재가 보여주는 강인함에 대해 생각해보게 되었습니다.</p>
        
        <h2>책에 담지 못한 이야기</h2>
        <p>실제로는 더 많은 에피소드들이 있었지만, 책의 분량과 흐름상 포함시키지 못한 이야기들이 있습니다. 이런 이야기들을 칼럼을 통해 조금씩 나누어보려 합니다.</p>
      `,
    },
    "travel-writing-tips": {
      content: `
        <p>10년간 여행을 다니며 글을 써온 경험을 바탕으로, 기억에 남는 여행기를 쓰는 방법을 나누어보겠습니다.</p>
        
        <h2>1. 오감으로 기록하기</h2>
        <p>여행지에서 보고, 듣고, 냄새 맡고, 맛보고, 만진 모든 감각을 기록해두세요. 나중에 글을 쓸 때 생생함을 되살려주는 중요한 단서가 됩니다.</p>
        
        <h2>2. 사람과의 만남에 집중하기</h2>
        <p>풍경은 사진으로도 충분히 전달되지만, 사람과의 만남에서 얻은 감동은 글로만 전달할 수 있습니다.</p>
        
        <h2>3. 실패와 당황스러웠던 순간들</h2>
        <p>완벽한 여행보다는 예상치 못한 상황들, 실수들, 그리고 그것을 통해 배운 것들이 더 흥미로운 이야기가 됩니다.</p>
      `,
    },
    "family-travel-philosophy": {
      content: `
        <p>아이와 함께하는 여행은 단순한 휴가가 아닙니다. 그것은 아이의 세계관을 넓혀주고, 가족 간의 유대감을 깊게 만드는 특별한 경험입니다.</p>
        
        <h2>여행이 아이에게 주는 선물</h2>
        <p>새로운 환경에서 아이들은 적응력을 기르고, 다양성을 받아들이는 법을 배웁니다. 이는 책으로는 배울 수 없는 살아있는 교육입니다.</p>
        
        <h2>부모도 함께 성장하는 시간</h2>
        <p>아이의 눈으로 세상을 다시 보게 되면서, 어른인 우리도 새로운 발견을 하게 됩니다. 아이의 순수한 호기심이 우리의 고정관념을 깨뜨려주죠.</p>
        
        <blockquote>"아이는 여행에서 세상을 배우고, 부모는 아이에게서 세상을 다시 배운다"</blockquote>
      `,
    },
  }

  const content = sampleContent[post.id as keyof typeof sampleContent]?.content || "<p>콘텐츠를 준비 중입니다.</p>"

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
          className="prose prose-lg prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: content }}
          style={{
            lineHeight: "1.8",
            fontSize: "1.125rem",
          }}
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
