# 모툭 (Motuk) — ALDOL 에셋 팩토리 스튜디오 MCP

게임 에셋용 **절차적 사운드 생성 + 타이틀 스튜디오** MCP 서버입니다.
읽기 전용 초안·생성 도구이며, 파일 업로드·저장·유료 API·AI 음악/보이스 모델을
쓰지 않습니다. 사운드는 프리셋+시드에서 결정적으로 합성하는 모노 WAV이고,
타이틀은 JSON 프로젝트를 만들고 다듬어 내보냅니다.

- 라이브: https://motuk.aldol.app
- MCP 주소: https://motuk.aldol.app/mcp
- 서버 버전: **0.3.0** (13개 도구)
- 라이선스: MIT

## 도구 (v0.3.0)

| 도구 | 하는 일 |
|---|---|
| `capabilities` | 메타데이터 검증 및 스테이트리스 절차적 사운드 기능·한도 조회 |
| `inventory_preview` | 호출자가 준 인벤토리 메타데이터만 검증 (파일 업로드·저장·바이트 검증 없음) |
| `audit_preview` | 호출자가 준 매니페스트 메타데이터 감사 (바이트/화면/엔진/권리 검사는 UNKNOWN) |
| `sound_presets` | 절차적 사운드 프리셋 6종과 호스팅 오디오 한도 목록 (유료 API·AI 음악/보이스 없음) |
| `sound_generate` | 프리셋+시드로 결정적 모노 WAV 생성 (게인·정규화·트림·페이드 옵션, 오디오 + 다운로드 URL 반환, 브라우저 에셋 변경 없음) |
| `sound_variations` | 시드/톤 변형 1~4개를 비교 (측정값·레시피 전체·SHA-256·WAV 다운로드 URL 반환, 오디오 블롭 없음) |
| `sound_export_pack` | 사운드 레시피 1~6개로 다운로드용 ZIP 반환 (assets/game/aldx 형식, 인라인 128 KiB 상한, 저장 없음) |
| `sound_bgm_presets` | 결정적 오프라인 BGM 무드/악기 목록과 한도 |
| `sound_bgm_generate` | bounded 절차적 레시피로 반복 가능한 PCM16 WAV BGM 생성 (검증된 동일 사이트 WAV 경로 사용, 가짜 URL 반환 없음) |
| `title_create` | 편집 가능한 MOTUK Title Studio v1 JSON 프로젝트 생성 (저장 없음) |
| `title_preview` | 타이틀 프로젝트의 결정적 스키매틱 SVG 미리보기 반환 (브라우저 스크린샷·전체 에셋 렌더링 아님) |
| `title_update` | 타이틀 프로젝트 JSON에 검증된 비영속 변경을 적용해 반환 |
| `title_export` | 타이틀 프로젝트를 JSON·자체 완결 HTML·SVG·ZIP으로 내보내기 (인라인 최대 128 KiB, 저장·외부 업로드 없음) |

## MCP로 써 보기

```bash
# 1. 서버 정보 확인
curl -s -X POST https://motuk.aldol.app/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'

# 2. 기능·한도 조회
curl -s -X POST https://motuk.aldol.app/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"capabilities","arguments":{}}}'

# 3. 사운드 프리셋 목록
curl -s -X POST https://motuk.aldol.app/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"sound_presets","arguments":{}}}'
```

## 직접 배포하기

이 폴더는 라이브 워커의 **MCP 부분만** 분리한 스탠드얼론 워커입니다.
웹 UI(타이틀 스튜디오·사운드 스튜디오 화면)는 Next.js 앱에 있고 이 폴더에는
들어 있지 않습니다.

```bash
cd motuk
npx wrangler deploy
```

`wrangler.toml`에 비밀 바인딩이 없습니다. 커스텀 도메인은 Cloudflare 대시보드에서
연결하거나 `wrangler.toml`의 `routes`에 추가하세요.

> 주의: `wrangler.toml`의 name은 라이브 워커 이름과 겹치지 않게 `motuk-mcp`로
> 정해 두었습니다. name을 라이브 워커 이름(`motuk`)으로 바꾸어 배포하면
> 라이브 사이트(Next.js 앱 전체)를 덮어쓰니 바꾸지 마세요.

## 테스트

```bash
cd motuk
node tests/test-motuk.mjs   # 초기화·도구 목록(13개)·실호출 5건
```

## 파일

- `motuk.mjs` — 스탠드얼론 Worker 진입점 (`/mcp`만 라우팅, 웹 UI 없음).
  Next.js 앱에서는 `app/mcp/route.ts`가 같은 핸들러를 연결합니다.
- `lib/asset-mcp.js` — MCP 핸들러 (`handleMcp`, 도구 목록·검증·라우팅)
- `lib/sound-mcp.js` — 사운드 도구 (`sound_presets`·`sound_generate`·`sound_variations`·`sound_export_pack`)
- `lib/bgm-engine.mjs` — BGM 절차적 합성 엔진
- `lib/bgm-mcp-adapter.mjs` — BGM 도구 정의
- `lib/sound-bgm-host.mjs` — BGM 호스트 (속도 제한·WAV 응답)
- `lib/sound-access.mjs` — 공개 사이트 플래그 (`SOUND_SITE_PUBLIC=true`)
- `lib/sound-aldx-export.mjs` — ALDX 형식 내보내기
- `lib/sound-inline-delivery.mjs` — 인라인(128 KiB) 전달
- `lib/title-studio-mcp.mjs` — 타이틀 스튜디오 도구 4종
- `lib/title-export-templates.mjs` — 타이틀 내보내기 템플릿
- `lib/asset-byte-mcp-p1.mjs` — 바이트 파이프라인 도구 (공개 사이트에서는 비활성)
- `public/sound-assets/core.js` — 절차적 사운드 코어 엔진
- `public/sound-assets/game-export.js` — 게임 형식 내보내기
- `public/sound-assets/editor.js` — 사운드 에디터 (side-effect import)
- `public/sound-assets/runtime-source.js` — 런타임 소스 (side-effect import)
- `public/assets/byte-pipeline.mjs` — 바이트 파이프라인
- `public/assets/asset-core.js` — 에셋 코어 (side-effect import)

## 출처·버전 주의

- 이 소스는 로컬 MOTUK Title Studio MCP P0 통합본
  (`motuk-title-mcp-p0-20261118/integrated/`)에서 가져왔습니다.
- 라이브 동작과 동일함을 직접 확인했습니다: 로컬 핸들러를 HTTP 하네스로
  띄워 initialize·tools/list(13개, 이름·설명·스키마 전부 일치)·
  capabilities(JSON 바이트 동일)를 라이브와 대조했습니다.
- 라이브 워커 자체는 Next.js(OpenNext) 빌드 번들(940 KB, 50개 파트)이라
  읽을 수 있는 소스 형태로 분리할 수 없습니다. 번들 원본은 회수해
  `/tmp/motuk-live.bin`에 보관했으니, 필요하면 대조용으로 쓸 수 있습니다.
  라이브 워커의 배포 커밋은 `e119f16b` ("MOTUK Texture Clean e119f16")입니다.
