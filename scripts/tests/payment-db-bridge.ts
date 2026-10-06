// Test-only PostgREST bridge into an isolated local PostgreSQL database. Never accepts a remote DB URL.
import { execFileSync } from "node:child_process"
import { createServer } from "node:http"

export const quote = (value: unknown): string => value === null ? "null" : `'${String(typeof value === "object" ? JSON.stringify(value) : value).replaceAll("'", "''")}'`
const identifier = (value: string) => {
  if (!/^[a-z_][a-z_0-9]*$/.test(value)) throw new Error("Unsafe test identifier")
  return `"${value}"`
}
export function sql(query: string): string {
  return execFileSync("psql", ["-h", "127.0.0.1", "-p", "55439", "-U", "postgres", "-d", "nanuda_payment_test", "-At", "-v", "ON_ERROR_STOP=1", "-c", query], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
}
export function rows(query: string): Record<string, unknown>[] {
  return JSON.parse(sql(`select coalesce(json_agg(t), '[]'::json) from (${query}) t`))
}
function filter(key: string, value: string): string {
  if (key === "or") return `(${value.slice(1,-1).split(",").map((f) => { const dot = f.indexOf("."); return filter(f.slice(0,dot), f.slice(dot+1)) }).join(" or ")})`
  const col = identifier(key)
  if (value === "not.is.null") return `${col} is not null`
  if (value === "is.null") return `${col} is null`
  if (value.startsWith("in.")) return `${col} in (${value.slice(4,-1).split(",").map(quote).join(",")})`
  const dot = value.indexOf(".")
  const op = ({ eq: "=", lt: "<", gt: ">" } as Record<string,string>)[value.slice(0,dot)]
  if (!op) throw new Error("Unsupported test filter")
  return `${col} ${op} ${quote(value.slice(dot+1))}`
}
export async function startBridge() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, "http://127.0.0.1")
      let raw = ""
      for await (const chunk of req) raw += chunk.toString()
      res.setHeader("Content-Type", "application/json")
      res.setHeader("Connection", "close")
      if (url.pathname.startsWith("/storage/v1/object/")) {
        res.end(JSON.stringify({ Key: "test-object" })); return
      }
      const body = raw ? JSON.parse(raw) : {}
      const name = url.pathname.split("/").at(-1)!
      let result: unknown
      if (url.pathname.includes("/rpc/")) {
        const args = Object.entries(body).map(([k,v]) => `${identifier(k)} => ${quote(v)}`).join(",")
        const call = `public.${identifier(name)}(${args})`
        result = name === "publishing_claim_work" || name === "publishing_attach_print"
          ? rows(`select * from ${call}`) : JSON.parse(sql(`select to_json(${call})`))
      } else {
        const table = `public.${identifier(name)}`
        const where = [...url.searchParams].filter(([k]) => !["select", "limit", "order"].includes(k)).map(([k,v]) => filter(k,v))
        const clause = where.length ? ` where ${where.join(" and ")}` : ""
        if (req.method === "PATCH") {
          const update = Object.entries(body).map(([k,v]) => `${identifier(k)} = ${quote(v)}`).join(",")
          result = JSON.parse(sql(`with t as (update ${table} set ${update}${clause} returning *) select coalesce(json_agg(t),'[]'::json) from t`))
        } else if (req.method === "POST") {
          const values = Object.entries(body)
          result = JSON.parse(sql(`with t as (insert into ${table}(${values.map(([k]) => identifier(k)).join(",")}) values (${values.map(([,v]) => quote(v)).join(",")}) returning *) select coalesce(json_agg(t),'[]'::json) from t`))
        } else {
          const columns = url.searchParams.get("select") ?? "*"
          const select = columns === "*" ? "*" : columns.split(",").map(identifier).join(",")
          result = rows(`select ${select} from ${table}${clause}`)
          if (req.headers.prefer?.includes("count=exact")) res.setHeader("Content-Range", `0-${(result as unknown[]).length-1}/${(result as unknown[]).length}`)
        }
        if (req.headers.accept?.includes("vnd.pgrst.object")) {
          if ((result as unknown[]).length !== 1) {
            res.statusCode = 406; res.end(JSON.stringify({ code: "PGRST116", details: "The result contains 0 rows", message: "No rows" })); return
          }
          result = (result as unknown[])[0]
        }
      }
      res.end(JSON.stringify(result))
    } catch (e) {
      const message = e instanceof Error ? e.message : "SQL failure"
      res.statusCode = 400
      res.end(JSON.stringify({ code: message.includes("duplicate key") ? "23505" : "P0001", message }))
    }
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("No test port")
  return { url: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve) => server.close(() => resolve())) }
}
