// 인쇄 가이드 도면 생성.
//
// SweetBook은 PDF의 크기와 페이지 수만 검증한다. 해상도·안전영역·제본 여백은
// 검증하지 않으므로, 그대로 두면 "글자가 잘렸다 / 사진이 뿌옇다" 같은 수령 후
// 클레임으로 돌아온다. 저자가 실수할 수 없도록 정확한 치수 도면을 만들어 준다.

/** 재단 오차를 감안한 안전영역 여유. 도련(3mm) 안쪽으로 추가 확보한다. */
export const SAFE_MARGIN_MM = 5
/** PUR 무선제본은 안쪽이 말려 들어가므로 제본변에 더 크게 잡는다. */
export const GUTTER_MARGIN_MM = 12
/** 인쇄 선명도 하한. 이보다 낮으면 육안으로 뿌옇게 보인다. */
export const MIN_IMAGE_DPI = 300

export interface CoverGeometry {
  totalWidthMm: number
  totalHeightMm: number
  bleedMm: number
  spineWidthMm: number
  panelWidthMm: number
  trimHeightMm: number
}

/**
 * 표지 펼침면 구성: [도련][뒤표지][책등][앞표지][도련]
 * 치수는 `GET /book-specs/{uid}/calculated-size`가 준 값을 그대로 쓴다.
 */
export function coverGeometry(
  size: { coverWidthMm: number; coverHeightMm: number; spineWidthMm: number },
  bleedMm: number,
): CoverGeometry {
  const panelWidthMm = (size.coverWidthMm - size.spineWidthMm - bleedMm * 2) / 2
  return {
    totalWidthMm: size.coverWidthMm,
    totalHeightMm: size.coverHeightMm,
    bleedMm,
    spineWidthMm: size.spineWidthMm,
    panelWidthMm,
    trimHeightMm: size.coverHeightMm - bleedMm * 2,
  }
}

const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)
const n = (v: number) => Math.round(v * 100) / 100

/**
 * 표지 도면 SVG. mm 단위로 그려 그대로 인쇄·배치해도 실측이 맞는다.
 * 디자인 도구에 밑그림으로 깔 수 있도록 다운로드도 제공한다.
 */
export function coverGuideSvg(g: CoverGeometry, label: string): string {
  const { totalWidthMm: W, totalHeightMm: H, bleedMm: b, spineWidthMm: sp, panelWidthMm: pw } = g
  const safe = b + SAFE_MARGIN_MM
  const spineX = b + pw
  const frontX = spineX + sp

  // 도면 자체가 잘려 보이지 않도록 여백을 두고 그린다.
  const pad = 14
  const vw = W + pad * 2
  const vh = H + pad * 2

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(vw)}mm" height="${n(vh)}mm" viewBox="0 0 ${n(vw)} ${n(vh)}" role="img" aria-label="${esc(label)} 표지 인쇄 가이드">
<title>${esc(label)} 표지 인쇄 가이드</title>
<rect width="${n(vw)}" height="${n(vh)}" fill="#1a1a1a"/>
<g transform="translate(${pad} ${pad})">
  <rect x="0" y="0" width="${n(W)}" height="${n(H)}" fill="#ffffff"/>
  <rect x="${n(spineX)}" y="0" width="${n(sp)}" height="${n(H)}" fill="#ff6b35" opacity="0.13"/>
  <rect x="${n(b)}" y="${n(b)}" width="${n(W - b * 2)}" height="${n(H - b * 2)}"
        fill="none" stroke="#ff6b35" stroke-width="0.4"/>
  <rect x="${n(safe)}" y="${n(safe)}" width="${n(W - safe * 2)}" height="${n(H - safe * 2)}"
        fill="none" stroke="#3aa3ff" stroke-width="0.3" stroke-dasharray="2 1.5"/>
  <line x1="${n(spineX)}" y1="0" x2="${n(spineX)}" y2="${n(H)}" stroke="#ff6b35" stroke-width="0.35"/>
  <line x1="${n(frontX)}" y1="0" x2="${n(frontX)}" y2="${n(H)}" stroke="#ff6b35" stroke-width="0.35"/>
  <text x="${n(b + pw / 2)}" y="${n(H / 2)}" font-family="sans-serif" font-size="5" fill="#666" text-anchor="middle">뒤표지</text>
  <text x="${n(frontX + pw / 2)}" y="${n(H / 2)}" font-family="sans-serif" font-size="5" fill="#666" text-anchor="middle">앞표지</text>
  <text x="${n(spineX + sp / 2)}" y="${n(H / 2)}" font-family="sans-serif" font-size="3" fill="#c0562a"
        text-anchor="middle" transform="rotate(-90 ${n(spineX + sp / 2)} ${n(H / 2)})">책등 ${n(sp)}mm</text>
  <text x="${n(b + pw / 2)}" y="${n(H / 2 + 7)}" font-family="sans-serif" font-size="3" fill="#999" text-anchor="middle">${n(pw)} × ${n(g.trimHeightMm)}mm</text>
  <text x="${n(frontX + pw / 2)}" y="${n(H / 2 + 7)}" font-family="sans-serif" font-size="3" fill="#999" text-anchor="middle">${n(pw)} × ${n(g.trimHeightMm)}mm</text>
</g>
<text x="${pad}" y="${n(pad - 5)}" font-family="sans-serif" font-size="4.5" fill="#f5f5f5">${esc(label)} — 표지 ${n(W)} × ${n(H)}mm</text>
<text x="${pad}" y="${n(vh - 6)}" font-family="sans-serif" font-size="3.6" fill="#ff6b35">— 재단선 (${n(b)}mm 도련)</text>
<text x="${n(pad + 42)}" y="${n(vh - 6)}" font-family="sans-serif" font-size="3.6" fill="#3aa3ff">--- 안전영역 (가장자리 ${n(safe)}mm)</text>
<text x="${pad}" y="${n(vh - 1.5)}" font-family="sans-serif" font-size="3.2" fill="#888">배경은 재단선 밖까지 채우고, 글자는 안전영역 안에 두세요.</text>
</svg>`
}
