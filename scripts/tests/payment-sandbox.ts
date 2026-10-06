// Real vendor sandbox APIs, with all application writes isolated in the scratch PostgreSQL database.
import assert from "node:assert/strict"
import { randomUUID, randomBytes } from "node:crypto"
import { startBridge, sql, rows, quote } from "./payment-db-bridge"

async function main() {
  const providerId = process.argv[2]
  assert.match(providerId ?? "", /^\d+$/, "Pass the ID of a fresh QA sandbox purchase")
  assert.equal(sql("select current_database()"), "nanuda_payment_test")
  assert.equal(process.env.SWEETBOOK_API_BASE, "https://api-sandbox.sweetbook.com/v1")
  const bridge = await startBridge()
  const realFetch = globalThis.fetch
  Object.assign(process.env, { SUPABASE_URL: bridge.url, SUPABASE_SERVICE_ROLE_KEY: "scratch-only",
    LEMONSQUEEZY_TEST_MODE: "true" })
  const manuscript = Buffer.from("# 샌드박스 검증\n\n" + "결제와 제작 복구를 확인하는 합성 원고입니다. ".repeat(300))
  const calls: Record<string, number> = {}
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? String(input) : input.url)
    if (url.origin === bridge.url) {
      if (url.pathname.includes("/storage/v1/object/")) return new Response(manuscript)
      return realFetch(input, init)
    }
    assert.ok(["api.lemonsqueezy.com", "api-sandbox.sweetbook.com"].includes(url.hostname), "Unexpected external API")
    const key = `${init?.method ?? "GET"} ${url.pathname}`
    calls[key] = (calls[key] ?? 0) + 1
    return realFetch(input, init)
  }) as typeof fetch
  try {
    const payment = await import("../../lib/publishing/payment")
    const supplier = await import("../../lib/publishing/sweetbook")
    const { db } = await import("../../lib/publishing/db")
    const work = await import("../../lib/publishing/payment-work")
    const provider = payment.getPaymentProvider()
    const getRaw = async () => {
      const r = await fetch(`https://api.lemonsqueezy.com/v1/orders/${providerId}`, {
        headers: { Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`, Accept: "application/vnd.api+json" },
      })
      assert.equal(r.status, 200)
      const j = await r.json()
      assert.equal(j.data.attributes.test_mode, true)
      assert.equal(j.data.attributes.user_email, "payment-qa@example.com")
      assert.ok(Date.now() - Date.parse(j.data.attributes.created_at) < 24 * 60 * 60 * 1000, "Only fresh QA purchases can be refunded")
      return j.data
    }
    const raw = await getRaw()
    assert.equal(raw.attributes.status, "paid")
    const specs = await supplier.listBookSpecs()
    const spec = specs.find(s => s.innerTrimWidthMm === 148 && s.innerTrimHeightMm === 210)!
    assert.ok(spec)
    const seed = () => {
      const id = randomUUID()
      sql(`insert into publishing_projects(id,author_email,access_token,title,author_name,manuscript_path,manuscript_name,book_spec_uid,text_size,chapter_new_page)
        values(${quote(id)},'payment-qa@example.com',${quote(randomBytes(24).toString("base64url"))},'Sandbox QA','Sandbox QA','qa','qa.md',${quote(spec.bookSpecUid)},'normal',true)`)
      sql(`insert into publishing_orders(id,project_id,kind,quantity,price_krw,expected_store_id,expected_variant_id,payment_test_mode,recipient_name,recipient_phone,postal_code,address1)
        values(${quote(id)},${quote(id)},'physical',1,25200,${quote(String(raw.attributes.store_id))},${quote(String(raw.attributes.first_order_item.variant_id))},true,'Sandbox QA','010-0000-0000','04524','서울특별시 중구 세종대로 110')`)
      return id
    }
    const id = seed()
    const order = () => rows(`select * from publishing_orders where id=${quote(id)}`)[0]
    const record = async (ref: string, key: string) => {
      const event = await provider.getOrderEvent(providerId, ref)
      const r = await db().rpc("publishing_record_payment", { p_event_id: key, p_event: event })
      assert.equal(r.error, null)
      return event
    }
    const paid = await record(id, "sandbox-paid")
    assert.equal(order().status, "paid")
    await record(id, "sandbox-paid")
    assert.equal(rows("select * from publishing_webhook_events").length, 1)
    console.log(JSON.stringify({ scenario: "paid-and-duplicate", providerId, chargedMinor: paid.totalMinor, status: "pass" }))
    await work.runPaymentWork(id)
    console.log(JSON.stringify({ scenario: "real-print-submission", status: order().status, reason: order().failure_reason, printUid: order().print_order_uid }))
    assert.equal(order().status, "submitted")
    const printUid = String(order().print_order_uid)
    const print = await supplier.getOrder(printUid)
    assert.equal(print.isTest, true, "Supplier must explicitly confirm a test order")
    await work.runPaymentWork(id)
    assert.equal(order().print_order_uid, printUid)
    const refund = async (amount?: number) => {
      await getRaw() // Re-check test-only identity immediately before every refund.
      const r = await fetch(`https://api.lemonsqueezy.com/v1/orders/${providerId}/refund`, {
        method: "POST", headers: { Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`, Accept: "application/vnd.api+json", "Content-Type": "application/vnd.api+json" },
        body: JSON.stringify({ data: { type: "orders", id: providerId, attributes: amount === undefined ? {} : { amount } } }),
      })
      assert.equal(r.status, 200, "Sandbox refund failed")
    }
    await refund(100000)
    const partial = await record(id, "sandbox-partial")
    assert.ok(partial.refundedMinor > 0 && partial.refundedMinor < partial.totalMinor)
    assert.equal(order().status, "failed")
    assert.equal(order().review_required, true)
    console.log(JSON.stringify({ scenario: "real-partial-refund", refundedMinor: partial.refundedMinor, status: "pass" }))
    await refund()
    const full = await record(id, "sandbox-full")
    assert.equal(full.fullyRefunded, true)
    assert.ok(Math.abs(full.refundedMinor - full.totalMinor) <= 100)
    await work.runPaymentWork(id)
    assert.equal(order().status, "refunded")
    assert.ok(["cancelled", "needs_review"].includes(String(order().cancellation_status)))
    console.log(JSON.stringify({ scenario: "real-full-refund-and-print-cancel", refundedMinor: full.refundedMinor, cancellation: order().cancellation_status, printStatus: (await supplier.getOrder(printUid)).orderStatus, status: "pass" }))
    sql("truncate publishing_webhook_events, publishing_orders, publishing_projects cascade")
    const beforePrintId = seed()
    await record(beforePrintId, "sandbox-refund-before-print")
    await work.runPaymentWork(beforePrintId)
    const beforePrint = rows(`select * from publishing_orders where id=${quote(beforePrintId)}`)[0]
    assert.equal(beforePrint.cancellation_status, "not_started")
    assert.equal(beforePrint.print_order_uid, null)
    console.log(JSON.stringify({ scenario: "refunded-before-print", status: "pass", calls }))
  } finally {
    globalThis.fetch = realFetch
    await bridge.close()
  }
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Sandbox verification failed"); process.exitCode = 1 })
