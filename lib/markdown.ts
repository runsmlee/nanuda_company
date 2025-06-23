import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { remark } from 'remark'
import html from 'remark-html'

const postsDirectory = path.join(process.cwd(), 'content/blog')

export async function getBlogPostContent(id: string) {
  try {
    const fullPath = path.join(postsDirectory, `${id}.md`)
    
    if (!fs.existsSync(fullPath)) {
      return null
    }
    
    const fileContents = fs.readFileSync(fullPath, 'utf8')
    const matterResult = matter(fileContents)
    
    // 마크다운을 HTML로 변환
    const processedContent = await remark()
      .use(html)
      .process(matterResult.content)
    
    const contentHtml = processedContent.toString()
    
    return {
      id,
      contentHtml,
      ...matterResult.data,
    }
  } catch (error) {
    console.error(`Error reading blog post ${id}:`, error)
    return null
  }
}

export function getAllBlogPostIds() {
  try {
    if (!fs.existsSync(postsDirectory)) {
      return []
    }
    
    const fileNames = fs.readdirSync(postsDirectory)
    return fileNames
      .filter(fileName => fileName.endsWith('.md'))
      .map(fileName => ({
        params: {
          id: fileName.replace(/\.md$/, ''),
        },
      }))
  } catch (error) {
    console.error('Error reading blog directory:', error)
    return []
  }
} 