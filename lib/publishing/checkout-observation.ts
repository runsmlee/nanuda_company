import { randomUUID, timingSafeEqual } from "node:crypto"
import { db } from "./db"

type Stage = "received" | "form" | "options" | "manuscript" | "email" | "shipping"
  | "configuration" | "supplier" | "parse" | "typeset" | "cover" | "project" | "order" | "payment" | "quote"

/** Server observations contain only IDs and allowlisted metadata, never request/error contents. */
export function checkoutObservation(headers: Headers) {
  const id = randomUUID()
  const started = Date.now()
  const secret = process.env.PUBLISH_WORKER_SECRET
  const supplied = Buffer.from(headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret ?? ""}`)
  const probe = !!secret && secret.length >= 32 && headers.get("x-checkout-probe") === "1"
    && supplied.length === expected.length && timingSafeEqual(supplied, expected)
  const environment = ["production", "preview"].includes(process.env.VERCEL_ENV ?? "") ? process.env.VERCEL_ENV : "development"
  let stored = false
  let persistenceFailed = false
  const observation = {
    id, stage: "received" as Stage, attemptId: null as string | null, orderId: null as string | null,
    async checkpoint(stage: Stage) {
      observation.stage = stage
      if (!persistenceFailed) await write()
    },
    async finish(status: number) {
      const outcome = status >= 500 ? "failed" : status >= 400 ? "rejected" : "ready"
      await write({ outcome, http_status: status, duration_ms: Date.now() - started, finished_at: new Date().toISOString() })
      const log = { event: "publishing_checkout", request_id: id, attempt_id: observation.attemptId,
        order_id: observation.orderId, stage: observation.stage, outcome, http_status: status,
        duration_ms: Date.now() - started, environment, test_mode: process.env.LEMONSQUEEZY_TEST_MODE !== "false",
        is_probe: probe, persistence_failed: persistenceFailed }
      if (status >= 500 || persistenceFailed) console.error(JSON.stringify(log))
      else console.info(JSON.stringify(log))
    },
  }
  async function write(terminal: Record<string, unknown> = {}) {
    const data = { stage: observation.stage, attempt_id: observation.attemptId, order_id: observation.orderId,
      persistence_failed: persistenceFailed, ...terminal }
    try {
      const client = db().from("publishing_checkout_attempts")
      const query = stored ? client.update(data).eq("id", id) : client.insert({ id, environment,
        test_mode: process.env.LEMONSQUEEZY_TEST_MODE !== "false", is_probe: probe, ...data })
      const { error } = await query.abortSignal(AbortSignal.timeout(2000))
      if (error) throw new Error("Observation write failed")
      stored = true
    } catch {
      // Logging failure must not turn a valid checkout into a duplicate or failed order.
      persistenceFailed = true
      console.error(JSON.stringify({ event: "publishing_checkout_observation_failed", request_id: id, stage: observation.stage }))
    }
  }
  return observation
}

export async function checkoutMonitor() {
  const { data, error } = await db().rpc("publishing_checkout_monitor").abortSignal(AbortSignal.timeout(5000))
  if (error || !data) throw new Error("Checkout monitoring unavailable")
  return data as { alert: boolean; unreviewedFailures: number; stalled: number; recentRejected: number;
    last24Hours: { received: number; ready: number; failed: number; rejected: number }; exceptions: unknown[] }
}
