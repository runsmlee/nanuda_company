// 표지 자동 생성.
//
// 저자가 가장 실패하기 쉬운 지점이다. 책등 두께는 쪽수에 따라 변하고, 펼침면은
// [도련][뒤표지][책등][앞표지][도련] 구조라 직접 만들면 거의 틀린다.
// 쪽수만 알면 우리가 정확한 치수로 그려준다.

import { join } from "node:path"
import PDFDocument from "pdfkit"
import { coverGeometry, SAFE_MARGIN_MM, type CoverGeometry } from "./print-guide"

const mmToPt = (mm: number) => mm / (25.4 / 72)

const FONT_REGULAR = "assets/fonts/NanumMyeongjo-Regular.ttf"
const FONT_BOLD = "assets/fonts/NanumMyeongjo-Bold.ttf"

/** 책등에 글자를 넣으려면 이 정도 두께는 있어야 한다. 얇으면 재단 오차로 글자가 접힌다. */
export const MIN_SPINE_TEXT_MM = 6

export const COVER_THEMES = {
  ivory: { label: "아이보리", bg: "#f4f0e8", fg: "#1a1a1a", accent: "#c2410c", sub: "#6b6355" },
  charcoal: { label: "차콜", bg: "#1f1f1f", fg: "#f5f5f5", accent: "#ff6b35", sub: "#9a9a9a" },
  photo: { label: "사진", bg: "#1a1a1a", fg: "#ffffff", accent: "#ff6b35", sub: "#d8d8d8" },
} as const

export type CoverTheme = keyof typeof COVER_THEMES

export interface CoverOptions {
  title: string
  authorName: string
  publisher: string
  /** 뒤표지에 넣을 짧은 소개. 없으면 비워둔다. */
  backText?: string
  theme: CoverTheme
  /** 앞표지 배경 이미지. photo 테마에서만 쓴다. */
  image?: Buffer
  /** 미리보기용 워터마크. 결제 후 인쇄본에는 넣지 않는다. */
  watermark?: boolean
}

export interface CoverResult {
  pdf: Buffer
  spineTextIncluded: boolean
  notes: string[]
}

/**
 * 결제 전 미리보기 표시. 내지와 같은 이유로 넣는다 — 미리보기 PDF는 이미
 * 사용자 브라우저에 가 있어, 표시가 없으면 그대로 인쇄에 쓸 수 있다.
 *
 * 표지는 뒤표지·책등·앞표지가 한 장이라 가운데 한 줄이면 책등에 얹힌다.
 * 패널마다 따로 그린다.
 */
function drawCoverWatermark(
  doc: PDFKit.PDFDocument,
  x: number,
  width: number,
  height: number,
  color: string,
) {
  const size = width * 0.085
  const cx = x + width / 2
  doc.save()
  doc.rotate(-38, { origin: [cx, height / 2] })
  // 색은 테마 전경색을 쓴다. 검정으로 고정하면 charcoal·photo 테마에서 안 보인다.
  doc.font("head").fontSize(size).fillColor(color).fillOpacity(0.16)
  doc.text("미리보기 · 생각을나누다", x, height / 2 - size * 0.7, {
    width,
    align: "center",
    lineBreak: false,
  })
  doc.restore()
  doc.fillOpacity(1)
}

/** 긴 제목이 한 줄을 넘지 않도록 폰트 크기를 줄여가며 맞춘다. */
function fitFontSize(
  doc: PDFKit.PDFDocument,
  text: string,
  font: string,
  maxWidth: number,
  start: number,
  min: number,
): number {
  let size = start
  doc.font(font)
  while (size > min) {
    doc.fontSize(size)
    if (doc.widthOfString(text) <= maxWidth) break
    size -= 0.5
  }
  return size
}

export async function renderCover(
  size: { coverWidthMm: number; coverHeightMm: number; spineWidthMm: number },
  bleedMm: number,
  opts: CoverOptions,
  fontDir = process.cwd(),
): Promise<CoverResult> {
  const notes: string[] = []
  const g: CoverGeometry = coverGeometry(size, bleedMm)
  const theme = COVER_THEMES[opts.theme]

  const W = mmToPt(g.totalWidthMm)
  const H = mmToPt(g.totalHeightMm)
  const bleed = mmToPt(g.bleedMm)
  const panel = mmToPt(g.panelWidthMm)
  const spine = mmToPt(g.spineWidthMm)
  const safe = mmToPt(g.bleedMm + SAFE_MARGIN_MM)

  const spineX = bleed + panel
  const frontX = spineX + spine

  const regular = join(fontDir, FONT_REGULAR)
  const bold = join(fontDir, FONT_BOLD)

  const doc = new PDFDocument({
    size: [W, H],
    margin: 0,
    autoFirstPage: true,
    font: regular,
    info: { Title: `${opts.title} 표지`, Author: opts.authorName },
  })
  const chunks: Buffer[] = []
  doc.on("data", (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((r) => doc.on("end", () => r(Buffer.concat(chunks))))

  doc.registerFont("body", regular)
  doc.registerFont("head", bold)

  // 배경은 재단선 밖(도련)까지 채워야 흰 선이 생기지 않는다.
  doc.rect(0, 0, W, H).fill(theme.bg)

  const usePhoto = opts.theme === "photo" && opts.image
  if (usePhoto) {
    try {
      // 앞표지 전면을 덮도록 배치. cover 옵션이 비율을 유지하며 잘라 채운다.
      doc.save()
      doc.rect(frontX, 0, panel + bleed, H).clip()
      doc.image(opts.image!, frontX, 0, { cover: [panel + bleed, H], align: "center", valign: "center" })
      doc.restore()
      // 제목 가독성을 위해 하단에 어두운 그라데이션 대용 밴드를 깐다.
      doc.rect(frontX, H * 0.52, panel + bleed, H * 0.48).fillOpacity(0.55).fill("#000000")
      doc.fillOpacity(1)
    } catch {
      notes.push("표지 이미지를 읽지 못해 배경색으로 대체했습니다.")
    }
  } else if (opts.theme === "photo") {
    notes.push("사진 테마를 골랐지만 이미지가 없어 배경색으로 그렸습니다.")
  }

  // ── 앞표지 ──
  const frontInnerX = frontX + mmToPt(SAFE_MARGIN_MM)
  const frontInnerW = panel - mmToPt(SAFE_MARGIN_MM * 2)

  const titleSize = fitFontSize(doc, opts.title, "head", frontInnerW, 30, 14)
  doc.font("head").fontSize(titleSize).fillColor(usePhoto ? "#ffffff" : theme.fg)
  const titleY = usePhoto ? H * 0.63 : H * 0.34
  doc.text(opts.title, frontInnerX, titleY, { width: frontInnerW, align: "center" })

  // 제목과 저자 사이 짧은 선 — 장식이자 시선 유도.
  const ruleY = doc.y + mmToPt(6)
  doc
    .moveTo(frontInnerX + frontInnerW / 2 - mmToPt(8), ruleY)
    .lineTo(frontInnerX + frontInnerW / 2 + mmToPt(8), ruleY)
    .lineWidth(0.8)
    .stroke(theme.accent)

  doc.font("body").fontSize(11).fillColor(usePhoto ? "#e8e8e8" : theme.sub)
  doc.text(opts.authorName, frontInnerX, ruleY + mmToPt(6), { width: frontInnerW, align: "center" })

  doc.font("body").fontSize(9).fillColor(usePhoto ? "#d0d0d0" : theme.sub)
  doc.text(opts.publisher, frontInnerX, H - safe - mmToPt(6), { width: frontInnerW, align: "center" })

  // ── 책등 ──
  let spineTextIncluded = false
  if (g.spineWidthMm >= MIN_SPINE_TEXT_MM) {
    const spineLabel = `${opts.title}   ${opts.authorName}`
    const spineFont = Math.min(9, mmToPt(g.spineWidthMm) * 0.42)
    const cx = spineX + spine / 2
    const cy = H / 2
    doc.save()
    // 국내 단행본은 책등 글자를 위에서 아래로 읽는다. 시계 방향(+90)이 그 방향이다.
    doc.rotate(90, { origin: [cx, cy] })
    doc.font("body").fontSize(spineFont).fillColor(usePhoto ? "#ffffff" : theme.fg)
    doc.text(spineLabel, cx - H / 2 + safe, cy - spineFont * 0.7, {
      width: H - safe * 2,
      align: "center",
      lineBreak: false,
    })
    doc.restore()
    spineTextIncluded = true
  } else {
    notes.push(
      `책등이 ${g.spineWidthMm}mm로 얇아 제목을 넣지 않았습니다. 쪽수가 늘면 책등에도 제목이 들어갑니다.`,
    )
  }

  // ── 뒤표지 ──
  const backInnerX = bleed + mmToPt(SAFE_MARGIN_MM)
  const backInnerW = panel - mmToPt(SAFE_MARGIN_MM * 2)

  if (opts.backText?.trim()) {
    doc.font("body").fontSize(10).fillColor(theme.sub)
    // 앞표지 제목과 시선 높이를 맞춘다.
    doc.text(opts.backText.trim(), backInnerX, H * 0.32, {
      width: backInnerW,
      align: "left",
      lineGap: 4.5,
    })
  }
  doc.font("body").fontSize(9).fillColor(theme.sub)
  doc.text(opts.publisher, backInnerX, H - safe - mmToPt(6), { width: backInnerW, align: "left" })

  if (opts.watermark) {
    // 앞·뒤표지에 각각. 책등은 폭이 좁아 넣어도 읽히지 않는다.
    drawCoverWatermark(doc, bleed, panel, H, theme.fg)
    drawCoverWatermark(doc, frontX, panel, H, theme.fg)
  }

  doc.end()
  return { pdf: await done, spineTextIncluded, notes }
}
