# 도판 — 2D 맵 편집기 MCP

도판(DOPAN, https://dopan.aldol.app) 2D 맵 편집기를 도구 호출로 다루는 MCP 서버입니다. "수풀리에 나무 10그루 심어줘" 같은 요청을 클릭 대신 도구 호출로 수행합니다.

## 상태: 설계 단계

- v0.1 설계 완료: 2026-11-25 (`DOPAN-MCP-DESIGN-20261125.md`)
- 구현: **11/29 이후** (단어연금술 챌린지 마감 이후). 지금 이 폴더에는 코드가 없습니다.
- 전송: 로컬 stdio MCP (MCP Forge 패턴). 도판에 백엔드가 없어 원격 Worker는 v0.2로 미룹니다.
- 다루는 것: 월드 매니페스트 파일(WorldForge `worldforge/0.1`)만. 정본 파일은 덮어쓰지 않고 `*.edited.json`으로만 내보냅니다.

## 도구 (v0.1, 8개 — 예정)

| 도구 | 종류 | 하는 일 |
|---|---|---|
| `dopan_list_worlds` | 읽기 | 월드 3개(수풀리·별낚시·별수호) 목록 |
| `dopan_get_world` | 읽기 | 월드 조회 (요약·장식·전문) |
| `dopan_validate_world` | 읽기 | `validateWorldManifest` + `checkBase` 검증 |
| `dopan_place_object` | 쓰기 | 장식 배치 (집·나무·갈대·허수아비) |
| `dopan_move_object` | 쓰기 | 장식 X/Z 이동 |
| `dopan_delete_object` | 쓰기 | 장식 삭제 (참조 검사 후 거절 가능) |
| `dopan_export_world` | 쓰기 | 검증 통과 시 `*.edited.json`으로 내보내기 |
| `dopan_play_url` | 읽기 | 맵·플레이 URL 반환 (편집본 URL 플레이는 아직 불가) |

쓰기 범위는 맵 편집기와 같은 **장식 4종**만입니다. NPC·퀘스트·구역·경로는 v0.2 이후입니다.

## 파일

```
dopan/
  README.md                      # 이 파일
  DOPAN-MCP-DESIGN-20261125.md   # v0.1 설계서 (전송·도구·검증·미결정 5건)
  fixtures/
    supuli/world.json            # 수풀리 마을 (29개 엔티티)
    star-fishing/world.json      # 별낚시 호수 (13개)
    star-defense/world.json      # 별수호 들판 (6개)
  vendor/
    engine-validation.mjs        # 알돌엔진 WorldForge 검증 코드 원본 (MIT)
```

`fixtures/`의 월드 JSON은 도판 라이브에서 받은 공개 파일입니다. `vendor/engine-validation.mjs`는 규칙을 베껴 쓰지 않고 원본 그대로 가져다 쓰는 파일입니다 (상류 `df9a4946…`, MIT).

## 검증

설계서 §6과 같습니다. L0(검증 픽스처 6종) → L1(stdio 스모크, 읽기 후 파일 SHA 무변화) → L2(에디터에서 내보낸 파일 열어 장식 수 대조).

## 미결정 (설계서 §8)

1. 전송: stdio v0.1 (채택안) vs 원격 Worker v0.1
2. **월드 정본은 어느 레포·브랜치인가** — 가장 큰 리스크
3. 아크의 원격 사용 여부
4. 편집본 플레이용 `?world=` 제안 채택 여부 (아크 결정)
5. 쓰기 범위 확대 여부

## 출처

- 도판: https://dopan.aldol.app (`/map` 2D 맵 편집기, `/` 3D 장면 편집기)
- 월드 형식: Aldol Engine WorldForge `worldforge/0.1`
- 이 저장소에는 어떤 비밀도 들어 있지 않습니다.
