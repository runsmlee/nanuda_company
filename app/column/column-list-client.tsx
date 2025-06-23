"use client"

import Link from "next/link"
import { BLOG_POSTS } from "@/lib/blog-data"

export default function ColumnListClient() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {BLOG_POSTS.map((post, index) => (
        <Link key={post.id} href={`/column/${post.id}`} className="group cursor-pointer">
          <article className="relative transition-all duration-400 hover:-translate-y-2">
            <div className="aspect-[4/3] overflow-hidden rounded-lg mb-6 relative">
              <img
                src={post.image || "/placeholder.svg"}
                alt={post.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute top-4 right-4 bg-black/80 px-3 py-1 rounded-full">
                <span className="text-accent-orange text-sm font-medium">{post.category}</span>
              </div>
              <div className="absolute bottom-4 left-4 text-white text-sm">
                <span>{post.date}</span>
                <span className="mx-2">•</span>
                <span>{post.readTime} 읽기</span>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-semibold leading-tight group-hover:text-accent-orange transition-colors">
                {post.title}
              </h2>
              <p className="text-text-gray leading-relaxed">{post.excerpt}</p>

              <div className="flex items-center justify-between pt-4 border-t border-text-gray/20">
                <span className="text-text-gray text-sm">by {post.author}</span>
                <div className="flex gap-2">
                  {post.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="text-xs bg-primary-dark px-2 py-1 rounded text-text-gray">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </Link>
      ))}
    </div>
  )
} 