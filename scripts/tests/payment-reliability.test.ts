import { before, after, beforeEach, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID, randomBytes, createHmac } from "node:crypto"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { deflateRawSync } from "node:zlib"
import { NextRequest } from "next/server"
import { startBridge, sql, rows, quote } from "./payment-db-bridge"

let bridge: Awaited<ReturnType<typeof startBridge>>
let db: typeof import("../../lib/publishing/db")
let payment: typeof import("../../lib/publishing/payment")
let work: typeof import("../../lib/publishing/payment-work")
let checkout: typeof import("../../app/api/publish/checkout/route")
let webhook: typeof import("../../app/api/publish/webhook/lemonsqueezy/route")
let api: typeof import("../../app/api/publish/orders/[orderUid]/route")
const realFetch = globalThis.fetch
let printCalls = 0
let cancelCalls = 0
let checkoutCalls = 0
let printStatus = "PDF_READY"
let failPrint = false
let failAttach = false
let refundDuringPrint = false
let partialDuringFailure = false
let providerRefund = 0
let uploadCalls = 0
let removedPaths: string[] = []
let failStorageRemove = false
let token = ""
let id = ""
const printRequest = { items: [{ bookUid: "book-fixture", quantity: 1 }], shipping: { recipientName: "Audit", recipientPhone: "010-1234-5678", postalCode: "12345", address1: "Audit address" }, externalRef: "fixture" }
function event(changes: Record<string,unknown> = {}) {
  return { type: "paid", providerOrderId: "123", reference: id, email: "audit@example.com", totalMinor: 2_000_000,
    currency: "KRW", testMode: true, rawEventName: "order_created", storeId: "439240", variantId: "2115295", refundedMinor: 0, ...changes }
}
async function record(changes: Record<string,unknown> = {}, key = randomUUID()) {
  return db.db().rpc("publishing_record_payment", { p_event_id: key, p_event: event(changes) })
}
function order() { return rows(`select * from publishing_orders where id=${quote(id)}`)[0] }
function usdQuote() {
  sql(`update publishing_orders set payment_currency='USD', expected_total_minor=1500,
    exchange_rate_krw_per_usd=1333.333333, exchange_rate_date=current_date where id=${quote(id)}`)
}
test("USD payment and refunds use the frozen quote, never the KRW price", async () => {
  usdQuote()
  const usd = {currency:"USD",totalMinor:1500}
  assert.equal((await record(usd)).error,null)
  assert.equal(order().status,"paid")
  assert.equal((await record({...usd,type:"refunded",rawEventName:"order_refunded",refundedMinor:500})).error,null)
  assert.equal(order().review_required,true)
  assert.equal((await record({...usd,type:"refunded",rawEventName:"order_refunded",refundedMinor:1500,fullyRefunded:true})).error,null)
  assert.equal(order().status,"refunded")
  assert.equal(order().refunded_total_minor,1500)
  assert.equal(order().review_required,false)
})
for (const delta of [-1, 1]) {
  test(`USD payment mismatch of ${delta} cent is recorded and held`, async () => {
    usdQuote()
    assert.equal((await record({currency:"USD",totalMinor:1500+delta})).error,null)
    assert.equal(order().review_required,true)
    assert.equal(await work.runPaymentWork(id),false)
    assert.equal(printCalls,0)
  })
  test(`USD full refunds cannot use the legacy KRW rounding tolerance (${delta})`, async () => {
    usdQuote()
    assert.ok((await record({currency:"USD",totalMinor:1500,type:"refunded",refundedMinor:1500+delta,fullyRefunded:true})).error)
    assert.equal(order().status,"pending")
  })
}
test("USD orders without a frozen quote reject payment and never print", async () => {
  sql(`update publishing_orders set payment_currency='USD' where id=${quote(id)}`)
  assert.ok((await record({currency:"USD",totalMinor:1500})).error)
  assert.equal(rows("select * from publishing_webhook_events").length,0)
})
function seed(withIntent = true) {
  id = randomUUID(); token = randomBytes(24).toString("base64url")
  sql(`insert into publishing_projects(id,author_email,access_token,title,author_name,manuscript_path,manuscript_name,book_spec_uid,text_size,chapter_new_page)
    values(${quote(id)},'audit@example.com',${quote(token)},'Audit','Audit','fixture','fixture.md','A5','normal',true)`)
  sql(`insert into publishing_orders(id,project_id,kind,quantity,price_krw,expected_store_id,expected_variant_id,payment_test_mode,print_request,print_requested_at)
    values(${quote(id)},${quote(id)},'physical',1,20000,'439240','2115295',true,${withIntent ? quote(printRequest) : "null"},${withIntent ? "now()" : "null"})`)
}
before(async () => {
  // Fail closed if the exact isolated test database is not present.
  assert.equal(sql("select current_database()"), "nanuda_payment_test")
  bridge = await startBridge()
  Object.assign(process.env, { SUPABASE_URL: bridge.url, SUPABASE_SERVICE_ROLE_KEY: "test-only",
    PUBLISH_ENABLED: "true", PUBLISH_WORKER_SECRET: "test-only-secret-32-characters-long",
    LEMONSQUEEZY_API_KEY: "test-only", LEMONSQUEEZY_STORE_ID: "439240", LEMONSQUEEZY_VARIANT_ID: "2115295",
    LEMONSQUEEZY_STORE_CURRENCY: "KRW", LEMONSQUEEZY_WEBHOOK_SECRET: "test-only", LEMONSQUEEZY_TEST_MODE: "true",
    SWEETBOOK_API_BASE: "https://api-sandbox.sweetbook.com/v1", SWEETBOOK_API_KEY: "test-only" })
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url)
    if (url.origin === bridge.url) {
      if (url.pathname.startsWith("/storage/v1/object/") && init?.method === "DELETE") {
        if (failStorageRemove) { failStorageRemove = false; return Response.json({ statusCode: "500", error: "Injected storage failure", message: "Injected storage failure" }, { status: 500 }) }
        removedPaths.push(...JSON.parse(String(init.body)).prefixes)
      }
      if (failAttach && url.pathname.endsWith("publishing_attach_print")) {
        failAttach = false
        return Response.json({ code: "P0001", message: "Injected DB failure" }, { status: 500 })
      }
      return realFetch(input, init)
    }
    if (url.hostname === "api.lemonsqueezy.com") {
      if (url.pathname.endsWith("/checkouts")) {
        checkoutCalls++
        const request = JSON.parse(String(init?.body))
        return Response.json({ data: { id: "checkout-fixture", attributes: { test_mode: true,
          url: "https://nanuda.lemonsqueezy.com/checkout/buy/fixture", preview: { total: request.data.attributes.custom_price } } } })
      }
      if (url.pathname === "/v1/orders/123") return Response.json({ data: { id: "123", attributes: {
        store_id: "439240", first_order_item: { variant_id: "2115295", test_mode: true }, test_mode: true,
        status: providerRefund ? "refunded" : "paid", total: 2_000_000, currency: "KRW", refunded_amount: providerRefund,
      } } })
    }
    if (url.hostname === "api-sandbox.sweetbook.com") {
      if (url.pathname === "/v1/credits") return Response.json({success:true,data:{env:"test",currency:"KRW"}})
      if (url.pathname === "/v1/book-specs") return Response.json({ success: true, data: [{
        bookSpecUid: "A5", innerTrimWidthMm: 148, innerTrimHeightMm: 210, bleedMm: 3,
        pageMin: 32, pageMax: 1000, pageIncrement: 2, priceBase: 18000, pricePerIncrement: 100,
      }] })
      if (url.pathname === "/v1/books/book-fixture") return Response.json({success:true,data:{bookStatus:2}})
      if (url.pathname.startsWith("/v1/book-specs/A5/calculated-size")) return Response.json({success:true,data:{bookSpecUid:"A5",pages:32,unit:"mm",coverWidthMm:304,coverHeightMm:216,innerWidthMm:154,innerHeightMm:216,spineWidthMm:2,pdfToleranceMm:1}})
      if (url.pathname === "/v1/orders/estimate") return Response.json({success:true,data:{paidCreditAmount:1000,creditBalance:100000,creditSufficient:true}})
      if (url.pathname.includes("pdf-cover") || url.pathname.includes("pdf-contents")) {uploadCalls++; throw new Error("A finalized book must not be overwritten")}
      if (url.pathname === "/v1/orders" && init?.method === "POST") {
        printCalls++
        if (partialDuringFailure) {
          assert.equal((await record({type:"refunded",rawEventName:"order_refunded",refundedMinor:500000})).error,null)
          return Response.json({success:false,message:"Temporary outage"},{status:503})
        }
        if (failPrint) return Response.json({ success: false, message: "Temporary supplier outage" }, { status: 503 })
        if (refundDuringPrint) {
          providerRefund = 2_000_000
          const result = await record({ type: "refunded", rawEventName: "order_refunded", refundedMinor: providerRefund })
          assert.equal(result.error, null)
        }
        return Response.json({ success: true, data: { orderUid: "print-fixture", orderStatus: printStatus } })
      }
      if (url.pathname === "/v1/orders/print-fixture/cancel") { cancelCalls++; printStatus = "CANCELLED_REFUND"; return Response.json({ success: true, data: {} }) }
      if (url.pathname === "/v1/orders/print-fixture") return Response.json({ success: true, data: { orderUid: "print-fixture", orderStatus: printStatus, items: [] } })
    }
    throw new Error(`Unmocked network request blocked: ${url.origin}${url.pathname}`)
  }) as typeof fetch
  db = await import("../../lib/publishing/db")
  payment = await import("../../lib/publishing/payment")
  work = await import("../../lib/publishing/payment-work")
  checkout = await import("../../app/api/publish/checkout/route")
  webhook = await import("../../app/api/publish/webhook/lemonsqueezy/route")
  api = await import("../../app/api/publish/orders/[orderUid]/route")
})
after(async () => { globalThis.fetch = realFetch; await bridge?.close() })
beforeEach(() => {
  sql("truncate publishing_checkout_attempts, publishing_webhook_events, publishing_orders, publishing_projects cascade")
  removedPaths = []; failStorageRemove = false
  printCalls = cancelCalls = checkoutCalls = uploadCalls = 0; printStatus = "PDF_READY"; failPrint = failAttach = refundDuringPrint = partialDuringFailure = false; providerRefund = 0
  seed()
})

test("verified payment and receipt ledger commit atomically", async () => {
  assert.equal((await record()).error, null)
  assert.equal(order().status, "paid")
  assert.equal(order().charged_total_minor, 2_000_000)
  assert.equal(rows("select * from publishing_webhook_events").length, 1)
})
for (const status of ["paid", "failed", "refunded", "submitted"]) {
  test(`archived QA ${status} orders never enter fulfillment or supplier reconciliation`, async () => {
    await record()
    sql(`update publishing_orders set status=${quote(status)}, archived_at=now(), review_required=false,
      cancellation_status='pending', print_order_uid=${status === "submitted" ? "'print-fixture'" : "null"} where id=${quote(id)}`)
    assert.equal(await work.runPaymentWork(id), false)
    assert.equal(await work.reconcileSubmittedOrder(), false)
    assert.equal(order().fulfillment_attempts, 0)
    assert.equal(printCalls, 0)
    assert.equal(cancelCalls, 0)
  })
}
test("late test payment/refund callbacks cannot change archived QA money or holds", async () => {
  await record()
  sql(`update publishing_orders set archived_at=now(), review_required=false where id=${quote(id)}`)
  const before = order()
  assert.equal((await record()).error, null)
  assert.equal((await record({type:"refunded",refundedMinor:2_000_000,fullyRefunded:true})).error, null)
  assert.deepEqual(order(), before)
})
test("live payments cannot be silently accepted by archived QA records", async () => {
  sql(`update publishing_orders set archived_at=now() where id=${quote(id)}`)
  assert.ok((await record({testMode:false})).error)
  assert.equal(order().charged_total_minor, null)
})
test("archived QA supplier callbacks preserve history without recreating an exception", async () => {
  sql(`update publishing_orders set status='submitted', print_order_uid='print-fixture', print_status='PDF_READY',
    archived_at=now(), review_required=false where id=${quote(id)}`)
  const before = order()
  assert.equal((await db.db().rpc("publishing_record_print_event", {p_event_id:"late-test-cancel",p_event_name:"order.cancelled",p_print_uid:"print-fixture",p_status:"CANCELLED"})).data, true)
  assert.deepEqual(order(), before)
})
test("archived QA orders cannot use public tracking even with the former ownership token", async () => {
  sql(`update publishing_orders set print_order_uid='print-fixture', archived_at=now() where id=${quote(id)}`)
  assert.equal(await db.authorizedOrder(id, token), null)
  const response = await api.GET(new NextRequest(`http://test/api/publish/orders/print-fixture?token=${token}`), {params:Promise.resolve({orderUid:"print-fixture"})})
  assert.equal(response.status, 404)
})
test("live order records cannot be archived as verified QA", async () => {
  assert.throws(() => sql(`update publishing_orders set payment_test_mode=false, archived_at=now() where id=${quote(id)}`))
  assert.equal(order().archived_at, null)
})
test("active fulfillment leases prevent archiving an in-flight order", async () => {
  await record()
  const claimed = await db.db().rpc("publishing_claim_work", {p_order_id:id})
  assert.ok(claimed.data[0].fulfillment_token)
  assert.throws(() => sql(`update publishing_orders set archived_at=now() where id=${quote(id)}`))
  assert.equal(order().archived_at, null)
})
test("archived QA print webhooks require a valid signature and never call a supplier", async () => {
  sql(`update publishing_orders set print_order_uid='print-fixture', archived_at=now() where id=${quote(id)}`)
  const savedFetch=globalThis.fetch, savedSecret=process.env.SWEETBOOK_WEBHOOK_SECRET
  process.env.SWEETBOOK_WEBHOOK_SECRET="archived-test-only"
  globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
    assert.ok(String(input).startsWith(bridge.url), "Archived webhook must not query a supplier")
    return savedFetch(input,init)
  }) as typeof fetch
  try {
    const route=await import("../../app/api/publish/webhook/sweetbook/route")
    const raw=JSON.stringify({eventUid:"late-qa",eventType:"order.cancelled",data:{orderUid:"print-fixture"}})
    const timestamp=String(Math.floor(Date.now()/1000))
    const request=(signature:string)=>new NextRequest("http://test/webhook",{method:"POST",body:raw,headers:{"X-Webhook-Timestamp":timestamp,"X-Webhook-Signature":signature}})
    assert.equal((await route.POST(request("bad"))).status,401)
    const signature=`sha256=${createHmac("sha256","archived-test-only").update(`${timestamp}.${raw}`).digest("hex")}`
    const response=await route.POST(request(signature))
    assert.equal(response.status,200); assert.equal((await response.json()).ignored,true)
  } finally {globalThis.fetch=savedFetch;if(savedSecret===undefined)delete process.env.SWEETBOOK_WEBHOOK_SECRET;else process.env.SWEETBOOK_WEBHOOK_SECRET=savedSecret}
})
test("reconciliation excludes archived QA holds but still alerts on active monetary exceptions", async () => {
  sql(`update publishing_orders set archived_at=now(), review_required=true where id=${quote(id)}`)
  const route=await import("../../app/api/publish/reconcile/route")
  const request=()=>new NextRequest("http://test/api/publish/reconcile",{method:"POST",headers:{authorization:`Bearer ${process.env.PUBLISH_WORKER_SECRET}`}})
  const response=await route.POST(request())
  assert.equal(response.status,200); assert.equal((await response.json()).reviewRequired,0)
  seed()
  sql(`update publishing_orders set review_required=true where id=${quote(id)}`)
  assert.equal((await route.POST(request())).status,409)
})
for (const delta of [-1, 1, 100]) {
  test(`provider-confirmed full refund preserves FX rounding (${delta} minor units)`, async () => {
    assert.equal((await record({ type: "refunded", refundedMinor: 2_000_000 + delta, fullyRefunded: true })).error, null)
    assert.equal(order().status, "refunded")
    assert.equal(order().refunded_total_minor, 2_000_000 + delta)
    assert.equal(order().cancellation_status, "pending")
  })
}
test("refund rounding never bypasses an absent confirmation or a larger discrepancy", async () => {
  for (const change of [{ refundedMinor: 2_000_001 }, { refundedMinor: 2_000_101, fullyRefunded: true }, { refundedMinor: 1_900_000, fullyRefunded: true }]) {
    assert.ok((await record({ type: "refunded", ...change })).error)
    assert.equal(order().status, "pending")
  }
})
for (const [label, change] of Object.entries({ "test/live mismatch": { testMode: false }, "wrong store": { storeId: "other" }, "wrong variant": { variantId: "other" }, "wrong currency": { currency: "USD" } })) {
  test(`${label} rejects before printing and rolls back ledger`, async () => {
    assert.ok((await record(change)).error)
    assert.equal(order().status, "pending")
    assert.equal(rows("select * from publishing_webhook_events").length, 0)
    assert.equal(await work.runPaymentWork(id), false)
    assert.equal(printCalls, 0)
  })
}
test("payment unique constraint failure never reaches printing", async () => {
  assert.equal((await record()).error, null)
  const first = id; seed()
  assert.equal((await record()).error,null)
  assert.equal(order().review_required,true)
  assert.equal(order().status, "pending")
  assert.equal(await work.runPaymentWork(id), false)
  assert.equal(rows(`select * from publishing_orders where id=${quote(first)}`)[0].status, "paid")
})
test("duplicate receipts do not reset a manual-review hold", async () => {
  const key = randomUUID(); await record({},key)
  sql(`update publishing_orders set status='failed',review_required=true where id=${quote(id)}`)
  await record({},key); await record()
  assert.equal(order().review_required, true)
  assert.equal(order().status, "failed")
})
test("concurrent claims allow one worker", async () => {
  await record()
  const results = await Promise.all([db.db().rpc("publishing_claim_work", {p_order_id:id}), db.db().rpc("publishing_claim_work", {p_order_id:id})])
  assert.equal(results.reduce((n,r) => n + r.data.length,0),1)
})
test("stale worker token cannot attach a print order", async () => {
  await record()
  const claimed = await db.db().rpc("publishing_claim_work", {p_order_id:id})
  sql(`update publishing_orders set fulfillment_until=now()-interval '1 second' where id=${quote(id)}`)
  await db.db().rpc("publishing_claim_work", {p_order_id:id})
  const stale = await db.db().rpc("publishing_attach_print", {p_order_id:id,p_token:claimed.data[0].fulfillment_token,p_print_uid:"old",p_status:"PDF_READY"})
  assert.equal(stale.data.length,0)
})
test("over/undercharge is recorded and held for monetary review", async () => {
  await record({totalMinor:2_000_001})
  assert.equal(order().review_required,true)
  assert.equal(order().charged_total_minor,2_000_001)
  assert.equal(await work.runPaymentWork(id),false)
})
test("success submits once and clears the lease", async () => {
  await record(); assert.equal(await work.runPaymentWork(id),true)
  assert.equal(order().status,"submitted"); assert.equal(order().fulfillment_token,null)
  assert.equal(await work.runPaymentWork(id),false); assert.equal(printCalls,1)
})
test("supplier outage stays durable and retry succeeds", async () => {
  await record(); failPrint=true; assert.equal(await work.runPaymentWork(id),false)
  assert.equal(order().status,"failed"); assert.ok(order().next_retry_at); assert.equal(order().review_required,false)
  failPrint=false; sql(`update publishing_orders set next_retry_at=now() where id=${quote(id)}`)
  assert.equal(await work.runPaymentWork(id),true); assert.equal(order().status,"submitted")
})
test("five failures become an operational exception", async () => {
  await record(); failPrint=true
  for (let i=0;i<5;i++) { sql(`update publishing_orders set next_retry_at=now() where id=${quote(id)}`); await work.runPaymentWork(id) }
  assert.equal(order().review_required,true); assert.equal(await work.runPaymentWork(id),false)
})
test("refund during supplier call remains refunded and cancels printing", async () => {
  await record(); refundDuringPrint=true; assert.equal(await work.runPaymentWork(id),true)
  assert.equal(order().status,"refunded"); assert.equal(order().cancellation_status,"cancelled"); assert.equal(cancelCalls,1)
})
test("lost create/DB response during refund recovers using persisted intent", async () => {
  await record(); refundDuringPrint=true; failAttach=true; assert.equal(await work.runPaymentWork(id),false)
  assert.equal(order().status,"refunded"); assert.equal(order().print_order_uid,null)
  refundDuringPrint=false; sql(`update publishing_orders set next_retry_at=now() where id=${quote(id)}`)
  assert.equal(await work.runPaymentWork(id),true); assert.equal(order().cancellation_status,"cancelled")
})
test("missing refund callback is recovered from the provider before printing", async () => {
  // No durable print intent: a pre-print refund must not create an order just to cancel it.
  sql(`update publishing_orders set print_request=null,print_requested_at=null where id=${quote(id)}`)
  await record(); providerRefund=2_000_000
  assert.equal(await work.runPaymentWork(id),true); assert.equal(printCalls,0)
  assert.equal(order().status,"refunded"); assert.equal(order().cancellation_status,"not_started")
})
test("refund after production has started needs review and does not claim cancellation", async () => {
  await record(); await work.runPaymentWork(id); printStatus="IN_PRODUCTION"; providerRefund=2_000_000
  await record({type:"refunded",rawEventName:"order_refunded",refundedMinor:providerRefund})
  await work.runPaymentWork(id)
  assert.equal(order().cancellation_status,"needs_review"); assert.equal(order().review_required,true); assert.equal(cancelCalls,0)
})
test("partial refunds pause unsubmitted work without claiming full cancellation", async () => {
  await record(); await record({type:"refunded",rawEventName:"order_refunded",refundedMinor:500000})
  assert.equal(order().status,"failed"); assert.equal(order().refunded_total_minor,500000); assert.equal(order().review_required,true)
  assert.equal(await work.runPaymentWork(id),false)
  await record({type:"refunded",rawEventName:"order_refunded",refundedMinor:2_000_000})
  await record({type:"refunded",rawEventName:"order_refunded",refundedMinor:500000})
  assert.equal(order().status,"refunded"); assert.equal(order().refunded_total_minor,2_000_000)
})
test("late paid callback cannot undo a refund", async () => {
  await record({type:"refunded",rawEventName:"order_refunded",refundedMinor:2_000_000}); await record()
  assert.equal(order().status,"refunded")
})
test("refund for another provider order is rejected", async () => {
  await record(); assert.equal((await record({type:"refunded",providerOrderId:"999",refundedMinor:2_000_000})).error,null)
  assert.equal(order().refunded_total_minor,0); assert.equal(order().review_required,true)
  assert.equal(order().status,"paid")
})
test("expired idempotency intent cannot create another supplier order", async () => {
  await record(); sql(`update publishing_orders set print_requested_at=now()-interval '24 hours' where id=${quote(id)}`)
  assert.equal(await work.runPaymentWork(id),false); assert.equal(printCalls,0); assert.equal(order().review_required,true)
})
test("early print callback is retryable and failed callback is not falsely deduplicated", async () => {
  const args = {p_event_id:"print-event",p_event_name:"order.created",p_print_uid:"print-fixture",p_status:"PDF_READY"}
  const early = await db.db().rpc("publishing_record_print_event",args)
  assert.equal(early.data,false); assert.equal(rows("select * from publishing_webhook_events").length,0)
  sql(`update publishing_orders set print_order_uid='print-fixture' where id=${quote(id)}`)
  assert.equal((await db.db().rpc("publishing_record_print_event",args)).data,true)
  assert.equal((await db.db().rpc("publishing_record_print_event",args)).data,true)
})
test("protected order API blocks missing/wrong tokens before supplier lookup", async () => {
  sql(`update publishing_orders set print_order_uid='print-fixture' where id=${quote(id)}`)
  assert.equal(await db.authorizedOrder(id,token)?.then(Boolean),true)
  assert.equal(await db.authorizedOrder(id,"a".repeat(32)),null)
  const missing = await api.GET(new NextRequest("https://example.com/api/publish/orders/print-fixture"),{params:Promise.resolve({orderUid:"print-fixture"})})
  assert.equal(missing.status,404)
  const owned = await api.GET(new NextRequest(`https://example.com/api/publish/orders/print-fixture?token=${token}`),{params:Promise.resolve({orderUid:"print-fixture"})})
  assert.equal(owned.status,200); assert.equal(owned.headers.get("cache-control"),"private, no-store")
})
test("signed malformed JSON and unsigned header event substitution return 400", async () => {
  for (const raw of ["{",JSON.stringify({meta:{event_name:"order_created"},data:{id:"123",attributes:{status:"paid",test_mode:true}}})]) {
    const signature=createHmac("sha256","test-only").update(raw).digest("hex")
    const result=await webhook.POST(new NextRequest("https://example.com/webhook",{method:"POST",body:raw,headers:{"X-Signature":signature,"X-Event-Name":"order_refunded"}}))
    assert.equal(result.status,400)
  }
})
test("shared-store webhooks ignore unrelated products after verifying the signature", async () => {
  const raw=JSON.stringify({meta:{event_name:"order_created"},data:{id:"999",attributes:{status:"paid",test_mode:true,
    store_id:439240,first_order_item:{variant_id:42},currency:"USD",total:1000}}})
  const request=(signature:string)=>new NextRequest("https://example.com/webhook",{method:"POST",body:raw,headers:{"X-Signature":signature}})
  assert.equal((await webhook.POST(request("bad"))).status,401)
  const result=await webhook.POST(request(createHmac("sha256","test-only").update(raw).digest("hex")))
  assert.equal(result.status,200); assert.equal((await result.json()).ignored,true)
  assert.equal(rows("select * from publishing_webhook_events").length,0)
})
test("ECB cross rates reject missing, future and stale data", async () => {
  const {parseKrwUsdRate}=await import("../../lib/publishing/exchange-rate")
  const xml="<Cube time='2026-10-09'><Cube currency='USD' rate='1.12'/><Cube currency='KRW' rate='1500'/></Cube>"
  assert.equal(parseKrwUsdRate(xml,Date.parse("2026-10-12")).krwPerUsd,1500/1.12)
  for(const [source,now] of [[xml,Date.parse("2026-10-20")],[xml,Date.parse("2026-10-01")],[xml.replace("KRW","JPY"),Date.parse("2026-10-12")]] as const)
    assert.throws(()=>parseKrwUsdRate(source,now))
})
function checkoutForm(attemptId=randomUUID(), quantity="1") {
  const form = new FormData()
  for (const [k,v] of Object.entries({attemptId,email:"checkout@example.com",title:"Audit",authorName:"Audit",bookSpecUid:"A5",textSize:"normal",coverTheme:"ivory",quantity,recipientName:"Audit",recipientPhone:"010-1234-5678",postalCode:"12345",address1:"Audit address"})) form.set(k,v)
  form.set("manuscript",new File(["# Audit\n\nA synthetic manuscript."],"fixture.md"))
  form.set("acknowledgeOrderTerms","true")
  return form
}
test("checkout refuses orders that skipped the made-to-order and overseas transfer notice", async () => {
  const attempt=randomUUID(), form=checkoutForm(attempt)
  form.delete("acknowledgeOrderTerms")
  const response=await checkout.POST(new NextRequest("https://example.com/checkout",{method:"POST",body:form}))
  assert.equal(response.status,400)
  assert.equal(rows(`select id from publishing_projects where id=${quote(attempt)}`).length,0)
  assert.equal(rows(`select id from publishing_orders where id=${quote(attempt)}`).length,0)
  assert.equal(checkoutCalls,0)
})
test("checkout records malformed requests before an order exists without retaining request contents", async () => {
  const response = await checkout.POST(new NextRequest("https://example.com/checkout?token=private-token", {
    method: "POST", headers: {"content-type":"application/json","x-checkout-probe":"1"},
    body: JSON.stringify({email:"private@example.com",manuscript:"Private manuscript",address:"Private address"}),
  }))
  assert.equal(response.status,400)
  const observations = rows("select * from publishing_checkout_attempts")
  assert.equal(observations.length,1)
  const a = observations[0]
  assert.equal(a.id,response.headers.get("X-Checkout-Request-Id"))
  assert.equal(a.stage,"form"); assert.equal(a.outcome,"rejected")
  assert.equal(a.attempt_id,null); assert.equal(a.order_id,null); assert.equal(a.is_probe,false)
  assert.ok(a.finished_at); assert.ok(Number(a.duration_ms)>=0)
  assert.doesNotMatch(JSON.stringify(a),/private|manuscript.*Private|address.*Private/i)
  assert.equal(checkoutCalls,0); assert.equal(printCalls,0)
})
test("authenticated checkout probes are recorded separately; client headers cannot suppress alerts", async () => {
  const response = await checkout.POST(new NextRequest("https://example.com/checkout", {
    method:"POST", headers:{"x-checkout-probe":"1",authorization:`Bearer ${process.env.PUBLISH_WORKER_SECRET}`},
    body:"invalid form",
  }))
  assert.equal(response.status,400)
  assert.equal(rows("select is_probe from publishing_checkout_attempts")[0].is_probe,true)
})
test("configuration failure is durable before project or order persistence", async () => {
  const secret = process.env.PUBLISH_WORKER_SECRET
  delete process.env.PUBLISH_WORKER_SECRET
  const attempt = randomUUID()
  try {
    const response=await checkout.POST(new NextRequest("https://example.com/checkout",{method:"POST",body:checkoutForm(attempt)}))
    assert.equal(response.status,502)
    const a=rows("select * from publishing_checkout_attempts")[0]
    assert.equal(a.attempt_id,attempt); assert.equal(a.order_id,null)
    assert.equal(a.stage,"configuration"); assert.equal(a.outcome,"failed")
    assert.equal(rows(`select id from publishing_orders where id=${quote(attempt)}`).length,0)
    assert.equal(rows(`select id from publishing_projects where id=${quote(attempt)}`).length,0)
    assert.equal(checkoutCalls,0); assert.equal(printCalls,0)
  } finally {process.env.PUBLISH_WORKER_SECRET=secret}
})
test("checkout ready and idempotent retries retain separate request traces linked to one order", async () => {
  const attempt=randomUUID()
  for(let i=0;i<2;i++) assert.equal((await checkout.POST(new NextRequest("https://example.com/checkout",{method:"POST",body:checkoutForm(attempt)}))).status,200)
  const a=rows("select * from publishing_checkout_attempts")
  assert.equal(a.length,2); assert.notEqual(a[0].id,a[1].id)
  for(const row of a) {assert.equal(row.attempt_id,attempt); assert.equal(row.order_id,attempt); assert.equal(row.outcome,"ready")}
  assert.equal(checkoutCalls,1); assert.equal(printCalls,0)
})
test("a lost observation write does not fail checkout and is reported after recovery", async () => {
  const saved=globalThis.fetch
  let fail=true
  globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
    if(fail && String(input).includes("/publishing_checkout_attempts")){fail=false;return Response.json({message:"private injected failure"},{status:503})}
    return saved(input,init)
  }) as typeof fetch
  try {
    const response=await checkout.POST(new NextRequest("https://example.com/checkout",{method:"POST",body:checkoutForm()}))
    assert.equal(response.status,200)
    const a=rows("select * from publishing_checkout_attempts")[0]
    assert.equal(a.outcome,"ready"); assert.equal(a.persistence_failed,true)
    assert.doesNotMatch(JSON.stringify(a),/private injected failure/)
  } finally {globalThis.fetch=saved}
})
test("provider failure is linked to the saved order without retaining provider error contents", async () => {
  const saved=globalThis.fetch, attempt=randomUUID()
  globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
    if(String(input).includes("api.lemonsqueezy.com/v1/checkouts")) return Response.json({errors:[{detail:"private@example.com private-token"}]},{status:503})
    return saved(input,init)
  }) as typeof fetch
  try {
    const response=await checkout.POST(new NextRequest("https://example.com/checkout",{method:"POST",body:checkoutForm(attempt)}))
    assert.equal(response.status,502)
    const a=rows("select * from publishing_checkout_attempts")[0]
    assert.equal(a.stage,"payment"); assert.equal(a.outcome,"failed"); assert.equal(a.order_id,attempt)
    assert.equal(order().fulfillment_attempts,0); assert.equal(printCalls,0)
    assert.doesNotMatch(JSON.stringify(a),/private@example|private-token/)
  } finally {globalThis.fetch=saved}
})
test("monitoring storage failure is a failed health check, not an empty healthy report", async () => {
  const saved=globalThis.fetch
  globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
    if(String(input).includes("/rpc/publishing_checkout_monitor")) return Response.json({message:"Injected monitor failure"},{status:503})
    return saved(input,init)
  }) as typeof fetch
  try {
    const route=await import("../../app/api/publish/reconcile/route")
    const response=await route.POST(new NextRequest("https://example.com/api/publish/reconcile?monitor=1",{method:"POST",headers:{authorization:`Bearer ${process.env.PUBLISH_WORKER_SECRET}`}}))
    assert.equal(response.status,503); assert.equal(printCalls,0)
  } finally {globalThis.fetch=saved}
})
test("monitor flags live failures and interrupted requests, excludes QA, and supports explicit review", async () => {
  const observationId=randomUUID(), stalled=randomUUID()
  sql(`insert into publishing_checkout_attempts(id,stage,outcome,http_status,finished_at,environment,test_mode)
    values (${quote(observationId)},'supplier','failed',502,now(),'production',false)`)
  sql(`insert into publishing_checkout_attempts(id,stage,created_at,environment,test_mode)
    values (${quote(stalled)},'typeset',now()-interval '6 minutes','production',false)`)
  for(const [environment,test,probe] of [["preview",false,false],["production",true,false],["production",false,true]]) {
    sql(`insert into publishing_checkout_attempts(id,stage,outcome,http_status,finished_at,environment,test_mode,is_probe)
      values (${quote(randomUUID())},'payment','failed',502,now(),${quote(environment)},${test},${probe})`)
  }
  const route=await import("../../app/api/publish/reconcile/route")
  const request=()=>new NextRequest("https://example.com/api/publish/reconcile?monitor=1",{method:"POST",headers:{authorization:`Bearer ${process.env.PUBLISH_WORKER_SECRET}`}})
  const response=await route.POST(request()), data=await response.json()
  assert.equal(response.status,409); assert.equal(data.checkout.unreviewedFailures,1); assert.equal(data.checkout.stalled,1)
  assert.equal(data.checkout.exceptions.length,2); assert.equal(printCalls,0); assert.equal(checkoutCalls,0)
  assert.equal((await route.POST(new NextRequest("https://example.com/api/publish/reconcile?monitor=1",{method:"POST"}))).status,401)
  sql(`update publishing_checkout_attempts set reviewed_at=now() where id in (${quote(observationId)},${quote(stalled)})`)
  assert.equal((await route.POST(request())).status,200)
  assert.equal((await route.POST(new NextRequest("https://example.com/api/publish/reconcile",{method:"POST",headers:{authorization:`Bearer ${process.env.PUBLISH_WORKER_SECRET}`}}))).status,200)
})
test("repeated input rejections trigger monitoring without treating one typo as a server incident", async () => {
  const {checkoutMonitor}=await import("../../lib/publishing/checkout-observation")
  for(let i=0;i<10;i++) {
    sql(`insert into publishing_checkout_attempts(id,stage,outcome,http_status,finished_at,environment,test_mode)
      values (${quote(randomUUID())},'email','rejected',400,now(),'production',false)`)
    assert.equal((await checkoutMonitor()).alert,i===9)
  }
})
test("checkout observations and monitor RPC are inaccessible to public database roles", () => {
  for(const role of ["anon","authenticated"]) {
    for(const permission of ["select","insert","update","delete"]) assert.equal(sql(`select has_table_privilege('${role}','public.publishing_checkout_attempts','${permission}')`),"f")
    assert.equal(sql(`select has_function_privilege('${role}','public.publishing_checkout_monitor()','execute')`),"f")
  }
  assert.equal(sql("select relrowsecurity from pg_class where oid='public.publishing_checkout_attempts'::regclass"),"t")
})
test("checkout retry reuses one local order and hosted checkout; redirect is canonical", async () => {
  const attempt=randomUUID()
  const request=() => new NextRequest("https://example.com/api/publish/checkout",{method:"POST",headers:{origin:"https://attacker.example"},body:checkoutForm(attempt)})
  const first=await checkout.POST(request()); assert.equal(first.status,200,JSON.stringify(await first.clone().json()))
  const a=await first.json(); const second=await checkout.POST(request()); const b=await second.json()
  assert.equal(second.status,200); assert.equal(a.orderId,b.orderId); assert.equal(a.checkoutUrl,b.checkoutUrl); assert.equal(checkoutCalls,1)
  assert.equal(rows(`select * from publishing_orders where id=${quote(attempt)}`).length,1)
  assert.ok(a.orderUrl.includes("token="))
})
test("archiving a QA checkout prevents reusing its formerly valid hosted payment link", async () => {
  const attempt=randomUUID()
  const request=()=>new NextRequest("https://example.com/api/publish/checkout",{method:"POST",body:checkoutForm(attempt)})
  assert.equal((await checkout.POST(request())).status,200)
  sql(`update publishing_orders set archived_at=now() where id=${quote(attempt)}`)
  const response=await checkout.POST(request())
  assert.equal(response.status,409); assert.equal((await response.json()).restart,true)
  assert.equal(checkoutCalls,1)
})
test("USD checkout saves the exact preview and reuses its frozen FX quote on retry", async () => {
  const saved=globalThis.fetch, savedCurrency=process.env.LEMONSQUEEZY_STORE_CURRENCY
  let rateReads=0
  process.env.LEMONSQUEEZY_STORE_CURRENCY="USD"
  globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=String(input)
    if(url.includes("ecb.europa.eu")) {rateReads++;return new Response(`<Cube time='${new Date().toISOString().slice(0,10)}'><Cube currency='USD' rate='1'/><Cube currency='KRW' rate='1400'/></Cube>`)}
    if(url.endsWith("/checkouts")) {checkoutCalls++;const sent=JSON.parse(String(init?.body));const cents=sent.data.attributes.custom_price
      return Response.json({data:{id:"usd-fixture",attributes:{test_mode:true,url:"https://weeklyventures.lemonsqueezy.com/checkout/fixture",preview:{currency:"USD",total:cents}}}})}
    return saved(input,init)
  }) as typeof fetch
  try {
    const attempt=randomUUID(), request=()=>new NextRequest("https://example.com/checkout",{method:"POST",body:checkoutForm(attempt)})
    const first=await checkout.POST(request()), a=await first.json()
    assert.equal(first.status,200,JSON.stringify(a)); assert.equal(a.currency,"USD")
    assert.equal(a.totalMinor,Math.floor(a.priceKrw/1400*100))
    const row=rows(`select * from publishing_orders where id=${quote(attempt)}`)[0]
    assert.equal(row.expected_total_minor,a.totalMinor);assert.equal(row.exchange_rate_krw_per_usd,1400)
    const second=await checkout.POST(request()),b=await second.json()
    assert.equal(second.status,200);assert.equal(b.totalMinor,a.totalMinor);assert.equal(rateReads,1);assert.equal(checkoutCalls,1)
  } finally {globalThis.fetch=saved;process.env.LEMONSQUEEZY_STORE_CURRENCY=savedCurrency}
})
test("USD preview tax is fitted below the KRW ceiling and FX outages fail closed", async () => {
  const saved=globalThis.fetch
  const provider=new payment.LemonSqueezyProvider("test-only","439240","test-only","USD")
  const input={reference:id,successUrl:"https://www.nanudacompany.com/done",lines:[{kind:"physical" as const,variantId:"2115295",name:"Audit",priceKrw:20000,quantity:1}]}
  let available=true
  globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
    if(String(input).includes("ecb.europa.eu")) return available?new Response(`<Cube time='${new Date().toISOString().slice(0,10)}'><Cube currency='USD' rate='1'/><Cube currency='KRW' rate='1400'/></Cube>`):new Response("down",{status:503})
    const cents=JSON.parse(String(init?.body)).data.attributes.custom_price
    return Response.json({data:{id:"usd-tax",attributes:{test_mode:true,url:"https://weeklyventures.lemonsqueezy.com/checkout/fixture",preview:{currency:"USD",total:Math.round(cents*1.1)}}}})
  }) as typeof fetch
  try {
    const result=await provider.createCheckout(input)
    assert.ok(result.totalMinor<=Math.floor(20000/1400*100));assert.ok(result.totalMinor*14>=19500)
    available=false; await assert.rejects(()=>provider.createCheckout(input),/환율/)
  } finally {globalThis.fetch=saved}
})
test("fractional quantity is rejected before creating a project", async () => {
  const result=await checkout.POST(new NextRequest("https://example.com/checkout",{method:"POST",body:checkoutForm(randomUUID(),"1.5")}))
  assert.equal(result.status,400); assert.equal(checkoutCalls,0)
})
test("provider configuration pins checkout mode, variants and hides discounts", async () => {
  let sent: Record<string,any> | undefined
  const savedFetch=globalThis.fetch
  globalThis.fetch=async (_input,init) => { sent=JSON.parse(String(init?.body)); return Response.json({data:{id:"co",attributes:{test_mode:true,url:"https://nanuda.lemonsqueezy.com/checkout/fixture",preview:{total:2_000_000}}}}) }
  try {
    const provider = payment.getPaymentProvider()
    await provider.createCheckout({reference:id,successUrl:"https://www.nanudacompany.com/done",lines:[{kind:"physical",variantId:"2115295",name:"Audit",priceKrw:20000,quantity:1}]})
    assert.equal(sent!.data.attributes.test_mode,true); assert.equal(sent!.data.attributes.checkout_options.discount,false)
    assert.deepEqual(sent!.data.attributes.product_options.enabled_variants,[2115295]); assert.ok(sent!.data.attributes.expires_at)
  } finally {globalThis.fetch=savedFetch}
})
test("malformed provider reconciliation amounts cannot reach the payment ledger", async () => {
  const saved=globalThis.fetch
  globalThis.fetch=async()=>Response.json({data:{id:"123",attributes:{store_id:439240,first_order_item:{variant_id:2115295},test_mode:true,status:"paid",currency:"USD",total:"invalid",refunded_amount:0}}})
  try {await assert.rejects(()=>payment.getPaymentProvider().getOrderEvent("123",id),/금액/)} finally {globalThis.fetch=saved}
  assert.equal(rows("select * from publishing_webhook_events").length,0)
})
test("test checkout cannot reach supplier live environment", () => {
  process.env.SWEETBOOK_API_BASE="https://api.sweetbook.com/v1"
  try { assert.throws(()=>payment.assertPaymentEnvironment(true)) } finally {process.env.SWEETBOOK_API_BASE="https://api-sandbox.sweetbook.com/v1"}
})
test("invalid provider checkout URLs are rejected", () => {
  for (const url of ["http://nanuda.lemonsqueezy.com/checkout","https://evil.example","https://lemonsqueezy.com.evil.example","https://user:secret@nanuda.lemonsqueezy.com"]) assert.throws(()=>payment.safeCheckoutUrl(url))
})
test("RPC execution is denied to anonymous clients", () => {
  assert.throws(()=>sql("set role anon; select * from publishing_claim_work(null)"),/permission denied/)
})

test("partial refund hold survives a concurrent supplier failure", async () => {
  assert.equal((await record()).error,null); partialDuringFailure=true
  assert.equal(await work.runPaymentWork(id),false)
  assert.equal(order().review_required,true); assert.equal(order().refunded_total_minor,500000)
  assert.equal(await work.runPaymentWork(id),false)
})
test("print callbacks preserve terminal progress against older callbacks", async () => {
  sql(`update publishing_orders set print_order_uid='print-fixture',print_status='DELIVERED' where id=${quote(id)}`)
  const result=await db.db().rpc("publishing_record_print_event", {p_event_id:"older",p_event_name:"order.created",p_print_uid:"print-fixture",p_status:"PDF_READY"})
  assert.equal(result.error,null); assert.equal(order().print_status,"DELIVERED")
})
test("supplier cancellation of a paid order becomes a monetary exception", async () => {
  await record(); await work.runPaymentWork(id)
  await db.db().rpc("publishing_record_print_event", {p_event_id:"cancel",p_event_name:"order.cancelled",p_print_uid:"print-fixture",p_status:"CANCELLED_REFUND"})
  assert.equal(order().status,"failed"); assert.equal(order().review_required,true)
})

test("concurrent PostgreSQL sessions skip a locked order", async () => {
  await record()
  const execute = promisify(execFile)
  const query = `select count(*) from publishing_claim_work(${quote(id)})`
  const results = await Promise.all([1,2].map(() => execute("psql",["-h","127.0.0.1","-p",process.env.NANUDA_PAYMENT_TEST_PORT ?? "55439","-U","postgres","-d","nanuda_payment_test","-At","-v","ON_ERROR_STOP=1","-c","begin","-c",query,"-c","select pg_sleep(0.1)","-c","commit"])))
  assert.equal(results.reduce((n,r) => n + Number(r.stdout.match(/^[01]$/m)?.[0]),0),1,JSON.stringify(results.map(r=>r.stdout)))
})
test("DOCX expanded size and misleading ZIP metadata are bounded before parsing", async () => {
  const { validateDocxArchive } = await import("../../lib/publishing/manuscript")
  const packed=deflateRawSync(Buffer.alloc(1024*1024,65))
  const local=Buffer.alloc(30); local.writeUInt32LE(0x04034b50,0)
  const central=Buffer.alloc(46); central.writeUInt32LE(0x02014b50,0); central.writeUInt16LE(8,10)
  central.writeUInt32LE(packed.length,20); central.writeUInt32LE(1,24)
  const end=Buffer.alloc(22); end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(1,10)
  end.writeUInt32LE(central.length,12); end.writeUInt32LE(local.length+packed.length,16)
  assert.throws(()=>validateDocxArchive(Buffer.concat([local,packed,central,end])))
  central.writeUInt32LE(26*1024*1024,24)
  assert.throws(()=>validateDocxArchive(Buffer.concat([local,packed,central,end])),/25MB/)
})

test("retry after book finalization does not replace PDFs on a finalized book", async () => {
  sql(`update publishing_orders set print_request=null,print_requested_at=null,book_uid='book-fixture' where id=${quote(id)}`)
  await record()
  assert.equal(await work.runPaymentWork(id),true)
  assert.equal(uploadCalls,0); assert.equal(printCalls,1); assert.equal(order().status,"submitted")
})

test("lost refund callback after submission is recovered by scheduled reconciliation", async () => {
  await record(); await work.runPaymentWork(id)
  providerRefund=2_000_000
  assert.equal(await work.reconcileSubmittedOrder(),true)
  assert.equal(order().status,"refunded"); assert.equal(order().cancellation_status,"cancelled")
})

test("cancelled terminal state is never overwritten by a late print response", async () => {
  await record()
  const claim=await db.db().rpc("publishing_claim_work",{p_order_id:id})
  sql(`update publishing_orders set status='cancelled' where id=${quote(id)}`)
  const result=await db.db().rpc("publishing_attach_print",{p_order_id:id,p_token:claim.data[0].fulfillment_token,p_print_uid:"print-fixture",p_status:"PDF_READY"})
  assert.equal(result.error,null); assert.equal(order().status,"cancelled")
})
test("unreadable photo cover is rejected before checkout or storage writes", async () => {
  const form=checkoutForm(); form.set("coverTheme","photo")
  form.set("coverImage",new File(["not an image"],"bad.png",{type:"image/png"}))
  const result=await checkout.POST(new NextRequest("https://example.com/checkout",{method:"POST",body:form}))
  assert.equal(result.status,400); assert.equal(checkoutCalls,0)
})

test("authenticated deployment checks validate credentials without payments or DB writes", async () => {
  const route = await import("../../app/api/publish/reconcile/route")
  const savedFetch = globalThis.fetch
  let mode = true, currency = "KRW", available = true
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? String(input) : input.url)
    if (url.hostname === "api.lemonsqueezy.com" && /\/(stores|variants|products)\//.test(url.pathname)) {
      assert.ok(!init?.method || init.method === "GET")
      if (!available) return Response.json({}, { status: 404 })
      return Response.json({ data: { attributes: url.pathname.includes("/stores/") ? { currency }
        : url.pathname.includes("/products/") ? {store_id:439240} : { test_mode: mode, status: "pending", product_id:1354509 } } })
    }
    return savedFetch(input, init)
  }) as typeof fetch
  const call = () => route.POST(new NextRequest("https://example.com/api/publish/reconcile?check=1", {
    method: "POST", headers: { authorization: `Bearer ${process.env.PUBLISH_WORKER_SECRET}` },
  }))
  try {
    assert.equal((await call()).status, 200)
    mode = false; assert.equal((await call()).status, 503)
    mode = true; currency = "USD"; assert.equal((await call()).status, 503)
    currency = "KRW"; available = false; assert.equal((await call()).status, 503)
    assert.equal(order().status, "pending"); assert.equal(printCalls, 0); assert.equal(checkoutCalls, 0)
    assert.equal(rows("select * from publishing_webhook_events").length, 0)
    assert.equal((await route.POST(new NextRequest("https://example.com/api/publish/reconcile?check=1", { method: "POST" }))).status, 401)
  } finally { globalThis.fetch = savedFetch }
})
test("live readiness accepts only a published product with its sole pending default variant", async () => {
  const saved=globalThis.fetch, savedMode=process.env.LEMONSQUEEZY_TEST_MODE
  process.env.LEMONSQUEEZY_TEST_MODE="false"
  let published=true, sole=true, owns=true
  globalThis.fetch=(async(input:RequestInfo|URL)=>{
    const path=new URL(String(input)).pathname
    const data=path.includes("/stores/")?{attributes:{currency:"KRW"}}
      :path==="/v1/variants/2115295"?{attributes:{product_id:1354509,test_mode:false,status:"pending"}}
      :path.endsWith("/variants")?(sole?[{id:"2115295"}]:[{id:"2115295"},{id:"other"}])
      :{id:"1354509",attributes:{store_id:owns?439240:277249,status:published?"published":"draft"}}
    return Response.json({data})
  }) as typeof fetch
  try {
    await payment.getPaymentProvider().checkConfiguration()
    published=false;await assert.rejects(()=>payment.getPaymentProvider().checkConfiguration(),/published/)
    published=true;sole=false;await assert.rejects(()=>payment.getPaymentProvider().checkConfiguration(),/옵션/)
    sole=true;owns=false;await assert.rejects(()=>payment.getPaymentProvider().checkConfiguration(),/스토어/)
  } finally {globalThis.fetch=saved;process.env.LEMONSQUEEZY_TEST_MODE=savedMode}
})
test("supplier environment guard rejects credential transmission over HTTP", () => {
  const saved = process.env.SWEETBOOK_API_BASE
  try {
    process.env.SWEETBOOK_API_BASE = "http://api.sweetbook.com/v1"
    assert.throws(() => payment.assertPaymentEnvironment(false))
  } finally { process.env.SWEETBOOK_API_BASE = saved }
})

test("missing or zero catalog prices cannot produce a shipping-only checkout", async () => {
  const savedFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? String(input) : input.url)
    if (url.pathname === "/v1/book-specs") return Response.json({success:true,data:[{bookSpecUid:"A5",pageIncrement:2,priceBase:null,pricePerIncrement:null}]})
    return savedFetch(input, init)
  }) as typeof fetch
  try {
    const form = checkoutForm()
    const response = await checkout.POST(new NextRequest("https://example.com/api/publish/checkout", {method:"POST",body:form}))
    assert.equal(response.status, 503)
    const preview = await import("../../app/api/publish/typeset/route")
    assert.equal((await preview.POST(new NextRequest("https://example.com/api/publish/typeset", {method:"POST",body:checkoutForm()}))).status,503)
    assert.equal(checkoutCalls, 0); assert.equal(printCalls, 0)
    assert.equal(rows("select * from publishing_orders").length, 1)
    const pricing = await import("../../lib/publishing/pricing")
    for (const base of [0, -1, Number.NaN]) assert.throws(() => pricing.estimateDeliveredPrice({priceBase:base,pricePerIncrement:100,pageMin:32,pageIncrement:2},32,1))
  } finally { globalThis.fetch = savedFetch }
})

test("a paid order cannot print with supplier credentials from the other environment", async () => {
  const savedFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? String(input) : input.url)
    if (url.pathname === "/v1/credits") return Response.json({success:true,data:{env:"live",currency:"KRW"}})
    return savedFetch(input,init)
  }) as typeof fetch
  try {
    assert.equal((await record()).error,null)
    assert.equal(await work.runPaymentWork(id),false)
    assert.equal(order().review_required,true)
    assert.equal(printCalls,0); assert.equal(cancelCalls,0)
  } finally {globalThis.fetch=savedFetch}
})

test("public catalog access never proves supplier authentication or print environment", async () => {
  const supplier = await import("../../lib/publishing/sweetbook")
  const savedFetch = globalThis.fetch
  let env = "live", authenticated = true
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? String(input) : input.url)
    if (url.pathname === "/v1/credits") return authenticated
      ? Response.json({success:true,data:{env,currency:"KRW",balance:12345}})
      : Response.json({success:false,message:"Unauthorized"},{status:401})
    return savedFetch(input,init)
  }) as typeof fetch
  try {
    await assert.rejects(supplier.assertSupplierEnvironment(true), /environment mismatch/)
    env = "test"; authenticated = false
    await assert.rejects(supplier.assertSupplierEnvironment(true), /Unauthorized/)
    assert.equal((await supplier.listBookSpecs()).length, 1)
    assert.equal(printCalls,0); assert.equal(checkoutCalls,0)
  } finally {globalThis.fetch=savedFetch}
})

function project() { return rows(`select * from publishing_projects where id=${quote(id)}`)[0] }
async function purge() { return (await import("../../lib/publishing/retention")).purgeExpiredFiles() }
function shipped(column: "shipped_at" | "delivered_at", age: string) {
  sql(`update publishing_orders set status='submitted', print_order_uid='print-fixture', payment_order_id='123',
    ${column}=now()-interval ${quote(age)} where id=${quote(id)}`)
}
test("retention purges unpaid order files only a day after checkout expiry, storage before paths", async () => {
  sql(`update publishing_projects set back_text='Private back text', cover_image_path='cover-fixture' where id=${quote(id)}`)
  sql(`update publishing_orders set status='cancelled', checkout_expires_at=now()-interval '23 hours' where id=${quote(id)}`)
  assert.equal(await purge(), 0)
  assert.equal(project().manuscript_path, "fixture")
  sql(`update publishing_orders set checkout_expires_at=now()-interval '25 hours' where id=${quote(id)}`)
  const orderBefore = order()
  assert.equal(await purge(), 1)
  assert.deepEqual(removedPaths, ["fixture", "cover-fixture"])
  const p = project()
  assert.equal(p.manuscript_path, null); assert.equal(p.cover_image_path, null); assert.equal(p.back_text, null)
  assert.ok(p.files_purged_at)
  assert.deepEqual(order(), orderBefore)
  assert.equal(await purge(), 0)
  assert.equal(removedPaths.length, 2)
})
test("retention keeps files any order may still print, reprint or review", async () => {
  const keep: [string, () => Promise<unknown> | void][] = [
    ["paid", () => record()],
    ["late payment on an expired checkout", async () => {
      sql(`update publishing_orders set status='cancelled', checkout_expires_at=now()-interval '2 days' where id=${quote(id)}`)
      await record()
    }],
    ["refund awaiting print cancellation", async () => { await record(); await record({type:"refunded",rawEventName:"order_refunded",refundedMinor:2_000_000}) }],
    ["refund whose print could not be cancelled", () => sql(`update publishing_orders set status='refunded', cancellation_status='needs_review', review_required=true where id=${quote(id)}`)],
    ["shipped two months ago", () => shipped("shipped_at", "2 months")],
    ["shipped three months ago without delivery", () => shipped("shipped_at", "3 months 10 days")],
    ["delivered under three months ago", () => shipped("delivered_at", "89 days")],
    ["delivered long ago but held for review", () => { shipped("delivered_at", "1 year"); sql(`update publishing_orders set review_required=true where id=${quote(id)}`) }],
    ["fresh order-less project", () => sql(`delete from publishing_orders where id=${quote(id)}`)],
  ]
  for (const [name, arrange] of keep) {
    sql("truncate publishing_webhook_events, publishing_orders, publishing_projects cascade"); seed()
    await arrange()
    assert.equal(await purge(), 0, name)
    assert.equal(project().manuscript_path, "fixture", name)
    assert.equal(project().files_purged_at, null, name)
  }
  assert.deepEqual(removedPaths, [])
})
test("retention purges delivered, fully cancelled, stale order-less and archived QA projects", async () => {
  const release: [string, () => Promise<unknown> | void][] = [
    ["delivered over three months ago", () => shipped("delivered_at", "3 months 1 day")],
    ["shipped without delivery past the transit allowance", () => shipped("shipped_at", "3 months 15 days")],
    ["refund with print cancelled", () => sql(`update publishing_orders set status='refunded', cancellation_status='cancelled' where id=${quote(id)}`)],
    ["refund before printing", () => sql(`update publishing_orders set status='refunded', cancellation_status='not_started' where id=${quote(id)}`)],
    ["crashed checkout without an order", () => sql(`delete from publishing_orders where id=${quote(id)}; update publishing_projects set created_at=now()-interval '2 days' where id=${quote(id)}`)],
    ["archived QA", () => sql(`update publishing_orders set status='paid', archived_at=now() where id=${quote(id)}`)],
  ]
  for (const [name, arrange] of release) {
    sql("truncate publishing_webhook_events, publishing_orders, publishing_projects cascade"); seed()
    await arrange()
    const before = rows(`select * from publishing_orders where id=${quote(id)}`)
    assert.equal(await purge(), 1, name)
    assert.equal(project().manuscript_path, null, name)
    assert.deepEqual(rows(`select * from publishing_orders where id=${quote(id)}`), before, name)
  }
})
test("a failed storage delete leaves the project locked and is retried", async () => {
  sql(`update publishing_orders set status='cancelled', checkout_expires_at=now()-interval '2 days' where id=${quote(id)}`)
  failStorageRemove = true
  await assert.rejects(purge(), /File purge failed/)
  assert.ok(project().files_purged_at)
  assert.equal(project().manuscript_path, "fixture")
  assert.equal(await purge(), 1)
  assert.deepEqual(removedPaths, ["fixture"])
  assert.equal(project().manuscript_path, null)
})
test("supplier shipping and delivery are stamped once for the retention clock", async () => {
  sql(`update publishing_orders set status='submitted', print_order_uid='print-fixture', print_status='IN_PRODUCTION' where id=${quote(id)}`)
  const event = (status: string) => db.db().rpc("publishing_record_print_event", {p_event_id:`retention-${status}-${randomUUID()}`,p_event_name:"test",p_print_uid:"print-fixture",p_status:status})
  await event("IN_PRODUCTION")
  assert.equal(order().shipped_at, null)
  await event("SHIPPED")
  const firstShipped = order().shipped_at
  assert.ok(firstShipped); assert.equal(order().delivered_at, null)
  await event("DELIVERED")
  assert.equal(order().shipped_at, firstShipped)
  assert.ok(order().delivered_at)
})
test("a checkout retry cannot revive a purged project", async () => {
  const attempt = randomUUID()
  assert.equal((await checkout.POST(new NextRequest("https://example.com/checkout",{method:"POST",body:checkoutForm(attempt)}))).status,200)
  sql(`update publishing_projects set files_purged_at=now(), manuscript_path=null, back_text=null where id=${quote(attempt)}`)
  const retry = await checkout.POST(new NextRequest("https://example.com/checkout",{method:"POST",body:checkoutForm(attempt)}))
  assert.equal(retry.status,409)
  assert.equal((await retry.json()).restart,true)
  assert.equal(checkoutCalls,1)
})
