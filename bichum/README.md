# 비춤 (Bichum) — 게임 트레일러 계획 스튜디오

게임 트레일러를 만들기 전에 **계획만** 만드는 Cloudflare Worker + MCP 서버입니다.
영상·음악·이미지를 만들지 않고, 컷 구성표·자막·훅·체크리스트·편집 매니페스트 같은
계획 문서를 JSON으로 만듭니다. 읽기 전용 초안 도구입니다.

- 라이브: https://bichum.aldol.app
- MCP 주소: https://bichum.aldol.app/mcp
- 서버 버전: **1.7.0** (12개 도구)
- 라이선스: MIT

## 도구 (v1.7.0)

| 도구 | 하는 일 |
|---|---|
| `bichum_plan_trailer_shots` | 게임 정보로 타임코드가 있는 컷 구성표 생성 |
| `bichum_build_srt` | 시작·종료 시각(밀리초)과 문구로 UTF-8 SRT 자막 생성 |
| `bichum_draft_hook` | 첫 3초 훅 초안 1~5개 생성 |
| `bichum_build_capture_checklist` | 컷 구성표 또는 게임 정보로 촬영용 체크리스트 생성 |
| `bichum_export_edit_manifest` | 컷 구성표로 편집 매니페스트(EDL·OTIO·유튜브 챕터) 생성 |
| `bichum_build_asset_ledger` | 자산별 출처·라이선스·만료일을 정리한 권리 장부 초안 생성 (권리 확인은 아님) |
| `bichum_check_safe_zones` | 플랫폼별 가림 영역에 대한 제목·자막·HUD·CTA 배치 검수 |
| `bichum_score_hooks` | 훅 초안을 규칙으로 채점하고 순위 매김 (실제 반응은 아님) |
| `bichum_draft_narration` | 컷 구성표 기반 내레이션 대본 초안 생성 |
| `bichum_plan_word_captions` | 단어 자막 계획 생성 |
| `bichum_plan_audio` | BPM으로 비트 그리드를 만들고 컷을 비트에 맞춤 (음악은 만들지 않음) |
| `bichum_plan_publish` | 썸네일 후보 시간과 플랫폼별 제목·설명을 묶은 발행 팩 생성 (업로드는 하지 않음) |

## MCP로 써 보기

```bash
# 1. 서버 정보 확인
curl -s -X POST https://bichum.aldol.app/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'

# 2. SRT 자막 만들기
curl -s -X POST https://bichum.aldol.app/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"bichum_build_srt","arguments":{"cues":[{"start_ms":0,"end_ms":3000,"text":"밤이 깊어질수록, 도시는 깨어난다"}]}}}'
```

## 직접 배포하기

```bash
cd bichum
npx wrangler deploy
```

`wrangler.toml`에 비밀 바인딩이 없습니다. 커스텀 도메인은 Cloudflare 대시보드에서
연결하거나 `wrangler.toml`의 `routes`에 추가하세요.

> 주의: `wrangler.toml`의 name은 라이브 워커 이름과 겹치지 않게 `bichum-mcp`로
> 정해 두었습니다. name을 라이브 워커 이름(`aldol-bichum-official-site`)으로 바꾸어
> 배포하면 라이브 사이트를 덮어쓰니 바꾸지 마세요.

## 테스트

```bash
cd bichum
node tests/test-bichum.mjs   # 초기화·도구 목록(12개)·실호출 5건
node tests/test-audio.mjs    # 오디오·비트 그리드 14건
node tests/test-publish.mjs  # 썸네일·발행 팩 14건
```

## 파일

- `bichum.mjs` — Worker 진입점 (웹 UI + `/mcp` 라우팅)
- `mcp.mjs` — JSON-RPC 핸들러
- `studio-tools.mjs` — 도구 정의·검증 (펼과 공유하는 `studio-tools` 패턴의 비춤 부분)
- `safe-zones.mjs`, `safe-zone-check.mjs` — 플랫폼별 세이프존 데이터·검수
- `score-hooks.mjs` — 훅 채점 규칙
- `narration.mjs`, `word-captions.mjs` — 내레이션·단어 자막
- `edit-manifest.mjs` — 편집 매니페스트(EDL·OTIO·챕터)
- `asset-ledger.mjs`, `game-glossary.mjs` — 권리 장부·게임 용어 사전
- `audio.mjs` — BGM 브리프·비트 그리드
- `publish.mjs` — 썸네일 후보·발행 팩
