// Tests for draft-v1.7.0 publish.mjs — run: node test-publish.mjs
// Writes sample-publish-pack.json (다시, 놀이터 plan + peak 15000,
// platforms youtube/steam, overlay '어른들의 놀이터') on success.
//
// Local test note: publish.mjs imports ./safe-zones.mjs, which lives in
// ~/workspace/bichum/ (the live dir, where the module runs after apply).
// This folder has a symlink safe-zones.mjs -> ../safe-zones.mjs so the
// tests run here. The symlink is NOT part of the draft: apply-v1.7.0.py
// copies publish.mjs only, never the symlink.
// Design: draft-v1.7.0/DESIGN.md #6, test cases 1-10 + extras 11-14.
// Fixture: the 다시, 놀이터 plan from the 2026-11-24 live E2E
// (~/workspace/bichum/e2e-test-20261124.json, plan field).
import { strict as assert } from 'node:assert';
import { writeFileSync } from 'node:fs';
import { planPublish } from '../publish.mjs';

const dasiPlan = {
  schema: 'bichum.trailer-shot-plan/1',
  game_title: '다시, 놀이터',
  format: '9:16',
  duration_seconds: 32,
  key_message: '어른들은 왜 다시 로블록스에서 노는가? 친구와 다시 만드는 놀이터',
  call_to_action: '',
  shots: [
    { start_ms: 0, end_ms: 6400, purpose: '도입', direction: '게임 제목 또는 대표 화면으로 시작' },
    { start_ms: 6400, end_ms: 22400, purpose: '실제 플레이', direction: '어른들은 왜 다시 로블록스에서 노는가? 친구와 다시 만드는 놀이터' },
    { start_ms: 22400, end_ms: 32000, purpose: '엔딩', direction: '검토된 엔딩 문구 배치' },
  ],
  status: 'PLAN_ONLY',
};

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log('PASS', name); };

// 1. 다시, 놀이터 플랜 + peak_ms 15000 (design test 1) — also the sample source.
const result = planPublish({ plan: dasiPlan, peak_ms: 15000, platforms: ['youtube', 'steam'], overlay_text: '어른들의 놀이터' });
check('dasi peak 15000: schema, peak, 5 candidates, recommended 15000, title/chapters', () => {
  assert.equal(result.schema, 'bichum.publish-pack/1');
  assert.equal(result.filename, 'bichum-publish-pack.json');
  assert.equal(result.status, 'PUBLISH_PLAN_ONLY');
  assert.equal(result.game_title, '다시, 놀이터');
  assert.equal(result.format, '9:16');
  assert.equal(result.duration_seconds, 32);
  assert.equal(result.thumbnail.peak_ms, 15000);
  assert.equal(result.thumbnail.peak_source, 'user');
  assert.deepEqual(result.thumbnail.candidates.map(c => [c.offset_ms, c.ms, c.score]), [
    [-1000, 14000, 80], [-500, 14500, 95], [0, 15000, 100], [500, 15500, 95], [1000, 16000, 80],
  ]);
  assert.equal(result.thumbnail.recommended_ms, 15000);
  const yt = result.publish.find(p => p.platform === 'youtube');
  assert.equal(yt.title, '다시, 놀이터 — 어른들은 왜 다시 로블록스에서 노는가? 친구와 다시 만드는 놀이터');
  assert.equal(yt.title_length, 46);
  assert.equal(yt.title_limit, 100);
  assert.equal(yt.title_truncated, false);
  assert.equal(yt.description, '어른들은 왜 다시 로블록스에서 노는가? 친구와 다시 만드는 놀이터\n\n챕터:\n0:00 도입\n0:06 실제 플레이\n0:22 엔딩');
  assert.equal(yt.description_truncated, false);
  assert.equal(yt.chapters, '0:00 도입\n0:06 실제 플레이\n0:22 엔딩');
  assert.deepEqual(result.to_be_measured, {
    frame_extraction: '렌더 환경이 후보 시간의 프레임을 뽑아 선명도·노출을 재요.',
    upload: '실제 업로드·예약은 게시자가 직접 해요.',
  });
});

// 2. peak_ms 없음 (design test 2) — 가장 긴 실제 플레이 샷 중간 14400ms.
check('auto peak: longest play shot middle 14400ms', () => {
  const out = planPublish({ plan: dasiPlan });
  assert.equal(out.thumbnail.peak_ms, 14400);
  assert.equal(out.thumbnail.peak_source, 'auto-longest-play-shot');
  assert.deepEqual(out.thumbnail.candidates.map(c => [c.offset_ms, c.ms, c.score]), [
    [-1000, 13400, 80], [-500, 13900, 95], [0, 14400, 100], [500, 14900, 95], [1000, 15400, 80],
  ]);
  assert.equal(out.thumbnail.recommended_ms, 14400);
  assert.equal(out.thumbnail.steam_capsules.length, 0);
});

// 3. platforms youtube+steam (design test 3) — 캡슐 6종, steam 항목 title null.
check("platforms youtube+steam: 6 capsules, steam title null", () => {
  assert.equal(result.thumbnail.steam_capsules.length, 6);
  assert.deepEqual(result.thumbnail.steam_capsules.map(c => [c.name, c.size, c.aspect, c.text_safe]), [
    ['Header', '920×430', 2.14, true],
    ['Small', '462×174', 2.66, false],
    ['Main', '1232×706', 1.74, true],
    ['Vertical', '748×896', 0.83, true],
    ['Library', '600×900', 0.67, true],
    ['Library Hero', '3840×1240', 3.1, true],
  ]);
  assert.equal(result.thumbnail.steam_capsules[1].reason, '작은 캡슐에서는 문구가 잘 안 보여요.');
  assert.equal(result.thumbnail.steam_capsules[5].note, '라이브러리 히어로는 아트만, 로고는 따로 얹어요.');
  const steam = result.publish.find(p => p.platform === 'steam');
  assert.equal(steam.title, null);
  assert.equal(steam.title_length, null);
  assert.equal(steam.title_limit, null);
  assert.equal(steam.note, 'Steam은 제목을 쓰지 않고 캡슐만 검사해요.');
});

// 4. 피크 0ms (design test 4) — 음수 오프셋 버려져 후보 3개.
check('peak 0ms: 3 candidates, recommended 0', () => {
  const out = planPublish({ plan: dasiPlan, peak_ms: 0 });
  assert.deepEqual(out.thumbnail.candidates.map(c => [c.offset_ms, c.ms, c.score]), [
    [0, 0, 100], [500, 500, 85], [1000, 1000, 70],
  ]);
  assert.equal(out.thumbnail.recommended_ms, 0);
});

// 5. 피크 영상 끝 32000ms (design test 5) — 양수 오프셋 버려져 후보 3개.
check('peak 32000ms: 3 candidates, recommended 32000', () => {
  const out = planPublish({ plan: dasiPlan, peak_ms: 32000 });
  assert.deepEqual(out.thumbnail.candidates.map(c => [c.offset_ms, c.ms, c.score]), [
    [-1000, 31000, 70], [-500, 31500, 85], [0, 32000, 100],
  ]);
  assert.equal(out.thumbnail.recommended_ms, 32000);
});

// 6. 제목 100자 초과 (design test 6) — 자르고 title_truncated: true.
check('title over 100 chars: cut to 100, title_truncated true', () => {
  const out = planPublish({ game_title: '가'.repeat(60), format: '9:16', duration_seconds: 32, key_message: '나'.repeat(60) });
  const yt = out.publish[0];
  assert.equal(yt.title.length, 100);
  assert.equal(yt.title_truncated, true);
  assert.equal(yt.title, '가'.repeat(60) + ' — ' + '나'.repeat(37));
});

// 7. peak_ms 33000 (design test 7, 32초 영상) -> 에러.
check('peak_ms 33000 throws', () => {
  assert.throws(() => planPublish({ plan: dasiPlan, peak_ms: 33000 }), /peak_ms 항목은 0~32000 정수/);
});

// 8. overlay_text 41자 (design test 8) -> 에러.
check('overlay_text 41 chars throws', () => {
  assert.throws(() => planPublish({ plan: dasiPlan, overlay_text: '가'.repeat(41) }), /overlay_text 항목/);
});

// 9. platforms ['facebook'] (design test 9) -> enum 에러.
check("platforms ['facebook'] throws", () => {
  assert.throws(() => planPublish({ plan: dasiPlan, platforms: ['facebook'] }), /platforms 항목/);
});

// 10. steam + overlay_text (design test 10) -> notes에 Steam 텍스트 주의 문구.
check('steam + overlay: notes carry the Steam text warning', () => {
  assert.ok(result.notes.includes('Steam 썸네일은 텍스트 없는 프레임을 권장해요.'));
  assert.ok(result.notes.includes('제목·설명 길이 제한은 게시 시점에 플랫폼 문서에서 다시 확인해 주세요.'));
  assert.ok(result.notes.includes('Steam 라이브러리 히어로의 중앙 860×380 영역은 로고가 들어가는 안전 영역이에요.'));
});

// 11. 해시태그 (extra 11) — 다시 키 메시지에서 명사 2개.
check('hashtags: [#다시놀이터, #로블록스, #친구, #게임트레일러]', () => {
  assert.deepEqual(result.publish[0].hashtags, ['#다시놀이터', '#로블록스', '#친구', '#게임트레일러']);
  assert.deepEqual(result.publish[1].hashtags, ['#다시놀이터', '#로블록스', '#친구', '#게임트레일러']);
});

// 12. overlay 추정 (extra 12) — '어른들의 놀이터' 8자·기본 64px.
check("overlay estimate: '어른들의 놀이터' inside, rect 307px wide", () => {
  const overlay = result.thumbnail.overlay;
  assert.equal(overlay.text, '어른들의 놀이터');
  assert.equal(overlay.inside_safe_zone, true);
  assert.deepEqual(overlay.rect, { x: 386, y: 1056, w: 307, h: 83 });
  assert.equal(overlay.corrected, null);
  assert.match(overlay.note, /공통 안전 박스 안에/);
  assert.match(overlay.note, /추정한 값이에요/);
});

// 13. overlay 박스 밖 (extra 13) — 40자 문구, 너비 1536px.
check('overlay outside: 40-char text, corrected present', () => {
  const out = planPublish({ plan: dasiPlan, peak_ms: 15000, overlay_text: '가'.repeat(40) });
  const overlay = out.thumbnail.overlay;
  assert.equal(overlay.inside_safe_zone, false);
  assert.deepEqual(overlay.rect, { x: -228, y: 1056, w: 1536, h: 83 });
  assert.deepEqual(overlay.corrected, { x: 135, y: 1056, w: 1536, h: 83 });
  assert.match(overlay.note, /박스보다 넓어요/);
});

// 14. steam + overlay_text가 게임 제목과 다름 (extra 14) — 캡슐마다 warning.
check('steam + non-title overlay: every capsule carries the text warning', () => {
  for (const capsule of result.thumbnail.steam_capsules) {
    assert.equal(capsule.warning, 'Steam 캡슐에는 게임 이름·공식 부제 외의 문구를 넣을 수 없어요.');
  }
  // overlay_text가 게임 제목과 같으면 warning이 없다.
  const same = planPublish({ plan: dasiPlan, platforms: ['steam'], overlay_text: '다시, 놀이터' });
  assert.ok(same.thumbnail.steam_capsules.every(c => c.warning === undefined));
  assert.ok(same.notes.includes('Steam 썸네일은 텍스트 없는 프레임을 권장해요.'));
});

writeFileSync(new URL('./sample-publish-pack.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(`\n${passed} tests passed. Sample written: sample-publish-pack.json`);
