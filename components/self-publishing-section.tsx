import Link from "next/link"

/**
 * 랜딩에서 자가출판으로 넘어가는 진입점.
 *
 * 도서 섹션 바로 뒤에 둔다. 독자가 완성된 책을 막 훑은 직후가 "내 것도
 * 만들 수 있나"로 넘어가는 순간이라, 설명을 가장 적게 해도 되는 자리다.
 */
export function SelfPublishingSection() {
  return (
    <section
      id="self-publishing"
      className="py-24 sm:py-32 px-6 sm:px-8 lg:px-16 border-y border-accent-orange/10"
    >
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
        {/* 메시지 */}
        <div>
          <p className="text-accent-orange text-sm tracking-[0.3em] uppercase mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
            Self Publishing
            <span className="tracking-normal normal-case text-xs whitespace-nowrap border border-accent-orange/50 px-2 py-0.5">
              베타
            </span>
          </p>

          <h2 className="font-playfair text-3xl sm:text-4xl md:text-5xl font-light leading-tight mb-6">
            당신의 이야기도
            <br />
            <span className="text-accent-orange">한 권의 책</span>이 됩니다
          </h2>

          <p className="text-text-gray text-base sm:text-lg leading-relaxed mb-8">
            워드 파일 하나면 충분합니다. 판형·여백·책등 두께 같은 인쇄 규격은 저희가 맞춥니다.
            조판한 결과를 펼침면으로 확인하고, 마음에 들 때까지 바꿔보세요.
          </p>

          <ul className="space-y-3 mb-10">
            {[
              "원고를 인쇄 가능한 책으로 자동 조판",
              "제목·저자명으로 표지와 책등 자동 생성",
              "실제 인쇄에 쓰이는 결과를 그대로 미리보기",
            ].map((t) => (
              <li key={t} className="flex gap-3 text-sm sm:text-base text-text-gray leading-relaxed">
                <span className="text-accent-orange shrink-0 mt-0.5" aria-hidden>
                  ―
                </span>
                {t}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link
              href="/publish"
              className="inline-flex items-center gap-3 px-6 sm:px-8 py-3 sm:py-4 border-2 border-accent-orange text-accent-orange font-medium text-base hover:bg-accent-orange hover:text-white transition-all duration-300"
            >
              자가출판 알아보기
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/publish/studio"
              className="text-sm text-text-gray hover:text-accent-orange transition-colors underline underline-offset-4 decoration-text-gray/40 hover:decoration-accent-orange"
            >
              바로 조판해보기
            </Link>
          </div>

          {/* 결제 전 단계라는 사실을 진입점에서 밝힌다. 들어가서 알게 되면 늦다. */}
          <p className="text-xs text-text-gray/80 mt-6 leading-relaxed">
            조판과 표지 만들기는 지금 사용해보실 수 있습니다. 주문·결제는 준비 중입니다.
          </p>
        </div>

        {/* 펼침면 목업 — 조판이 무엇인지 한눈에 보여준다. 이미지 없이 CSS로만 그린다. */}
        <div className="hidden lg:flex justify-center" aria-hidden>
          <div className="flex gap-1 shadow-2xl shadow-black/50">
            {[0, 1].map((side) => (
              <div
                key={side}
                className="w-[15.5rem] h-[22rem] bg-[#faf8f4] px-9 py-11 flex flex-col"
              >
                {side === 0 && (
                  <>
                    <div className="h-2 w-20 bg-[#1a1a1a]/80 mb-6 rounded-[1px]" />
                    <div className="h-[3px] w-10 bg-accent-orange mb-7 rounded-[1px]" />
                  </>
                )}
                <div className="space-y-[9px] flex-1">
                  {Array.from({ length: side === 0 ? 13 : 17 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-[3px] bg-[#1a1a1a]/25 rounded-[1px]"
                      // 마지막 줄은 짧게 — 실제 문단처럼 보이게 하는 유일한 디테일
                      style={{ width: i % 6 === 5 ? "62%" : "100%" }}
                    />
                  ))}
                </div>
                <div className="h-[3px] w-3 bg-[#1a1a1a]/30 mt-6 self-center rounded-[1px]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
