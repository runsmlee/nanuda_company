import Link from "next/link"
import { CustomCursor } from "@/components/custom-cursor"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-primary-dark text-text-light flex items-center justify-center">
      <CustomCursor />
      <div className="text-center">
        <h1 className="text-6xl font-playfair mb-4">404</h1>
        <h2 className="text-2xl font-playfair mb-6">칼럼을 찾을 수 없습니다</h2>
        <p className="text-text-gray mb-8">
          요청하신 칼럼이 존재하지 않거나 삭제되었을 수 있습니다.
        </p>
        <Link 
          href="/column" 
          className="bg-accent-orange text-white px-6 py-3 rounded-lg hover:bg-accent-orange/90 transition-colors cursor-pointer inline-block"
        >
          칼럼 목록으로 돌아가기
        </Link>
      </div>
    </div>
  )
} 