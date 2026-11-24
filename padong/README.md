# 파동 (Padong) — 마케팅 브리프·카피 초안 스튜디오

게임 마케팅을 위한 **초안만** 만드는 Cloudflare Worker + MCP 서버입니다.
캠페인 브리프·채널별 홍보문 초안·검토·UTM 생성을 JSON으로 만듭니다.
외부 발송·게시·광고 집행은 하지 않습니다. 읽기 전용 초안 도구입니다.

- 라이브: https://padong.aldol.app
- MCP 주소: https://padong.aldol.app/mcp
- 서버 버전: **0.4.0** (5개 도구)
- 라이선스: MIT

## 도구 (v0.4.0)

| 도구 | 하는 일 |
|---|---|
| `marketing_project_profile` | 사용자가 제공한 프로젝트 기본 정보를 정리합니다. |
| `marketing_create_brief` | 프로젝트, 목표, 대상, 채널을 바탕으로 캠페인 브리프와 KPI 초안을 만듭니다. |
| `marketing_generate_copy` | 캠페인 브리프로 채널별 초안을 만듭니다. 확정한 Threads·Discord 문구가 있으면 channel_copy로 전달하세요. |
| `marketing_review_campaign` | 홍보문에서 근거가 필요한 주장과 검토 항목을 표시합니다. |
| `marketing_build_tracking` | HTTPS 주소에 캠페인 추적용 UTM 매개변수를 붙입니다. |

모든 도구는 `execution: remote_draft_only`, `external_actions: none`입니다.
브리프·카피는 `draft` / `draft_needs_review` / `draft_needs_fact_check` 상태의
초안으로 나오며, 사실 확인은 사람이 직접 해야 합니다.
`marketing_review_campaign`의 출력은 `approved_for_publication: false` 고정입니다.

## MCP로 써 보기

```bash
# 1. 서버 정보 확인
curl -s -X POST https://padong.aldol.app/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'

# 2. UTM 추적 링크 만들기
curl -s -X POST https://padong.aldol.app/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"marketing_build_tracking","arguments":{"base_url":"https://example.com/game","source":"threads","medium":"social","campaign":"launch"}}}'
```

UTM 호출 결과:

```json
{"tool":"marketing_build_tracking","version":"0.4.0","execution":"remote_draft_only",
 "external_actions":"none","status":"generated_not_visited",
 "url":"https://example.com/game?utm_source=threads&utm_medium=social&utm_campaign=launch",
 "utm":{"utm_source":"threads","utm_medium":"social","utm_campaign":"launch"},
 "network_requests":0,
 "limitations":["링크 유효성·리디렉션 미검증","캠페인 성과는 연결된 분석 도구에서 별도 검증 필요"]}
```

## 직접 배포하기

```bash
cd padong
npx wrangler deploy
```

`wrangler.toml`에 비밀 바인딩이 없습니다. 커스텀 도메인은 Cloudflare 대시보드에서
연결하거나 `wrangler.toml`의 `routes`에 추가하세요.

> 주의: `wrangler.toml`의 name은 라이브 워커 이름과 겹치지 않게 `padong-mcp`로
> 정해 두었습니다. name을 라이브 워커 이름(`padong-studio`)으로 바꾸어
> 배포하면 라이브 사이트를 덮어쓰니 바꾸지 마세요.

## 테스트

```bash
cd padong
node tests/test-padong.mjs   # 초기화·도구 목록(5개)·실호출 3건
```

## 파일

- `padong.mjs` — Worker 진입점 (웹 UI + `/mcp` 라우팅 + 도구 구현 전체)
- `wrangler.toml` — 배포 설정 (바인딩 없음)

## 출처 안내

이 폴더의 `padong.mjs`는 2026-11-24에 라이브 Worker(`padong-studio`)에서
Cloudflare API로 회수한 **배포 번들 그대로**입니다. wrangler가 여러 모듈을
하나로 묶은 미니파이 단일 파일이라 원본 모듈 구조는 남아 있지 않고,
한글 문자열이 `\uXXXX` 형태로 이스케이프되어 있습니다. 동작은 라이브와
동일하며, 로컬 테스트가 이를 검증합니다. 원본 소스가 확보되면 읽기 좋은
모듈 형태로 교체할 예정입니다.
