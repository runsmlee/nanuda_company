"use client"

import { Analytics } from "@vercel/analytics/next"

/** Order URLs contain bearer access tokens; never send those pageviews to analytics. */
export function PublishingSafeAnalytics() {
  return <Analytics beforeSend={(event) => new URL(event.url).pathname.startsWith("/publish/orders") ? null : event} />
}
