import { FAQ_ITEMS } from "@/lib/site-config"

export function FaqSection() {
  return (
    <section id="faq" className="py-24 px-8 lg:px-16 bg-primary-dark border-t border-accent-orange/10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12">
          <h2 className="font-playfair text-3xl sm:text-4xl md:text-5xl font-normal mb-4">
            자주 묻는 질문
          </h2>
          <p className="text-text-gray text-base sm:text-lg leading-relaxed">
            생각을나누다의 책, 구매처, 출판 문의에 대한 핵심 정보를 정리했습니다.
          </p>
        </div>

        <dl className="space-y-6">
          {FAQ_ITEMS.map((item) => (
            <div key={item.question} className="border-t border-text-gray/15 pt-5 first:border-t-0 first:pt-0">
              <dt className="text-lg font-semibold text-text-light mb-2">{item.question}</dt>
              <dd className="text-text-gray leading-relaxed">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
