# 도판(DOPAN) MCP v0.1 — 설계 문서

작성: 2026-11-25. 상태: **설계 초안. 구현·배포·도판 코드 변경 없음.**

이 문서는 설계와 스키마 초안만 담는다. 이 작업에서 만든 파일은 이 문서 1개와 검증용으로 받은 읽기 전용 사본(`hidden_files/`의 world.json 3개·`engine-validation.mjs`)뿐이고, 도판 사이트·레포·기존 파일은 고치지 않았다. 운영 호출은 라이브 파일 읽기(curl GET)만 했고, 쓰기·배포·로그인은 하지 않았다.

표기: **[확인]** = 파일에서 직접 읽음. **[추론]** = 코드에서 추론, 실측 안 함. **[제안]** = 승인 전에는 하지 않는 변경.

---

## 0. 한눈에 보기

| 항목 | 결론 |
|---|---|
| 목적 | AI 협업자(모아·아크 등)가 도판 2D 맵 편집기를 클릭 대신 도구 호출로 다루게 한다. "수풀리에 나무 10그루 심어줘" 같은 요청을 `place_object` 호출로 수행 |
| 전송 v0.1 | **로컬 stdio MCP (D안)**. MCP Forge 패턴. 도판에 백엔드가 없어 원격 Worker는 v0.2로 미룬다 |
| 다루는 것 | **월드 매니페스트 파일**(WorldForge `worldforge/0.1`). 로컬 작업 사본만 읽고 쓴다 |
| 도구 | 8개. 읽기 3개 + 쓰기 3개 + 검증 1개 + 내보내기 1개. 에디터가 하는 일만 그대로 옮긴다 |
| 검증 재사용 | 에디터의 `validateWorldManifest` + `checkBase`를 **그대로 가져다 쓴다(복사해서 포크하지 않음)**. 검증 규칙이 두 갈래로 갈라지는 것을 막는다 |
| 쓰기 원칙 | 정본 파일은 **덮어쓰지 않는다**. 편집 결과는 `*.edited.json`으로만 내보낸다. 발행(배포)은 별도 단계 |
| 가장 큰 리스크 | 월드 정본이 어디인지(어느 레포·어느 브랜치)가 아직 확인되지 않았다. MCP가 잘못된 사본을 고치면 라이브와 어긋난다. §8 미결정 2번 |
| 일정 | 설계는 지금, 구현은 **11/29 이후 + 알돌 승인**. 단어연금술 제출(11/27)·마감(11/29 08:00 KST) 기간에는 도판·MCP 모두 건드리지 않는다 |

---

## 1. 현재 상태 (읽은 것 기준)

### 1.1 도판이 무엇인가

| 구성 | 값 | 출처 |
|---|---|---|
| 사이트 | `https://dopan.aldol.app` (2D `/map`, 3D `/`) | 2026-11-25 라이브 확인 [확인] |
| 공지 | 2026-11-25 10:34 #aram-전체, "새 맵 에디터 '도판(DOPAN)'을 출시했어요!" | Slack 검색 [확인] |
| 호스팅 | Cloudflare Pages 정적 사이트로 보임 (`cf-nel` 헤더, `alt-svc: h3`) | curl 응답 헤더 [추론] |
| 백엔드 | **없음**. `/api/export`도 SPA 폴백 HTML(8,601B)이 돌아온다 | curl [확인] |
| 저장 | 브라우저 기기 저장(PWA, "LOCAL PWA", "기기 내부 저장 · 오프라인 가능") | 라이브 화면 [확인] |
| 소스 레포 | **미확인**. 공개 GitHub `dopan` 검색에 해당 없음 | GitHub 검색 [확인] |

### 1.2 월드 파일 (실제 3개 전부 받음)

| 월드 | game slug | world.id | entities | zones | paths | 크기 |
|---|---|---|---|---|---|---|
| 수풀리 마을 | `supuli` | `supuli-village` | 29 | 4 | 18 | 19,716B |
| 별낚시 호수 | `star-fishing` | `star-fishing-lake` | 13 | 2 | 10 | 20,985B |
| 별수호 들판 | `star-defense` | `star-defense-field` | 6 | 1 | 6 | 12,803B |

공통 최상위 키 12개: `schemaVersion, project, world, assets, zones, places, paths, entities, npcs, quests, events, rules` [확인]. `schemaVersion`은 전부 `"worldforge/0.1"` [확인]. `project.id`는 `"aldol-engine"`, 수풀리 `template`은 `"supuli-m1"` [확인] — 월드의 상류는 알돌엔진(WorldForge)이다.

### 1.3 에디터가 실제로 하는 일 (map.mjs 전문 기준)

| 동작 | 에디터 구현 | MCP 대응 |
|---|---|---|
| 월드 열기 | `fetch('/preview/games/<slug>/world.json')`, 실패 시 상태 문구 | `dopan_get_world` |
| 월드 파일 열기 | `<input type=file>` JSON 파싱 | MCP는 로컬 파일 경로로 받는다 (§3.2) |
| 편집 대상 | `availableTemplates(world)` = `type`이 집·나무·갈대·허수아비(`entity.house/tree/reed/scarecrow`)이고 `parentId`가 없는 엔티티만 | 쓰기 도구 3개 전부 이 범위만 |
| 배치 | 팔레트 원형을 복제, 새 id는 `'studio.' + crypto.randomUUID()`, 좌표는 소수 1자리로 반올림 | `dopan_place_object` |
| 이동 | 선택 엔티티의 `transform.position`을 `[x, 기존 y, z]`로 교체 | `dopan_move_object` |
| 삭제 | 참조 검사(`references()`) — 다른 항목이 참조하면 거부 | `dopan_delete_object` |
| 저장 | `world.edited.json` 다운로드, 정본 덮어쓰기 없음 | `dopan_export_world` |
| 플레이 | iframe `/preview/games/<slug>/index.html` + `frame.worldSnapshot`에 편집 중 월드 주입 | `dopan_play_url`은 URL만 반환 (§5.4 한계 참조) |
| 검증 | `checkBase()` → `validateWorldManifest()` | `dopan_validate_world` |

### 1.4 읽다가 발견한 사실 5가지

| # | 사실 | 근거 | 영향 |
|---|---|---|---|
| F1 | 월드 JSON은 `/preview/games/<slug>/world.json`으로 받아야 한다. `<world.id>`(`supuli-village`)로 받으면 SPA 폴백 HTML(8,601B)이 온다 | curl [확인] | MCP의 월드 식별자는 **game slug**(`supuli`)를 쓰고, `world.id`와 혼동하지 않는다. `list_worlds`가 둘을 함께 반환한다 |
| F2 | 브라우저에서는 서비스워커(`/sw.js`, `CACHE="aldol-studio-pwa-v1-…"`)가 world.json 등을 미리 받아둬서 된다. curl만 보면 "JSON이 없다"고 오판한다 | `/sw.js` [확인] | 라이브 상태 판정은 curl이 아니라 브라우저로 한다. 2026-11-25 검증이 이걸로 수풀리 로드를 확인했다 |
| F3 | 맵 편집기가 고치는 것은 장식(decor)뿐이다. 수풀리 29개 중 편집 대상은 13개(집 5·나무 7·허수아비 1). 작물·약초·파편·NPC는 팔레트에 안 뜬다 | `map.mjs` + world.json 대조 [확인] | v0.1 쓰기 범위도 장식 4종으로 한정한다. NPC·퀘스트·경로는 v0.2 이후, 별도 설계 |
| F4 | 플레이는 URL이 아니라 **인메모리 스냅샷**이다. iframe에 `worldSnapshot`을 직접 넣어 연다 | `map.mjs` [확인] | MCP가 편집한 월드는 URL만으로 플레이할 수 없다. §5.4의 제안을 보라 |
| F5 | `world` 블록 형식이 월드마다 다르다. 수풀리에는 `units/handedness/upAxis`가 있고, 별낚시·별수호에는 `description/version`만 있다 | world.json 3개 [확인] | `checkBase`의 기본값(`meter`·`Y`·`right`) 덕에 둘 다 통과한다. MCP는 누락 필드를 채우지 않고 원본 그대로 둔다 |

### 1.5 검증 로직 (engine-validation.mjs 전문 기준)

MIT, Copyright (c) 2026 CHOI JISEOK, upstream `df9a4946…` [확인]. MCP는 이 파일을 **가져다 쓰되, 규칙을 베껴서 새로 만들지 않는다** (§3.3).

| 검사 | 규칙 (요약) |
|---|---|
| 스키마 | `schemaVersion === "worldforge/0.1"` 아니면 `E_SCHEMA_VERSION` |
| 필수 키 | 최상위 12개 키 전부 있어야 함. 없으면 `E_MISSING` |
| 배열·ID | 9개 목록은 배열이어야 하고, 각 항목 id는 `E_ID` 정규식 + 목록 내 중복이면 `E_DUPLICATE_ID` |
| 에셋 | `uri`는 `builtin:` 또는 `glb:` 형태. `glb:`는 `.glb`로 끝나고 `..`·절대경로 금지 (`E_ASSET_URI_UNSAFE`) |
| 참조 | 장소→구역, 경로→장소, 엔티티→부모·에셋, NPC→엔티티·거주지·`profile.role`·빈약하지 않은 `schedule`, 퀘스트 간선→노드. 어기면 `E_*_NOT_FOUND` 계열 |
| `checkBase` 추가 검사 | `world.units`는 `meter`, `upAxis`는 `Y`, `handedness`는 `right` (없으면 기본값으로 간주) |

`warnings`는 항상 빈 배열이다 [확인]. MCP는 `valid` + `errors[]`(`code`·`path`·`detail`)를 그대로 돌려준다.

---

## 2. 설계 원칙 (GameOps MCP v0.1과 같은 자세)

1. **기존 것을 고치지 않는다.** 도판 사이트·에디터 코드·배포 월드는 v0.1에서 손대지 않는다. MCP는 옆에 붙는 새 서버다.
2. **에디터와 같은 규칙.** 검증·ID 생성·참조 검사는 에디터 코드를 재사용한다. MCP만의 두 번째 규칙을 만들지 않는다.
3. **쓰기는 파일에만, 정본은 안 건드린다.** 모든 쓰기는 작업 사본 → 검증 → `*.edited.json` 내보내기 순이다. 라이브 배포는 이 MCP의 일이 아니다.
4. **도구는 적게, 거절은 분명하게.** v0.1은 8개. 할 수 없는 것(3D 스튜디오, NPC·퀘스트 편집, 발행)은 도구로 만들지 않고 §8에 적는다.
5. **설계는 지금, 구현은 11/29 이후.** 단어연금술 챌린지 기간에는 구현·배포하지 않는다 (§7).

---

## 3. 전송·저장소·재사용

### 3.1 전송: 로컬 stdio (D안) — 채택

| 안 | 결론 | 이유 |
|---|---|---|
| A. 도판 Pages Functions에 `/mcp` 추가 | 기각 | 도판은 정적 배포이고 Functions가 없다. MCP를 위해 배포 구조를 바꾸는 것은 "기존 것 무변경" 원칙에 어긋난다. `/api/export`도 현재 폴백 HTML이다 [확인] |
| B. 신규 원격 Worker (`dopan-mcp`) | v0.2로 보류 | 모툭·GameOps 패턴과 같아 보이지만, 원격 쓰기에는 저장소(D1/R2/GitHub 중 하나 + 발행 파이프라인)가 먼저 필요하다. 저장소 결정이 안 된 상태에서 Worker부터 만들면 빈 껍데기가 된다 |
| C. 도판 안에 MCP 클라이언트 내장(브라우저) | 기각 | MCP는 서버 규격이다. 브라우저 안에 넣으면 클라이언트마다 따로 구현해야 하고, 지금 도판 코드에 그런 계층이 없다 |
| **D. 로컬 stdio MCP (MCP Forge 패턴)** | **채택** | 월드가 파일이라 파일 MCP가 가장 직접적이다. Forge에 공식 MCP SDK(`mcp==2.0.0`) + stdio 클라이언트 패턴이 이미 검증돼 있다(2026-11-13). 배포·인증·저장소가 필요 없어 지금 만들 수 있다. 단, 쓰는 쪽이 자기 기기에 설치해야 한다 |

v0.1의 사용자는 **모아(VM)** 가 1순위다. 아크는 ChatGPT 경유라 stdio를 직접 못 쓰므로, 아크가 쓸 원격 경로는 v0.2 미결정 1번으로 남긴다.

### 3.2 저장소: 로컬 월드 파일 디렉토리

- MCP 서버 시작 시 월드 디렉토리 1개를 지정한다(예: `~/workspace/dopan-mcp/worlds/`). 그 안의 `supuli/world.json` 등만 다룬다.
- **정본 위치는 아직 모른다** (§8 미결정 2번). v0.1에서는 디렉토리에 넣어둔 사본이 기준이다. 사본과 라이브의 일치 여부는 `dopan_get_world`가 반환하는 `sourceSha256`으로 확인한다(라이브 `/preview/games/<slug>/world.json`의 SHA와 대조).
- 디렉토리 밖 파일은 절대 읽고 쓰지 않는다. 경로에 `..`·절대경로가 오면 도구 오류로 거절한다(F5의 에셋 URI 규칙과 같은 자세).
- 쓰기 흐름: 사본 읽기 → 변경 → `checkBase`+`validateWorldManifest` → 통과 시에만 `*.edited.json`으로 쓰기. 검증 실패 시 파일은 그대로 둔다.

### 3.3 코드 재사용 (복사 금지)

| 가져다 쓸 것 | 출처 | 방식 |
|---|---|---|
| `validateWorldManifest` | `engine-validation.mjs` (MIT, upstream `df9a4946…`) | 파일을 그대로 가져오거나, 같은 버전으로 벤더링하고 버전을 설계서에 기록한다. 규칙을 베껴 쓰지 않는다 |
| `checkBase`, `availableTemplates`, `exportPlacements` | `engine-export.mjs` | 3D 내보내기 로직은 v0.1에서 안 쓰지만, `checkBase`·`availableTemplates`는 쓴다 |
| stdio 서버 뼈대 | MCP Forge `forge_sdk.py` 패턴 (공식 MCP SDK) | 도구 등록·호출 방식을 따른다. Forge 자체를 고치지 않는다 |
| 검증 방식 | GameOps MCP §5.5-§6 (L0·L1·L2, 주입 테스트) | 같은 단계로 검증한다 |

---

## 4. 월드 식별자

| 식별자 | 예 | 용도 |
|---|---|---|
| game slug | `supuli`, `star-fishing`, `star-defense` | URL·파일 경로의 식별자. 도구 입력은 이것을 받는다 |
| `world.id` | `supuli-village`, `star-fishing-lake`, `star-defense-field` | 매니페스트 안의 id. slug와 다르다(F1). 도구는 둘을 구분해서 반환한다 |
| 템플릿 id | `ent-tree-1`, `ent-house-3` | `availableTemplates`가 돌려주는 원형 엔티티의 id. 배치할 때 이것을 지정한다 |
| 배치 id | `studio.<uuid>` | 새로 배치한 엔티티의 id. 에디터와 같은 형식(`studio.` + UUID). MCP가 임의 id를 받지 않는다 |

---

## 5. MCP 도구 목록 (v0.1, 8개)

공통: 모든 도구는 `world` 식별에 game slug를 쓴다. 쓰기 도구는 실행 전에 검증을 통과해야 하고, 실패하면 파일을 건드리지 않는다. 오류는 `{code, message, path?}` 형태이며, 검증 실패는 `E_VALIDATION` + `validateWorldManifest`의 `errors[]`를 그대로 포함한다.

### 5.1 읽기 (3개) — `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`

| # | 도구 | 입력 | 반환 |
|---|---|---|---|
| 1 | `dopan_list_worlds` | 없음 | 월드 3개: slug·`world.id`·이름·entities/zones/paths 수·편집 가능 장식 수·`sourceSha256`·파일 경로 |
| 2 | `dopan_get_world` | `slug`, `view` (`summary` \| `decor` \| `full`, 기본 `summary`) | `summary`: 월드 블록·구역·경로 수·장식 목록(이름·id·좌표). `decor`: 장식 엔티티 전문. `full`: 매니페스트 전문(약 13–21KB) |
| 3 | `dopan_validate_world` | `slug` 또는 `path`(작업 사본 경로) | `{valid, errors: [{code, path, detail}], warnings: []}`. `validateWorldManifest` + `checkBase` 결과를 그대로 반환 |

### 5.2 쓰기 (3개) — `readOnlyHint: false`, `destructiveHint`는 삭제만 `true`

| # | 도구 | 입력 | 동작·반환 |
|---|---|---|---|
| 4 | `dopan_place_object` | `slug`, `templateId`, `position: [x, y, z]` | 원형을 복제해 `studio.<uuid>`로 배치. 좌표는 유한한 숫자만 받는다. 반환: 새 엔티티 id·이름·좌표·배치 후 장식 수. **파일은 쓰지 않는다** — 변경은 메모리 작업 사본에만 남고, `dopan_export_world`로 내보낸다 |
| 5 | `dopan_move_object` | `slug`, `id`, `x`, `z` | 에디터와 같이 `[x, 기존 y, z]`로 교체. `id`가 장식 4종이 아니면 오류. 반환: 이전·이후 좌표 |
| 6 | `dopan_delete_object` | `slug`, `id` | 에디터의 참조 검사와 같이, 다른 항목이 참조하면 `E_REFERENCED`로 거절하고 삭제하지 않는다. 반환: 삭제한 id·삭제 후 장식 수 |

쓰기 도구가 파일을 직접 쓰지 않는 이유: 한 번의 도구 호출이 곧 한 번의 저장이 되면, 중간에 검증이 깨진 월드가 파일에 남는다. v0.1은 **호출 = 메모리 변경, 내보내기 = 파일 쓰기**로 분리한다. (에디터도 저장은 별도 버튼이다.)

### 5.3 내보내기 (1개)

| # | 도구 | 입력 | 동작·반환 |
|---|---|---|---|
| 7 | `dopan_export_world` | `slug`, `outName?` (기본 `<slug>.edited.json`) | 작업 사본을 `checkBase`+`validateWorldManifest`로 검증하고, 통과 시에만 월드 디렉토리 안 `*.edited.json`으로 쓴다. 실패 시 쓰지 않고 `errors[]`를 반환한다. 반환: 파일 경로·바이트 수·SHA-256·장식 수 |

### 5.4 플레이 (1개, 읽기)

| # | 도구 | 입력 | 동작·반환 |
|---|---|---|---|
| 8 | `dopan_play_url` | `slug` | `{mapUrl: "https://dopan.aldol.app/map", playUrl: "https://dopan.aldol.app/preview/games/<slug>/index.html"}` + 안내 문구. **편집한 월드를 URL로 플레이할 수는 없다**(F4). 내보낸 파일은 에디터의 "월드 파일 열기"로 열어 플레이한다 |

**[제안 — 에디터 변경, v0.1 범위 밖]:** 에디터가 `?world=<url>` 같은 쿼리를 받아 원격 world.json을 불러오게 하면, 내보낸 파일을 어딘가에 올린 뒤 URL 하나로 편집본 플레이가 된다. 구현 여부는 아크(도판 제작자) 결정. 이 제안이 받아들여지면 `dopan_play_url`은 편집본 URL도 반환하게 바꾼다.

### 5.5 만들지 않는 것 (v0.1 범위 밖)

| 만들지 않는 것 | 이유 |
|---|---|
| 3D 스튜디오 도구(씬 엔티티 배치·`exportPlacements`) | 3D 쪽 소스(`studio.js` 등)를 이번 설계에서 읽지 않았다. 별도 설계가 필요하다 |
| NPC·퀘스트·구역·경로 편집 도구 | 맵 편집기도 못 하는 일이다. 범위 확장은 v0.2 이후 |
| 임의 파일 읽기·쓰기 도구 | 디렉토리 밖 접근이 열리면 MCP가 파일 브라우저가 된다. 월드 디렉토리 안으로 한정한다 |
| 발행·배포 도구(Pages deploy, 정본 덮어쓰기) | 라이브에 닿는다. 별도 승인 없이는 만들지 않는다 |
| 임의 URL fetch 도구 | F1·F2처럼 라이브 판정이 꼬인다. 라이브 대조는 `sourceSha256` 비교로만 한다 |

---

## 6. 검증 계획

GameOps MCP의 L0·L1·L2 단계를 그대로 쓴다.

### L0 — 단위 (파일만, MCP 없이)

- 픽스처: 수풀리 사본(정상) + 변형 6종 — `schemaVersion` 변경, 최상위 키 1개 삭제, id 중복, `glb:` 경로에 `..`, 존재하지 않는 에셋 참조, NPC `schedule` 빈 배열.
- `validateWorldManifest` + `checkBase`가 6종 전부 `valid: false`로 잡고, 정상 사본은 `valid: true`여야 한다.
- 배치 로직: 원형 복제 시 id가 `studio.<uuid>` 형식이고, 좌표가 소수 1자리로 반올림되는지 확인한다.

### L1 — MCP stdio 스모크 (로컬)

- Forge 클라이언트 패턴으로 `tools/list` → 8개, 읽기 3개에 `readOnlyHint: true`, 삭제에만 `destructiveHint: true`인지 확인한다.
- 읽기 도구 3개를 전부 호출한 뒤 월드 파일들의 SHA-256이 호출 전과 같은지 확인한다(읽기가 파일을 안 건드리는 증거).
- 쓰기 도구: 수풀리 사본에 나무 배치 → 장식 13→14개, 이동 → 좌표 변경, 삭제 → 13개로 복귀. 각 단계마다 `dopan_validate_world`가 `valid: true`여야 한다.
- 내보내기: `supuli.edited.json`이 생기고 SHA-256이 반환값과 일치하는지, 정본 `world.json`의 SHA가 그대로인지 확인한다.

### L2 — 종단 (에디터와 대조)

- 내보낸 `supuli.edited.json`을 도판 2D 편집기의 "월드 파일 열기"로 열어 장식 수가 MCP가 말한 수와 같은지 브라우저에서 확인한다(2026-11-25 검증과 같은 방식: 13→14개).
- 주입 시도: `slug="../.."`, `templateId="ent-tree-1; rm"`, 좌표 `NaN`·`Infinity`, 경로 `../../etc/passwd` → 전부 도구 오류, 파일 무변화.
- 삭제 거절: 다른 항목이 참조하는 id 삭제 시도 → `E_REFERENCED`, 파일 무변화.

---

## 7. 롤아웃

| 단계 | 내용 | 시기 |
|---|---|---|
| 1 | 설계 승인(알돌) + 미결정 5건 결정 (§8) | 지금 |
| 2 | L0·L1 로컬 구현 + 검증. 도판·운영 접촉 없음 | 11/29 이후 + 알돌 승인 |
| 3 | L2 에디터 대조 + 사용법 문서(모아 커넥터 등록) | 2단계 통과 후 |
| 4 | v0.2 검토: 원격 Worker 여부, NPC·퀘스트 범위, `?world=` 제안 채택 여부 | 3단계 이후, 별도 승인 |

챌린지 기간(11/29 08:00 KST 마감까지)에는 2단계에 들어가지 않는다.

---

## 8. 미결정 (알돌 결정 필요)

| # | 질문 | 선택지 | 설계의 권고 | 해소되면 |
|---|---|---|---|---|
| 1 | 전송: stdio v0.1로 갈까, 원격 Worker로 바로 갈까 | stdio v0.1(채택안) / 원격 Worker v0.1 | stdio. 저장소가 없는 지금 원격은 껍데기만 된다 | 2단계 착수 가능 |
| 2 | **월드 정본은 어디인가** (어느 레포·브랜치·경로) | 알돌엔진 레포 / inhagame / 도판 전용 레포 / 아직 없음 | 확인 전에는 MCP 디렉토리의 사본을 기준으로 삼고, `sourceSha256`으로 라이브와 대조한다 | MCP가 고치는 파일이 정본과 같은 파일이 된다 |
| 3 | 아크가 원격 MCP를 쓸 필요가 있는가 | 모아만(Stdio) / 크루 공용(원격 v0.2) | v0.2에서 다시 묻는다. 아크는 도판 제작자라 이 결정을 아크와 함께 한다 | v0.2 범위 확정 |
| 4 | 편집본 플레이용 `?world=` 제안을 에디터에 넣을까 | 넣는다 / 안 넣는다 | 넣는 쪽이 MCP의 쓸모를 크게 늘린다. 단, 도판 코드 변경이라 아크 결정 | `dopan_play_url`이 편집본 URL 반환 |
| 5 | 쓰기 범위를 장식 4종에서 넓힐까 (NPC·퀘스트·구역·경로) | v0.1은 장식만 / v0.1부터 전부 | 장식만. 에디터와 같은 범위가 안전하다 | v0.2 도구 목록 |

---

## 9. 출처 (이 설계가 읽은 것)

- 도판 라이브: `https://dopan.aldol.app/`·`/map` (2026-11-25 curl + 브라우저 검증), `/sw.js`, `/map.mjs`, `/engine-export.mjs`, `/engine-validation.mjs` 전문, `/preview/games/{supuli,star-fishing,star-defense}/world.json` 3개 전문.
- GameOps MCP v0.1 설계서 `aldol-gameops/per-game-analytics/MCP-V0.1-DESIGN-20261125.md` (§5 전송·도구 계약, §6 검증 단계).
- MCP Forge 커스텀 커넥터 `~/workspace/custom-connectors/custom.aldol-mcp-forge/CONNECTOR.md` (stdio 패턴, 공식 MCP SDK `mcp==2.0.0`).
- 모툭 MCP 커스텀 커넥터 (원격 Streamable HTTP 패턴 — v0.2 참고용).
- 이 설계에서 읽지 않은 것: 도판 3D 스튜디오 소스(`studio.js`, `factory-panel.mjs` 등), 도판 소스 레포 위치, 알돌엔진 WorldForge 원본 레포의 최신 상태.
