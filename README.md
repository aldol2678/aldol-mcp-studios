# ALDOL MCP Studios

ALDOL 게임·크리에이터 도구들의 공개 MCP 서버 모음입니다. 각 폴더가 하나의
Cloudflare Worker + MCP 서버이며, 전부 읽기 전용 초안 도구입니다.
영상·음악·이미지를 직접 만들지 않고 계획 문서(JSON)를 만듭니다.

라이선스: MIT (각 폴더의 원본 저작권 표기는 해당 폴더 README 참조)

## MCP 목록

| 폴더 | 이름 | 라이브 MCP 주소 | 버전 | 도구 수 |
|---|---|---|---|---|
| `bichum/` | 비춤 — 게임 트레일러 계획 스튜디오 | https://bichum.aldol.app/mcp | 1.7.0 | 12 |
| `pyeol/` | 펼 — IP 원장·트레일러 브리프 | https://pyeol.aldol.app/mcp | 1.1.0 | 2 |
| `padong/` | 파동 — 마케팅 브리프·카피 | https://padong.aldol.app/mcp | 0.4.0 | 5 |
| `bonsae/` | 본새 — 디자인 분석·스펙 | https://bonsae.aldol.app/mcp | 2.3.0 | 4 |
| `motuk/` | 모툭 — 에셋 팩토리 | https://motuk.aldol.app/mcp | 0.3.0 | 13 |
| `seum/` | 세움 — 코드 분석·변경 | https://seum.aldol.app/mcp | 0.1.0 | 3 |
| `majung/` | 마중 — 시장 조사·기회 평가 | https://majung.aldol.app/mcp | 0.1.0 | 3 |

> 현재는 `bichum/`·`pyeol/`·`padong/`·`motuk/` 4곳이 공개되어 있습니다.
> 본새·세움·마중은 검토·분리 작업이 끝나면 같은 구조로 추가합니다.
> (이 문장은 폴더가 추가될 때마다 업데이트합니다.)

## 출처 안내

- `bichum/` — 로컬 원본 소스 그대로입니다.
- `pyeol/` — Cloudflare API로 회수한 라이브 워커 소스 그대로입니다.
  단, `studio-tools.mjs`는 비춤과 공유하는 파일의 오래된 스냅샷이라
  비춤 도구 2개 정의가 함께 들어 있습니다 (펼 MCP로는 펼 도구 2개만 노출됩니다).
- `padong/` — Cloudflare API로 회수한 배포 번들(미니파이 단일 파일) 그대로입니다.
  원본 모듈 구조는 남아 있지 않고, 동작은 로컬 테스트로 검증했습니다.
  원본 소스가 확보되면 읽기 좋은 모듈 형태로 교체합니다.
- `motuk/` — MCP 부분만 분리한 스탠드얼론 워커입니다. 라이브 워커는
  Next.js(OpenNext) 빌드 번들이라 읽기 좋은 소스로 공개할 수 없어,
  로컬 통합 소스(11/18 P0)의 MCP 핸들러를 가져오고 동작 동등성을
  라이브와 대조해 확인했습니다. 웹 UI는 포함하지 않았습니다.

## 구조

각 폴더는 독립 배포 단위입니다.

```
bichum/
  README.md        # 도구 목록·라이브 주소·curl 예시·배포법
  wrangler.toml    # 비밀 바인딩 없음
  *.mjs            # Worker 소스
  tests/           # node --check + Worker fetch 통합 테스트
```

## 배포하기

```bash
cd bichum
npx wrangler deploy
```

## 공개하지 않는 것

이 저장소에는 어떤 비밀도 들어 있지 않습니다. 세움·마중의 OAuth 게이트웨이
(`BACKEND_BEARER`, `ACCESS_OWNER_EMAIL`, `OAUTH_KV`)와 Cloudflare Access 설정은
운영 전용이라 공개본에 포함하지 않습니다. 공개본의 `wrangler.toml`에는
플레이스홀더만 둡니다.
