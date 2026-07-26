// node --experimental-strip-types lib/publishing/typeset.test.mjs
//
// 인쇄 결과가 곧 종이라서, 원고에서 글자가 깨지거나 마크업이 새어 나오면
// 그대로 배송된다. 그 두 지점만 지킨다.

import assert from "node:assert/strict"
import { joinWrappedLines, parseManuscript, stripInlineMarkdown } from "./typeset.ts"

// 1. 이미지는 통째로 빠지고, 링크는 글자만 남는다.
assert.equal(
  stripInlineMarkdown("![건어물이 담배꽁초를 줍는 모습](/blog_images/trash_2.jpg)").trim(),
  "",
)
assert.equal(
  stripInlineMarkdown("출처: [네이버 도서 보기](https://search.shopping.naver.com/book/1)"),
  "출처: 네이버 도서 보기",
)

// 2. 강조 기호는 사라지고 글자는 남는다.
assert.equal(stripInlineMarkdown("**삶의 비밀**은 `죽기` 전에 *죽는* 것"), "삶의 비밀은 죽기 전에 죽는 것")

// 3. 짝이 아닌 별표·밑줄은 건드리지 않는다 — 저자의 장식과 낱말을 지킨다.
assert.equal(stripInlineMarkdown("*** 3장 ***"), "*** 3장 ***")
assert.equal(stripInlineMarkdown("파일은 my_file_name 이다"), "파일은 my_file_name 이다")
assert.equal(stripInlineMarkdown("별점 5*"), "별점 5*")

// 4. 한글 어절은 줄바꿈에서 깨지지 않는다 (붙임), 문장부호 뒤는 띄운다.
assert.equal(joinWrappedLines(["그는 남자", "가 되었다."]), "그는 남자가 되었다.")
assert.equal(joinWrappedLines(["끝났다.", "다음 날 아침"]), "끝났다. 다음 날 아침")

// 5. 제목에도 마크업이 남지 않는다.
const chapters = parseManuscript("# **1장** 시작\n\n첫 문단.")
assert.equal(chapters[0].title, "1장 시작")
assert.equal(chapters[0].paragraphs[0], "첫 문단.")

console.log("typeset: 5개 통과")
