// 원고·표지 보존 기한 처리 (/privacy 2. 보유 기간).
//
// 어떤 파일을 지울지는 DB 함수가 주문 상태로 판정하고 프로젝트를 먼저 잠근다.
// 여기서는 그 목록의 스토리지 객체를 지우고 경로를 비운다. 삭제가 실패하면
// 경로가 남아 다음 실행에서 다시 시도된다.

import { db, MANUSCRIPT_BUCKET } from "./db"

export async function purgeExpiredFiles(limit = 20): Promise<number> {
  const { data, error } = await db().rpc("publishing_claim_file_purge", { p_limit: limit })
  if (error) throw new Error(`File purge claim failed: ${error.message}`)
  const due = (data ?? []) as { id: string; manuscript_path: string | null; cover_image_path: string | null }[]
  for (const project of due) {
    const paths = [project.manuscript_path, project.cover_image_path].filter((p): p is string => !!p)
    const { error: removeError } = await db().storage.from(MANUSCRIPT_BUCKET).remove(paths)
    if (removeError) throw new Error(`File purge failed: ${removeError.message}`)
    const { error: clearError } = await db().from("publishing_projects")
      .update({ manuscript_path: null, cover_image_path: null }).eq("id", project.id).not("files_purged_at", "is", null)
    if (clearError) throw new Error(`File purge recording failed: ${clearError.message}`)
  }
  return due.length
}
