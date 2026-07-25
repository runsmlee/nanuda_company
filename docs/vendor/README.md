# 외부 API 문서 사본

SweetBook "Book Print API"의 공식 AI 에이전트용 문서다. 자가출판 서비스(`/publish`)가
이 API에 연동되어 있다.

| 파일 | 용도 |
|---|---|
| `sweetbook-llms.txt` | 목차. 어느 섹션을 봐야 하는지 먼저 확인 |
| `sweetbook-llms-full.txt` | 전문 (11,755줄). 필요한 섹션만 골라 읽을 것 |

**왜 사본을 두는가**

- 벤더가 AI 에이전트용으로 직접 제공하는 산출물이다 (`/docs/ai-agents/llms-txt`).
- 루트 도메인(`sweetbook.com`, `api.sweetbook.com/`)은 자동 조회 시 403을 반환한 적이 있다.
  네트워크 접근에 의존하지 않고 오프라인에서 확인할 수 있어야 한다.
- 스펙 변경 이력을 git diff로 추적할 수 있다.

**갱신**

```bash
curl -sSL https://api.sweetbook.com/docs/llms-full.txt -o docs/vendor/sweetbook-llms-full.txt
curl -sSL https://api.sweetbook.com/docs/llms.txt -o docs/vendor/sweetbook-llms.txt
```

변경분은 `docs/changelog`(벤더 문서 내 "변경이력" 섹션)와 함께 확인한다.
전문을 통째로 읽지 말고 `grep -n '^# '`으로 목차를 잡은 뒤 해당 구간만 읽는 것을 권한다.
