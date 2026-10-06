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
  sql("truncate publishing_webhook_events, publishing_orders, publishing_projects cascade")
  printCalls = cancelCalls = checkoutCalls = uploadCalls = 0; printStatus = "PDF_READY"; failPrint = failAttach = refundDuringPrint = partialDuringFailure = false; providerRefund = 0
  seed()
})

test("verified payment and receipt ledger commit atomically", async () => {
  assert.equal((await record()).error, null)
  assert.equal(order().status, "paid")
  assert.equal(order().charged_total_minor, 2_000_000)
  assert.equal(rows("select * from publishing_webhook_events").length, 1)
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
function checkoutForm(attemptId=randomUUID(), quantity="1") {
  const form = new FormData()
  for (const [k,v] of Object.entries({attemptId,email:"checkout@example.com",title:"Audit",authorName:"Audit",bookSpecUid:"A5",textSize:"normal",coverTheme:"ivory",quantity,recipientName:"Audit",recipientPhone:"010-1234-5678",postalCode:"12345",address1:"Audit address"})) form.set(k,v)
  form.set("manuscript",new File(["# Audit\n\nA synthetic manuscript."],"fixture.md"))
  return form
}
test("checkout retry reuses one local order and hosted checkout; redirect is canonical", async () => {
  const attempt=randomUUID()
  const request=() => new NextRequest("https://example.com/api/publish/checkout",{method:"POST",headers:{origin:"https://attacker.example"},body:checkoutForm(attempt)})
  const first=await checkout.POST(request()); assert.equal(first.status,200,JSON.stringify(await first.clone().json()))
  const a=await first.json(); const second=await checkout.POST(request()); const b=await second.json()
  assert.equal(second.status,200); assert.equal(a.orderId,b.orderId); assert.equal(a.checkoutUrl,b.checkoutUrl); assert.equal(checkoutCalls,1)
  assert.equal(rows(`select * from publishing_orders where id=${quote(attempt)}`).length,1)
  assert.ok(a.orderUrl.includes("token="))
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
  const results = await Promise.all([1,2].map(() => execute("psql",["-h","127.0.0.1","-p","55439","-U","postgres","-d","nanuda_payment_test","-At","-v","ON_ERROR_STOP=1","-c","begin","-c",query,"-c","select pg_sleep(0.1)","-c","commit"])))
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
    if (url.hostname === "api.lemonsqueezy.com" && /\/(stores|variants)\//.test(url.pathname)) {
      assert.ok(!init?.method || init.method === "GET")
      if (!available) return Response.json({}, { status: 404 })
      return Response.json({ data: { attributes: url.pathname.includes("/stores/") ? { currency } : { test_mode: mode, status: "pending" } } })
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
test("supplier environment guard rejects credential transmission over HTTP", () => {
  const saved = process.env.SWEETBOOK_API_BASE
  try {
    process.env.SWEETBOOK_API_BASE = "http://api.sweetbook.com/v1"
    assert.throws(() => payment.assertPaymentEnvironment(false))
  } finally { process.env.SWEETBOOK_API_BASE = saved }
})
