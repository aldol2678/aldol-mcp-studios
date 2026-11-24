# 펼 (Pyeol) — 게임 IP 스튜디오

게임의 세계관·캐릭터·스토리와 에셋 출처를 IP 원장용 JSON 초안으로 정리하는
Cloudflare Worker + MCP 서버입니다. 원격 원장에는 쓰지 않고, 초안 문서만 만듭니다.
읽기 전용 초안 도구입니다.

- 라이브: https://pyeol.aldol.app
- MCP 주소: https://pyeol.aldol.app/mcp
- 서버 버전: **1.1.0** (2개 도구)
- 라이선스: MIT

## 도구 (v1.1.0)

| 도구 | 하는 일 |
|---|---|
| `pyeol_draft_ip_record` | 세계관·캐릭터·스토리와 에셋 출처를 IP 원장용 JSON 초안으로 정리합니다. 원격 원장에는 쓰지 않습니다. |
| `pyeol_draft_trailer_brief` | 게임 제목·화면비·길이·핵심 메시지로 비춤에 전달할 트레일러 브리프 JSON을 만듭니다. |

## MCP로 써 보기

```bash
# 1. 서버 정보 확인
curl -s -X POST https://pyeol.aldol.app/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'

# 2. IP 원장 초안 만들기
curl -s -X POST https://pyeol.aldol.app/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"pyeol_draft_ip_record","arguments":{"game_title":"다시, 놀이터","world":"잊힌 놀이터가 깨어나는 마을","story":"아이들이 떠난 놀이터에 다시 불이 켜진다","characters":["도깨비","아이"]}}}'

# 3. 트레일러 브리프 만들기 (title 필수)
curl -s -X POST https://pyeol.aldol.app/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"pyeol_draft_trailer_brief","arguments":{"game_title":"다시, 놀이터","title":"어른들의 놀이터","format":"16:9","duration_seconds":30,"key_message":"잊힌 놀이터를 되살리는 이야기"}}}'
```

주의: `pyeol_draft_trailer_brief`는 `title`이 없으면
"title 항목을 입력해 주세요." 오류를 돌려줍니다.

## 직접 배포하기

```bash
cd pyeol
npx wrangler deploy
```

`wrangler.toml`에 비밀 바인딩이 없습니다. 커스텀 도메인은 Cloudflare 대시보드에서
연결하거나 `wrangler.toml`의 `routes`에 추가하세요.

## 테스트

```bash
cd pyeol
node tests/test-pyeol.mjs   # 초기화·도구 목록(2개)·실호출 3건
```

## 파일

- `pyeol.mjs` — Worker 진입점 (웹 UI + `/mcp` 라우팅, HTML·CSS·JS·이미지 내장)
- `mcp.mjs` — JSON-RPC 핸들러 (비춤과 같은 코드, 버전만 `1.1.0`)
- `studio-tools.mjs` — 도구 정의·검증. `pyeol` 도구 2개와, 펼의 제작 도구 페이지가
  함께 쓰는 `bichum` 도구 2개(`bichum_plan_trailer_shots`, `bichum_build_srt`)가
  들어 있습니다. 펼의 MCP로는 `pyeol` 도구 2개만 노출됩니다.

## 회수 출처

이 폴더의 소스는 2026-11-24에 라이브 Worker(`aldol-pyeol-official-site`)에서
Cloudflare API로 회수한 것입니다. 로컬 원본 디렉토리는 없었습니다.
