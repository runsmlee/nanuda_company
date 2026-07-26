// Supabase 접근. 서버 전용.
//
// RLS를 전면 차단해 두었으므로 모든 접근은 service role로 서버에서만 이뤄진다.
// 원고는 미공개 저작물이고 주문에는 배송지가 들어 있어 클라이언트에 열지 않는다.

import { randomBytes } from "node:crypto"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export const MANUSCRIPT_BUCKET = "publishing-manuscripts"

let cached: SupabaseClient | null = null

export function db(): SupabaseClient {
  if (cached) return cached
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.")
  }
  cached = createClient(url, key, { auth: { persistSession: false } })
  return cached
}

export interface Project {
  id: string
  author_email: string
  access_token: string
  title: string
  author_name: string
  manuscript_path: string
  manuscript_name: string
  book_spec_uid: string
  text_size: "small" | "normal" | "large"
  chapter_new_page: boolean
  cover_theme: "ivory" | "charcoal" | "photo"
  cover_image_path: string | null
  back_text: string | null
  page_count: number | null
  char_count: number | null
}

export interface Order {
  id: string
  project_id: string
  kind: "digital" | "physical"
  quantity: number
  price_krw: number
  status: "pending" | "paid" | "submitted" | "failed" | "refunded" | "cancelled"
  payment_provider: string | null
  payment_order_id: string | null
  print_order_uid: string | null
  recipient_name: string | null
  recipient_phone: string | null
  postal_code: string | null
  address1: string | null
  address2: string | null
  shipping_memo: string | null
}

/**
 * 원고 파일을 비공개 버킷에 올린다. 경로는 프로젝트별로 격리한다.
 *
 * Storage 키는 ASCII만 받는다. 한글 파일명(대부분의 국내 원고)을 그대로 쓰면
 * `Invalid key`로 거부되므로 확장자만 살리고 키는 무작위로 만든다.
 * 원래 파일명은 DB의 manuscript_name 컬럼에 따로 보관한다.
 */
export async function putManuscript(projectId: string, fileName: string, body: Buffer) {
  const dot = fileName.lastIndexOf(".")
  const rawExt = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : ""
  const ext = /^[a-z0-9]{1,8}$/.test(rawExt) ? `.${rawExt}` : ""
  const path = `${projectId}/${Date.now()}-${randomBytes(6).toString("hex")}${ext}`
  const { error } = await db()
    .storage.from(MANUSCRIPT_BUCKET)
    .upload(path, body, { contentType: "application/octet-stream", upsert: false })
  if (error) throw new Error(`원고 저장 실패: ${error.message}`)
  return path
}

export async function getManuscript(path: string): Promise<Buffer> {
  const { data, error } = await db().storage.from(MANUSCRIPT_BUCKET).download(path)
  if (error || !data) throw new Error(`원고를 불러오지 못했습니다: ${error?.message ?? "not found"}`)
  return Buffer.from(await data.arrayBuffer())
}
