// pnpm exec tsx lib/publishing/typeset.test.mjs
//
// 인쇄 결과가 곧 종이라서, 원고에서 글자가 깨지거나 구조가 빠지면 그대로 배송된다.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { crc32 } from "node:zlib"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { decodeText, parseDocx, parseManuscriptFile, parseTextManuscript } from "./manuscript.ts"
import { renderCover } from "./cover.ts"
import {
  estimatePages,
  joinWrappedLines,
  parseInlines,
  parseManuscript,
  stripInlineMarkdown,
  typeset,
} from "./typeset.ts"

const PT = 72 / 25.4
const mm = (pt) => (pt * 25.4) / 72

function zipStore(files) {
  const parts = []
  const centrals = []
  let offset = 0
  for (const [name, text] of files) {
    const data = Buffer.from(text)
    const nameBuf = Buffer.from(name)
    const crc = crc32(data)
    const local = Buffer.alloc(30 + nameBuf.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0, 12)
    local.writeUInt32LE(crc >>> 0, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    nameBuf.copy(local, 30)
    parts.push(local, data)
    const central = Buffer.alloc(46 + nameBuf.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0, 14)
    central.writeUInt32LE(crc >>> 0, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt32LE(offset, 42)
    nameBuf.copy(central, 46)
    centrals.push(central)
    offset += local.length + data.length
  }
  const centralBuf = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(centralBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, centralBuf, eocd])
}

function docx(paragraphs, styles = [], numberingXml = "") {
  const body = paragraphs.join("")
  const styleXml = styles
    .map(
      (s) =>
        `<w:style w:type="paragraph" w:styleId="${s.id}"><w:name w:val="${s.name}"/></w:style>`,
    )
    .join("")
  const numberingType = numberingXml
    ? `\n  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>`
    : ""
  const numberingRel = numberingXml
    ? `\n  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>`
    : ""
  const files = [
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>${numberingType}
</Types>`,
    ],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    ],
    [
      "word/_rels/document.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${numberingRel}
</Relationships>`,
    ],
    [
      "word/styles.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${styleXml}</w:styles>`,
    ],
    [
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
    ],
  ]
  if (numberingXml) files.push(["word/numbering.xml", numberingXml])
  return zipStore(files)
}

const p = (text, style) => {
  const pr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""
  return `<w:p>${pr}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
}

function plainOf(runs) {
  return runs.map((r) => r.text).join("")
}

function blockText(chapter) {
  return chapter.paragraphs.join("\n")
}

// 1. 이미지는 통째로 빠지고, 링크는 글자만 남는다.
assert.equal(stripInlineMarkdown("![건어물이 담배꽁초를 줍는 모습](/blog_images/trash_2.jpg)").trim(), "")
assert.equal(stripInlineMarkdown("출처: [네이버 도서 보기](https://search.shopping.naver.com/book/1)"), "출처: 네이버 도서 보기")

// 2. 강조 기호는 사라지고 글자는 남는다.
assert.equal(stripInlineMarkdown("**삶의 비밀**은 `죽기` 전에 *죽는* 것"), "삶의 비밀은 죽기 전에 죽는 것")

// 3. 짝이 아닌 별표·밑줄은 건드리지 않는다.
assert.equal(stripInlineMarkdown("*** 3장 ***"), "*** 3장 ***")
assert.equal(stripInlineMarkdown("파일은 my_file_name 이다"), "파일은 my_file_name 이다")
assert.equal(stripInlineMarkdown("별점 5*"), "별점 5*")

// 4. 어절 규칙. 조사·조각은 붙이고, 다음 단어와 문장부호 뒤는 띄운다.
assert.equal(joinWrappedLines(["그는 남자", "가 되었다."]), "그는 남자가 되었다.")
assert.equal(joinWrappedLines(["끝났다.", "다음 날 아침"]), "끝났다. 다음 날 아침")
assert.equal(joinWrappedLines(["시작되", "었다"]), "시작되었다")
assert.equal(joinWrappedLines(["함", "께"]), "함께")
assert.equal(joinWrappedLines(["주위", "를"]), "주위를")
assert.equal(joinWrappedLines(["사무실", "로"]), "사무실로")
assert.equal(joinWrappedLines(["살아가는 내", "일상에"]), "살아가는 내 일상에")
assert.equal(joinWrappedLines(["있는", "한 사람"]), "있는 한 사람")
assert.equal(joinWrappedLines(["눈이 마주치면", "웃음을 지었다."]), "눈이 마주치면 웃음을 지었다.")
assert.equal(joinWrappedLines(["비가", "다시"]), "비가 다시")
assert.equal(joinWrappedLines(["사람", "할 일이 있다"]), "사람 할 일이 있다")

// 5. 제목에도 마크업이 남지 않는다. 강조는 런으로 남는다.
const chapters = parseManuscript("# **1장** 시작\n\n첫 문단.")
assert.equal(chapters[0].title, "1장 시작")
assert.equal(chapters[0].paragraphs[0], "첫 문단.")
assert.equal(plainOf(parseInlines("**삶의 비밀**은 `죽기` 전에 *죽는* 것")), stripInlineMarkdown("**삶의 비밀**은 `죽기` 전에 *죽는* 것"))
const bold = parseInlines("**삶의 비밀**은 남는다.")
assert.equal(bold.some((r) => r.bold && r.text === "삶의 비밀"), true)
assert.equal(plainOf(bold), "삶의 비밀은 남는다.")

// 장식 줄은 장면 구분선이 아니다.
const deco = parseManuscript("*** 3장 ***\n\n본문")
assert.equal(deco[0].blocks[0].kind, "p")
assert.equal(deco[0].paragraphs[0], "*** 3장 ***")

// 하드랩은 문단 안에서 잇고, 줄 끝 공백 두 칸은 줄바꿈으로 남긴다.
assert.equal(parseManuscript("그는 남자\n가 되었다.").map(blockText).join("\n"), "그는 남자가 되었다.")
const verse = parseManuscript("첫 줄의 시  \n둘째 줄의 시")
assert.equal(verse[0].blocks[0].kind, "p")
assert.equal(verse[0].blocks[0].lines.length, 2)
assert.equal(plainOf(verse[0].blocks[0].lines[0]), "첫 줄의 시")
assert.equal(plainOf(verse[0].blocks[0].lines[1]), "둘째 줄의 시")

// 마크다운 목록·표·깊은 제목·프론트매터.
const listed = parseManuscript("- 사과를 샀다\n- 배를 깎았다\n- 감을 말렸다")
assert.equal(listed[0].blocks[0].kind, "list")
assert.equal(listed[0].blocks[0].items.length, 3)
assert.equal(listed[0].paragraphs.join(" "), "사과를 샀다 배를 깎았다 감을 말렸다")
const numbered = parseManuscript("1. 하나\n2. 둘")
assert.equal(numbered[0].blocks[0].ordered, true)
assert.equal(numbered[0].blocks[0].start, 1)
assert.equal(numbered[0].paragraphs.join(" "), "하나 둘")
const steps = parseManuscript("5. 다섯째 단계\n6. 여섯째 단계\n\n다음 설명\n\n7. 일곱째 단계")
const stepLists = steps[0].blocks.filter((b) => b.kind === "list")
assert.equal(stepLists.length, 2)
assert.equal(stepLists[0].start, 5)
assert.equal(stepLists[0].items.length, 2)
assert.equal(stepLists[1].start, 7)
assert.equal(steps[0].paragraphs.join(" ").includes("다음 설명"), true)
const jumped = parseManuscript("1. 가\n2. 나\n4. 다")
const jumpedLists = jumped[0].blocks.filter((b) => b.kind === "list")
assert.equal(jumpedLists.length, 2)
assert.equal(jumpedLists[1].start, 4)
const pi = parseManuscript("3.14는 원주율이다.")
assert.equal(pi[0].blocks[0].kind, "p")
const numberedDot = parseManuscript("3. 14는 번호다.")
assert.equal(numberedDot[0].blocks[0].kind, "list")
assert.equal(numberedDot[0].blocks[0].start, 3)

const tabled = parseManuscript("| 이름 | 수량 |\n| --- | --- |\n| 사과 | 둘 |")
assert.equal(tabled[0].blocks[0].kind, "table")
assert.equal(tabled[0].paragraphs.includes("사과"), true)
assert.equal(tabled[0].paragraphs.join(" ").includes("|"), false)

const deep = parseManuscript("# 장\n\n#### 4단계 제목\n\n본문")
assert.equal(deep[0].title, "장")
assert.equal(deep[0].blocks.some((b) => b.kind === "h" && b.level === 4 && plainOf(b.runs) === "4단계 제목"), true)
assert.equal(deep[0].paragraphs.join(" ").includes("####"), false)

const onlyDeep = parseManuscript("## 둘째 단계만\n\n본문이다")
assert.equal(onlyDeep[0].title, "둘째 단계만")

const yaml = parseManuscript("---\ntitle: 프론트매터는 본문이 아니다\n---\n\n본문이다.\n")
assert.equal(yaml.length, 1)
assert.equal(yaml[0].title, "")
assert.equal(yaml[0].paragraphs[0], "본문이다.")
assert.equal(yaml[0].paragraphs.join("\n").includes("프론트매터"), false)
const yamlList = parseManuscript("---\n# 메모\ntitle: x\n- 항목\n  이어짐\n---\n\n본문이다.\n")
assert.equal(yamlList[0].paragraphs[0], "본문이다.")
assert.equal(yamlList[0].paragraphs.join("").includes("항목"), false)
const scenes = parseManuscript("---\n\n첫 장면\n\n---\n\n둘째 장면")
assert.equal(scenes[0].paragraphs.includes("첫 장면"), true)
assert.equal(scenes[0].paragraphs.includes("둘째 장면"), true)
const emptyFence = parseManuscript("---\n---\n\n본문이다.")
assert.equal(emptyFence[0].paragraphs[0], "본문이다.")
assert.equal(emptyFence[0].paragraphs.join("").includes("---"), false)

const quoted = parseManuscript("> 인용된 문장\n> 다음 줄")
assert.equal(quoted[0].blocks[0].kind, "quote")
assert.equal(quoted[0].paragraphs.join(" ").includes(">"), false)
assert.equal(quoted[0].paragraphs.join(" ").includes("인용된 문장"), true)

const rule = parseManuscript("앞 문단\n\n---\n\n뒤 문단")
assert.equal(rule[0].blocks.some((b) => b.kind === "rule"), true)

const linked = parseTextManuscript("본문 [표시만](https://example.com/a) 끝\n\n![풍경 사진입니다](pic)\n")
const linkedText = linked.chapters.flatMap((c) => c.paragraphs).join(" ")
assert.equal(linkedText.includes("example.com"), false)
assert.equal(linkedText.includes("표시만"), true)
assert.equal(linkedText.includes("풍경 사진입니다"), true)
assert.equal(linked.notes.some((n) => n.includes("이미지")), true)

assert.equal(estimatePages(849, "normal"), 3)

const euc = Buffer.from([177, 215, 180, 194, 32, 179, 178, 192, 218, 176, 161, 32, 181, 199, 190, 250, 180, 217, 46])
assert.equal(decodeText(euc), "그는 남자가 되었다.")
const annyeong = Buffer.from([190, 200, 179, 231, 199, 207, 188, 188, 191, 228])
assert.equal(decodeText(annyeong), "안녕하세요")
const eucSentence = Buffer.from([
  177, 215, 180, 194, 32, 199, 208, 177, 179, 191, 161, 32, 176, 172, 180, 217, 46, 32, 186, 241, 176, 161, 32, 191,
  212, 180, 217, 46,
])
assert.equal(decodeText(eucSentence), "그는 학교에 갔다. 비가 왔다.")
let nulFree = ""
for (let cp = 0xac00; nulFree.length < 40; cp++) {
  if ((cp & 0xff) === 0) continue
  nulFree += String.fromCodePoint(cp)
}
assert.equal(decodeText(Buffer.from(nulFree, "utf16le")), nulFree)
assert.equal(decodeText(Buffer.from(nulFree, "utf16le").swap16()), nulFree)
const utf16 = Buffer.from("그는 남자가 되었다.", "utf16le")
assert.equal(decodeText(utf16), "그는 남자가 되었다.")
const utf16be = Buffer.alloc(2 + utf16.length)
utf16be[0] = 0xfe
utf16be[1] = 0xff
for (let i = 0; i < utf16.length; i += 2) {
  utf16be[2 + i] = utf16[i + 1]
  utf16be[3 + i] = utf16[i]
}
assert.equal(decodeText(utf16be), "그는 남자가 되었다.")
const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("# 봄제목\n\n본문")])
const bomParsed = await parseManuscriptFile("bom.txt", bom)
assert.equal(bomParsed.chapters[0].title, "봄제목")
await assert.rejects(() => parseManuscriptFile("x.txt", Buffer.from([0x80, 0xff, 0x80])), /인코딩/)
await assert.rejects(() => parseManuscriptFile("a.hwp", Buffer.from("x")), /한글/)
await assert.rejects(() => parseManuscriptFile("a.doc", Buffer.from("x")), /docx/)
await assert.rejects(() => parseManuscriptFile("a.pdf", Buffer.from("x")), /PDF/)

const styled = docx(
  [
    p("첫째 장", "a1"),
    `<w:p><w:r><w:t xml:space="preserve">그는 </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>남자</w:t></w:r><w:r><w:t>가 되었다.</w:t></w:r></w:p>`,
    `<w:p><w:r><w:t>첫 줄의 시</w:t></w:r><w:r><w:br/></w:r><w:r><w:t>둘째 줄의 시</w:t></w:r></w:p>`,
    `<w:p><w:r><w:rPr><w:i/></w:rPr><w:t>기울임</w:t></w:r></w:p>`,
    p("둘째 장", "b1"),
    p("제목만", "c1"),
    p("이어지는 본문"),
  ],
  [
    { id: "a1", name: "제목 1" },
    { id: "b1", name: "개요 1" },
    { id: "c1", name: "Title" },
  ],
)
const word = await parseDocx(styled)
assert.deepEqual(word.chapters.map((c) => c.title), ["첫째 장", "둘째 장", "제목만"])
assert.equal(word.notes.some((n) => n.includes("제외") && n.includes("표")), false)
const firstBlocks = word.chapters[0].blocks
const boldPara = firstBlocks.find((b) => b.kind === "p" && plainOf(b.lines.flat()).includes("남자"))
assert.equal(boldPara.lines.flat().some((r) => r.bold && r.text.includes("남자")), true)
const broken = firstBlocks.find((b) => b.kind === "p" && b.lines.length > 1)
assert.equal(plainOf(broken.lines[0]), "첫 줄의 시")
assert.equal(plainOf(broken.lines[1]), "둘째 줄의 시")
assert.equal(blockText(word.chapters[0]).includes("첫 줄의 시둘째"), false)
assert.equal(firstBlocks.some((b) => b.kind === "p" && b.lines.flat().some((r) => r.italic && r.text.includes("기울임"))), true)

const shallow = await parseDocx(
  docx([p("유일한 장", "d2"), p("본문이다")], [{ id: "d2", name: "제목 2" }]),
)
assert.equal(shallow.chapters[0].title, "유일한 장")
assert.equal(shallow.chapters[0].paragraphs[0], "본문이다")

const listDoc = readFileSync(new URL("../../node_modules/mammoth/test/test-data/simple-list.docx", import.meta.url))
const lists = await parseDocx(listDoc)
assert.equal(lists.charCount > 0, true)
assert.equal(lists.chapters[0].blocks.some((b) => b.kind === "list"), true)
assert.equal(lists.chapters[0].paragraphs.join(" "), "Apple Banana")

const tableDoc = readFileSync(new URL("../../node_modules/mammoth/test/test-data/tables.docx", import.meta.url))
const tables = await parseDocx(tableDoc)
assert.equal(tables.notes.some((n) => n.includes("표") && n.includes("제외")), false)
assert.equal(tables.chapters[0].blocks.some((b) => b.kind === "table"), true)
const cells = tables.chapters[0].paragraphs.join(" ")
assert.equal(cells.includes("Top left"), true)
assert.equal(cells.includes("Bottom right"), true)
assert.equal(cells.includes("Above"), true)

const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl>
    <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`
const numItem = (text, level) =>
  `<w:p><w:pPr><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`
const cellListDoc = await parseDocx(
  docx(
    [
      `<w:tbl><w:tr><w:tc>${p("Cell lead")}${numItem("Apple", 0)}${numItem("Banana", 0)}${p("Cell tail")}</w:tc></w:tr></w:tbl>`,
    ],
    [],
    NUMBERING,
  ),
)
const cellBlocks = cellListDoc.chapters[0].blocks
assert.equal(cellBlocks.some((b) => b.kind === "list"), false)
assert.equal(cellBlocks.some((b) => b.kind === "table"), true)
const cellPlain = cellListDoc.chapters[0].paragraphs.join(" ")
const at = (s) => cellPlain.indexOf(s)
assert.ok(at("Cell lead") >= 0 && at("Cell lead") < at("Apple") && at("Apple") < at("Banana") && at("Banana") < at("Cell tail"))
const nestedDoc = await parseDocx(docx([numItem("A", 0), numItem("B", 1), numItem("C", 0)], [], NUMBERING))
const nestedLists = nestedDoc.chapters[0].blocks.filter((b) => b.kind === "list")
assert.deepEqual(
  nestedLists.map((b) => b.items.map((item) => item.flat().map((r) => r.text).join("")).join("")),
  ["A", "B", "C"],
)

function a5(over = {}) {
  return {
    trimWidthMm: 148,
    trimHeightMm: 210,
    bleedMm: 3,
    textSize: "normal",
    pageIncrement: 2,
    pageMin: 4,
    pageMax: 40,
    chapterStartsNewPage: true,
    title: "테스트 책",
    authorName: "테스트 저자",
    watermark: false,
    ...over,
  }
}

async function readPdf(buf) {
  const doc = await getDocument({ data: new Uint8Array(buf), disableWorker: true, verbosity: 0 }).promise
  const pages = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    // 글자 레이어의 fontName은 g_d0_f1 같은 내부 이름이다. 연산자 목록을 연 뒤에야 실제 BaseFont가 풀린다.
    await page.getOperatorList()
    const fontOf = (id) => {
      if (!id || !page.commonObjs.has(id)) return id || ""
      return page.commonObjs.get(id)?.name || id
    }
    const view = page.view
    pages.push({
      wMm: mm(view[2] - view[0]),
      hMm: mm(view[3] - view[1]),
      items: content.items
        .filter((item) => item.str)
        .map((item) => ({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          w: item.width,
          h: item.height || 0,
          font: fontOf(item.fontName),
          b: item.transform[1],
          a: item.transform[0],
        })),
    })
  }
  return pages
}

function pageText(page) {
  return page.items.map((item) => item.str).join("")
}

function baselineText(page) {
  const items = page.items.filter((it) => Math.abs(it.b) <= Math.abs(it.a))
  const rows = new Map()
  for (const it of items) {
    const key = Math.round(it.y)
    const row = rows.get(key) ?? []
    row.push(it)
    rows.set(key, row)
  }
  const lines = []
  for (const row of rows.values()) {
    row.sort((a, b) => a.x - b.x)
    let s = ""
    for (let i = 0; i < row.length; i++) {
      if (i > 0) {
        const gap = row[i].x - (row[i - 1].x + row[i - 1].w)
        if (gap > 0.6) s += " "
      }
      s += row[i].str
    }
    lines.push(s)
  }
  return lines
}

function maxGapMm(items) {
  const rows = new Map()
  for (const item of items) {
    const key = Math.round(item.y)
    const row = rows.get(key) ?? []
    row.push(item)
    rows.set(key, row)
  }
  let max = 0
  for (const row of rows.values()) {
    row.sort((a, b) => a.x - b.x)
    for (let i = 1; i < row.length; i++) {
      const gap = row[i].x - (row[i - 1].x + row[i - 1].w)
      if (gap > max) max = gap
    }
  }
  return mm(max)
}

const prose = await typeset(
  [
    {
      title: "주소",
      paragraphs: [],
      blocks: [
        {
          kind: "p",
          lines: [
            [
              {
                text: "참고 주소는 https://example.com/trimmed/page/of/the/printed/book/and/still/going 이다. 그리고 다음 말이 이어진다. 그는 남자가 되었다.",
              },
            ],
          ],
        },
        {
          kind: "p",
          lines: [[{ text: "굵은 ", bold: false }, { text: "비밀", bold: true }, { text: " 과 기울임 ", bold: false }, { text: "말", italic: true }]],
        },
      ],
    },
  ],
  a5(),
)
const prosePages = await readPdf(prose.pdf)
assert.equal(prosePages.every((p) => Math.abs(p.wMm - 154) < 0.05 && Math.abs(p.hMm - 216) < 0.05), true)
assert.equal(prose.withinSpec, true)
const urlPage = prosePages.find((p) => pageText(p).includes("example.com") || pageText(p).includes("이다"))
assert.ok(urlPage)
assert.equal(pageText(urlPage).includes("이다"), true)
assert.equal(pageText(urlPage).includes("그리고"), true)
assert.equal(maxGapMm(urlPage.items) < 4, true, `word gap ${maxGapMm(urlPage.items).toFixed(2)}mm`)
const allProse = prosePages.map(pageText).join("\n")
assert.equal(allProse.includes("기울임"), true)
assert.equal(allProse.includes("비밀"), true)
const boldItem = prosePages.flatMap((p) => p.items).find((item) => item.str.includes("비밀"))
assert.ok(boldItem)
assert.match(boldItem.font, /Bold/i)
const italicItem = prosePages.flatMap((p) => p.items).find((item) => item.str.includes("말"))
assert.ok(italicItem)

const body = prosePages[2]
const leftMm = mm(Math.min(...body.items.map((item) => item.x)))
const rightGap = 154 - mm(Math.max(...body.items.map((item) => item.x + item.w)))
assert.ok(Math.abs(leftMm - 21) < 1.5, `left ${leftMm}`)
assert.ok(Math.abs(rightGap - 17) < 1.5, `right gap ${rightGap}`)

// 여는 따옴표로 시작하는 어절은 닫는 부호가 아니다. 줄에 다 안 들어가면 다음 줄로 넘긴다.
const kinsoku = await typeset(
  [
    {
      title: "인용",
      paragraphs: [
        "마침 부활절이기도 하여 이곳 교회를 방문하게 되었는데, 성경을 통해 '임마누엘'이라는 이름의 원뜻이 '하나님이 함께하신다'라는 것을 알게 되었다.",
        "그는 말했다. 」라고 적힌 문장은 본문을 남긴다.",
        "앞. 」라고",
        "값 .5끝",
      ],
    },
  ],
  a5(),
)
const kinsokuPages = await readPdf(kinsoku.pdf)
const kinsokuText = kinsokuPages.map(pageText).join("\n")
assert.equal(kinsokuText.includes("임마누엘"), true)
assert.equal(kinsokuText.includes("하나님이 함께하신다"), true)
assert.equal(kinsokuText.includes("라고 적힌"), true)
const kinsokuLines = kinsokuPages.flatMap(baselineText)
assert.equal(kinsokuLines.some((line) => line.includes("」라고")), true)
assert.equal(kinsokuLines.some((line) => line.includes("」 라고")), false)
assert.equal(kinsokuLines.some((line) => line.includes(".5")), true)
assert.equal(kinsokuLines.some((line) => line.includes(". 5")), false)
for (const p of kinsokuPages) {
  for (const item of p.items) {
    if (Math.abs(item.b) > Math.abs(item.a)) continue
    const right = mm(item.x + item.w)
    assert.ok(right < 154 - 10, `ink ${right.toFixed(1)}mm 「${item.str.slice(0, 40)}」`)
  }
}
assert.equal(prosePages[0].items.some((item) => item.str === "1"), false)
assert.equal(prosePages[1].items.some((item) => item.str === "2"), false)
assert.equal(body.items.some((item) => item.str === "3"), true)
assert.equal(pageText(prosePages[0]).includes("테스트 책"), true)
assert.equal(pageText(prosePages[1]).includes("생각을나누다"), true)

const recto = await typeset(
  [
    { title: "첫째", paragraphs: ["짧은 첫째 장."] },
    { title: "둘째", paragraphs: ["짧은 둘째 장."] },
  ],
  a5(),
)
const rectoPages = await readPdf(recto.pdf)
const findPage = (needle) => rectoPages.findIndex((p) => pageText(p).includes(needle)) + 1
assert.equal(findPage("첫째"), 3)
assert.equal(findPage("둘째") % 2, 1)
assert.equal(findPage("둘째") > 3, true)
const blank = rectoPages[findPage("둘째") - 2]
assert.deepEqual(
  blank.items.map((item) => item.str),
  [String(findPage("둘째") - 1)],
)

const flowed = await typeset(
  [
    { title: "첫째", paragraphs: ["한 줄."] },
    { title: "둘째", paragraphs: ["같은 면."] },
  ],
  a5({ chapterStartsNewPage: false, pageMin: 4, pageMax: 10 }),
)
const flowedPages = await readPdf(flowed.pdf)
assert.equal(pageText(flowedPages[2]).includes("첫째"), true)
assert.equal(pageText(flowedPages[2]).includes("둘째"), true)

const tail = "끝문장보존"
const long = await typeset(
  [{ title: "긴글", paragraphs: [`${"가나다라마바사아자차카타파하 ".repeat(400)}${tail}`] }],
  a5({ pageMin: 2, pageMax: 4, pageIncrement: 2 }),
)
assert.equal(long.withinSpec, false)
assert.equal(long.pageCount > 4, true)
const longPages = await readPdf(long.pdf)
assert.equal(longPages.some((p) => pageText(p).includes(tail)), true)

const cover = await renderCover(
  { coverWidthMm: 320, coverHeightMm: 216, spineWidthMm: 14 },
  3,
  {
    title: "짧은 제목",
    authorName: "저자",
    publisher: "생각을나누다",
    backText: "뒤표지 소개 문장입니다. ".repeat(300),
    theme: "ivory",
  },
)
assert.equal(cover.notes.some((n) => n.includes("뒤표지")), true)
const coverPages = await readPdf(cover.pdf)
const backItems = coverPages[0].items.filter((item) => item.x < 150 * PT && Math.abs(item.b) < Math.abs(item.a) + 0.01)
const publisher = backItems.filter((item) => item.str.includes("생각을나누다"))
const blurb = backItems.filter((item) => item.str.includes("소개") || item.str.includes("문장") || item.str.includes("…"))
assert.ok(publisher.length > 0)
assert.ok(blurb.length > 0)
const publisherTop = Math.max(...publisher.map((item) => item.y))
const blurbBottom = Math.min(...blurb.map((item) => item.y))
assert.ok(blurbBottom > publisherTop + 6, `blurb ${blurbBottom} publisher ${publisherTop}`)

const longSpine = await renderCover(
  { coverWidthMm: 320, coverHeightMm: 216, spineWidthMm: 14 },
  3,
  {
    title: "가".repeat(180),
    authorName: "저자",
    publisher: "생각을나누다",
    theme: "ivory",
  },
)
assert.equal(longSpine.spineTextIncluded, false)
assert.equal(longSpine.notes.some((n) => n.includes("책등")), true)

const shortSpine = await renderCover(
  { coverWidthMm: 320, coverHeightMm: 216, spineWidthMm: 14 },
  3,
  { title: "길에서 만나다", authorName: "저자", publisher: "생각을나누다", theme: "charcoal" },
)
assert.equal(shortSpine.spineTextIncluded, true)
const spinePdf = await readPdf(shortSpine.pdf)
const safePt = (3 + 5) * PT
const pageH = 216 * PT
const rotated = spinePdf[0].items.filter((item) => Math.abs(item.b) > Math.abs(item.a))
assert.ok(rotated.length > 0)
for (const item of rotated) {
  const len = Math.hypot(item.a, item.b) || 1
  const ux = item.a / len
  const uy = item.b / len
  const px = -uy
  const py = ux
  const h = item.h || 9
  const corners = [
    [item.x, item.y],
    [item.x + ux * item.w, item.y + uy * item.w],
    [item.x + px * h, item.y + py * h],
    [item.x + ux * item.w + px * h, item.y + uy * item.w + py * h],
  ]
  for (const [x, y] of corners) {
    assert.ok(y >= safePt - 2 && y <= pageH - safePt + 2, `spine y ${y}`)
    assert.ok(x >= -1 && x <= 320 * PT + 1, `spine x ${x}`)
  }
}

const longTitle = "가".repeat(1000)
const titled = await typeset([{ title: "본문", paragraphs: ["본문."] }], a5({ title: longTitle }))
const titledPdf = await readPdf(titled.pdf)
assert.equal(titled.pageCount, titledPdf.length)
assert.equal(titled.pageCount, 4)
assert.equal(titled.withinSpec, true)
assert.equal(titled.notes.some((n) => n.includes("제목") && n.includes("일부")), true)
assert.equal(pageText(titledPdf[0]).includes("가"), true)
const shortTitle = await typeset([{ title: "본문", paragraphs: ["본문."] }], a5({ title: "짧은 제목" }))
assert.equal(shortTitle.notes.some((n) => n.includes("일부")), false)
assert.equal(shortTitle.pageCount, (await readPdf(shortTitle.pdf)).length)
const blankTitle = await typeset([{ title: "본문", paragraphs: ["본문."] }], a5({ title: "  " }))
assert.equal(pageText((await readPdf(blankTitle.pdf))[0]).includes("테스트 저자"), true)
const longAuthor = await typeset(
  [{ title: "본문", paragraphs: ["본문."] }],
  a5({ title: "짧은 제목", authorName: "나".repeat(1000) }),
)
const longAuthorPdf = await readPdf(longAuthor.pdf)
assert.equal(longAuthor.pageCount, longAuthorPdf.length)
assert.equal(longAuthor.pageCount, 4)
assert.equal(longAuthor.notes.some((n) => n.includes("지은이")), true)

const orderedPdf = await typeset(
  parseManuscript("# 단계\n\n5. 다섯째 단계\n6. 여섯째 단계\n\n다음 설명\n\n7. 일곱째 단계"),
  a5(),
)
const orderedText = (await readPdf(orderedPdf.pdf)).map(pageText).join("\n")
assert.match(orderedText, /5\./)
assert.match(orderedText, /6\./)
assert.match(orderedText, /7\./)
assert.equal(/1\.\s*다섯째/.test(orderedText), false)
assert.equal(/1\.\s*일곱째/.test(orderedText), false)
assert.equal(orderedText.includes("다섯째 단계"), true)
assert.equal(orderedText.includes("일곱째 단계"), true)

const wide = "가나다라마바사아자차카타파하".repeat(3)
const tablePdf = await typeset(
  [
    {
      title: "표",
      paragraphs: [],
      blocks: [
        {
          kind: "table",
          rows: [
            [
              [{ text: wide }],
              [{ text: wide }],
              [{ text: wide }],
              [{ text: wide }],
              [{ text: wide }],
              [{ text: "888" }],
              [{ text: "999" }],
            ],
          ],
        },
      ],
    },
  ],
  a5(),
)
const tablePages = await readPdf(tablePdf.pdf)
const tableBlob = tablePages.map(pageText).join("")
assert.ok([...tableBlob].filter((ch) => ch === "8").length >= 3)
assert.ok([...tableBlob].filter((ch) => ch === "9").length >= 3)
for (const page of tablePages) {
  const items = page.items.filter((it) => Math.abs(it.b) <= Math.abs(it.a))
  const rows = new Map()
  for (const it of items) {
    const key = Math.round(it.y)
    const row = rows.get(key) ?? []
    row.push(it)
    rows.set(key, row)
  }
  for (const row of rows.values()) {
    row.sort((a, b) => a.x - b.x)
    for (let i = 1; i < row.length; i++) {
      assert.ok(
        row[i].x >= row[i - 1].x + row[i - 1].w - 0.5,
        `overlap ${row[i - 1].str} end ${row[i - 1].x + row[i - 1].w} next ${row[i].str} x ${row[i].x}`,
      )
    }
  }
}

console.log("typeset: 통과")
