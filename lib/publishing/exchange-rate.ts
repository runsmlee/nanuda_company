const ECB_RATES = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"

/** ECB reference rates are per EUR. Freeze the cross rate on each checkout. */
export function parseKrwUsdRate(xml: string, now = Date.now()) {
  const date = xml.match(/<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]/u)?.[1]
  const rate = (currency: string) => Number(xml.match(new RegExp(`<Cube\\s+currency=['"]${currency}['"]\\s+rate=['"]([0-9.]+)['"]`, "u"))?.[1])
  const krwPerUsd = rate("KRW") / rate("USD")
  const age = now - Date.parse(`${date}T00:00:00Z`)
  if (!date || !Number.isFinite(age) || age < -86_400_000 || age > 7 * 86_400_000
    || !Number.isFinite(krwPerUsd) || krwPerUsd < 100 || krwPerUsd > 10_000) {
    throw new Error("Invalid or stale exchange rate")
  }
  return { krwPerUsd, date }
}

export async function getKrwUsdRate() {
  const response = await fetch(ECB_RATES, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error("Exchange rate unavailable")
  return parseKrwUsdRate(await response.text())
}
