// Tests for draft-v1.7.0 audio.mjs — run: node test-audio.mjs
// Writes sample-audio-plan.json (다시, 놀이터 32초 플랜 + BPM 120) on success.
//
// 설계안 #5 테스트 10개 + 추가 4개(11~14)를 모두 커버한다. 단, 설계안
// 테스트 11의 기대값("BPM 180 → 비트 마지막 31824ms, 96개")은 설계안
// 자체의 반올림 규칙과 맞지 않는다. beat_ms = round(60000 / 180) = 333,
// 비트는 0, 333, ..., 96x333 = 31968ms까지 97개다. 이 테스트는 실제
// 동작을 단언한다 (아래 'BPM 180: beat_ms 333, 97 beats' 참조).
// audio.mjs 헤더 주석에도 적혀 있다.
import { strict as assert } from 'node:assert';
import { writeFileSync } from 'node:fs';
import { planAudio } from '../audio.mjs';

// 오늘(2026-11-24) 라이브 E2E에서 받은 실제 다시, 놀이터 플랜
// (~/workspace/bichum/e2e-test-20261124.json 의 plan 필드 그대로).
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

const manual = { game_title: '테스트 게임', format: '16:9', duration_seconds: 22 };

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log('PASS', name); };

// 1. 다시, 놀이터 플랜 + BPM 120 (설계안 테스트 1)
const result = planAudio({ plan: dasiPlan });
check('dasi BPM 120: schema, grid, snap, levels, defaults', () => {
  assert.equal(result.schema, 'bichum.audio-plan/1');
  assert.equal(result.filename, 'bichum-audio-plan.json');
  assert.equal(result.status, 'AUDIO_PLAN_ONLY');
  assert.equal(result.game_title, '다시, 놀이터');
  assert.equal(result.format, '9:16');
  assert.equal(result.duration_seconds, 32);
  assert.equal(result.bpm, 120);
  assert.equal(result.beats_per_bar, 4);
  assert.equal(result.mood, 'tense');
  assert.equal(result.beat_grid.beat_ms, 500);
  assert.equal(result.beat_grid.bar_ms, 2000);
  assert.equal(result.beat_grid.beats.length, 64);
  assert.deepEqual(result.beat_grid.beats[0], { beat_no: 1, ms: 0 });
  assert.deepEqual(result.beat_grid.beats[63], { beat_no: 64, ms: 31500 });
  assert.equal(result.beat_grid.bars.length, 16);
  assert.deepEqual(result.beat_grid.bars[0], { bar_no: 1, start_ms: 0, end_ms: 2000 });
  assert.deepEqual(result.beat_grid.bars[15], { bar_no: 16, start_ms: 30000, end_ms: 32000 });
  assert.deepEqual(result.cuts, [
    { shot_no: 2, purpose: '실제 플레이', original_ms: 6400, snapped_ms: 6500, shift_ms: 100, nearest_beat_no: 14, snapped: true },
    { shot_no: 3, purpose: '엔딩', original_ms: 22400, snapped_ms: 22500, shift_ms: 100, nearest_beat_no: 46, snapped: true },
  ]);
  assert.deepEqual(result.levels.map(level => level.music_bed_db), [-18, -14, -20]);
  assert.deepEqual(result.levels.map(level => level.note), [
    '내레이션이 있으면 더 낮춰요.',
    '가장 크게, 게임음이 중심이에요.',
    '엔딩 문구가 끝나면 페이드아웃해요.',
  ]);
  assert.deepEqual(result.ducking, {
    threshold_db: -18, ratio: 4, attack_ms: 10, release_ms: 250,
    note: '대사·내레이션이 들어올 때 BGM을 이 비율로 낮춰요.',
  });
  assert.deepEqual(result.silence_cut, {
    threshold_db: -40, min_duration_ms: 500, margin_ms: 100,
    ffmpeg_silencedetect: 'silencedetect=noise=-40dB:d=0.5',
  });
  assert.deepEqual(result.to_be_measured, {
    actual_bpm: null, measured_loudness_lufs: null, detected_beats: null,
    note: 'librosa로 실제 BPM·비트 위치를 재고, 컷을 다시 맞춰요.',
  });
  assert.ok(result.notes.includes('컷 위치는 가장 가까운 비트로 맞췄어요. 비트 감지는 렌더 환경에서 해요.'));
  assert.ok(result.notes.includes('샷 경계를 비트에 맞췄어요. 원본과 100ms 달라요.'));
  assert.ok(result.notes.includes('음악 베드 레벨은 믹스 상대 레벨이에요. 절대 음량이 아니에요.'));
  assert.ok(result.notes.includes('BPM은 계획용이에요. 실제 음악과 다르면 렌더 환경이 컷을 다시 맞춰요.'));
});

// 2. BPM 100 (설계안 테스트 2) — plan과 함께 bpm을 주는 것도 허용
check('BPM 100: beat_ms 600, 54 beats, 14 bars', () => {
  const out = planAudio({ plan: dasiPlan, bpm: 100 });
  assert.equal(out.beat_grid.beat_ms, 600);
  assert.equal(out.beat_grid.bar_ms, 2400);
  assert.equal(out.beat_grid.beats.length, 54);
  assert.deepEqual(out.beat_grid.beats[53], { beat_no: 54, ms: 31800 });
  assert.equal(out.beat_grid.bars.length, 14);
  assert.deepEqual(out.beat_grid.bars[13], { bar_no: 14, start_ms: 31200, end_ms: 32000 });
});

// 3. beats_per_bar 3 (설계안 테스트 3)
check('beats_per_bar 3: bar_ms 1500, 22 bars', () => {
  const out = planAudio({ plan: dasiPlan, beats_per_bar: 3 });
  assert.equal(out.beat_grid.beat_ms, 500);
  assert.equal(out.beat_grid.bar_ms, 1500);
  assert.equal(out.beat_grid.bars.length, 22);
  assert.deepEqual(out.beat_grid.bars[21], { bar_no: 22, start_ms: 31500, end_ms: 32000 });
});

// 4. mood calm (설계안 테스트 4)
check("mood calm: all levels -2dB", () => {
  const out = planAudio({ plan: dasiPlan, mood: 'calm' });
  assert.deepEqual(out.levels.map(level => level.music_bed_db), [-20, -16, -22]);
  assert.equal(out.mood, 'calm');
});

// 5. 샷 경계가 비트와 정확히 일치 (설계안 테스트 5)
check('boundary on beat: shift 0, snapped false, no snap note', () => {
  const aligned = structuredClone(dasiPlan);
  aligned.shots = [
    { start_ms: 0, end_ms: 6000, purpose: '도입', direction: '도입' },
    { start_ms: 6000, end_ms: 12000, purpose: '실제 플레이', direction: '플레이' },
    { start_ms: 12000, end_ms: 32000, purpose: '엔딩', direction: '엔딩' },
  ];
  const out = planAudio({ plan: aligned });
  assert.deepEqual(out.cuts.map(cut => cut.shift_ms), [0, 0]);
  assert.deepEqual(out.cuts.map(cut => cut.snapped), [false, false]);
  assert.deepEqual(out.cuts.map(cut => cut.snapped_ms), [6000, 12000]);
  assert.deepEqual(out.cuts.map(cut => cut.nearest_beat_no), [13, 25]);
  assert.ok(!out.notes.some(note => note.includes('원본과')));
});

// 6. BPM 60과 180 허용 (설계안 테스트 6)
check('BPM 60 and 180 accepted: beat 1000ms / 333ms', () => {
  const slow = planAudio({ plan: dasiPlan, bpm: 60 });
  assert.equal(slow.beat_grid.beat_ms, 1000);
  assert.equal(slow.beat_grid.beats.length, 32);
  assert.deepEqual(slow.beat_grid.beats[31], { beat_no: 32, ms: 31000 });
  const fast = planAudio({ plan: dasiPlan, bpm: 180 });
  assert.equal(fast.beat_grid.beat_ms, 333);
});

// 7. BPM 범위 밖 (설계안 테스트 7)
check('BPM 59, 181, 120.5 throw', () => {
  assert.throws(() => planAudio({ plan: dasiPlan, bpm: 59 }), /bpm 항목은 60~180 정수/);
  assert.throws(() => planAudio({ plan: dasiPlan, bpm: 181 }), /bpm 항목은 60~180 정수/);
  assert.throws(() => planAudio({ plan: dasiPlan, bpm: 120.5 }), /bpm 항목은 60~180 정수/);
});

// 8. ducking.ratio 범위 밖 (설계안 테스트 8)
check('ducking.ratio 9 throws', () => {
  assert.throws(() => planAudio({ plan: dasiPlan, ducking: { ratio: 9 } }), /ducking\.ratio 항목은 2~8 정수/);
  assert.throws(() => planAudio({ plan: dasiPlan, ducking: { threshold_db: -5 } }), /ducking\.threshold_db 항목은 -30~-6 정수/);
  assert.throws(() => planAudio({ plan: dasiPlan, silence: { min_duration_ms: 100 } }), /silence\.min_duration_ms 항목은 200~2000 정수/);
});

// 9. plan + 직접 입력 혼합 (설계안 테스트 9) — 직접 입력 단독은 기본 샷 20/50/30
check('plan + manual fields throws; manual mode uses 20/50/30 shots', () => {
  assert.throws(() => planAudio({ plan: dasiPlan, game_title: 'x' }), /하나만 입력/);
  assert.throws(() => planAudio({ plan: dasiPlan, duration_seconds: 22 }), /하나만 입력/);
  const out = planAudio({ ...manual });
  assert.equal(out.game_title, '테스트 게임');
  assert.equal(out.format, '16:9');
  assert.equal(out.duration_seconds, 22);
  // 기본 샷: 0–4400 / 4400–15400 / 15400–22000, BPM 120.
  assert.deepEqual(out.cuts.map(cut => cut.original_ms), [4400, 15400]);
  assert.deepEqual(out.cuts.map(cut => cut.snapped_ms), [4500, 15500]);
  assert.deepEqual(out.cuts.map(cut => cut.shift_ms), [100, 100]);
  assert.deepEqual(out.levels.map(level => level.music_bed_db), [-18, -14, -20]);
});

// 10. loudnorm 문자열 일치 (설계안 테스트 10) + 무음 FFmpeg 문자열
check('loudnorm and silencedetect strings exact, custom silence rebuilds them', () => {
  assert.equal(result.loudness.ffmpeg_loudnorm, 'loudnorm=I=-14:TP=-1.5:LRA=11');
  assert.deepEqual(result.loudness, {
    target_lufs: -14, true_peak_db: -1.5, lra: 11,
    ffmpeg_loudnorm: 'loudnorm=I=-14:TP=-1.5:LRA=11',
  });
  const custom = planAudio({ plan: dasiPlan, silence: { threshold_db: -30, min_duration_ms: 1200, margin_ms: 50 } });
  assert.equal(custom.silence_cut.ffmpeg_silencedetect, 'silencedetect=noise=-30dB:d=1.2');
  assert.equal(custom.silence_cut.margin_ms, 50);
});

// 11. 반올림: BPM 180 (설계안 추가 테스트 11 — 기대값은 실제 동작으로 정정)
check('BPM 180: beat_ms 333, 97 beats, last 31968ms — 설계안 96개/31824ms와 다름, 실제 동작', () => {
  // 설계안은 "비트 마지막 31824ms(0~31824, 96개)"라 적었지만 반올림
  // 규칙대로면 beat_ms = round(60000 / 180) = 333, 비트는
  // 0, 333, ..., 96x333 = 31968ms까지 97개다.
  const out = planAudio({ plan: dasiPlan, bpm: 180 });
  assert.equal(out.beat_grid.beat_ms, 333);
  assert.equal(out.beat_grid.beats.length, 97);
  assert.deepEqual(out.beat_grid.beats[96], { beat_no: 97, ms: 31968 });
  assert.equal(out.beat_grid.bar_ms, 1332);
});

// 12. mood epic (설계안 추가 테스트 12)
check("mood epic: only play -12dB", () => {
  const out = planAudio({ plan: dasiPlan, mood: 'epic' });
  assert.deepEqual(out.levels.map(level => level.music_bed_db), [-18, -12, -20]);
  const uplifting = planAudio({ plan: dasiPlan, mood: 'uplifting' });
  assert.deepEqual(uplifting.levels.map(level => level.music_bed_db), [-18, -14, -20]);
});

// 13. ducking 부분 입력 (설계안 추가 테스트 13)
check('ducking partial: ratio 6 only, rest default', () => {
  const out = planAudio({ plan: dasiPlan, ducking: { ratio: 6 } });
  assert.deepEqual(out.ducking, {
    threshold_db: -18, ratio: 6, attack_ms: 10, release_ms: 250,
    note: '대사·내레이션이 들어올 때 BGM을 이 비율로 낮춰요.',
  });
});

// 14. 스냅 후 샷 길이 100ms 미만 (설계안 추가 테스트 14)
check('short shot after snap: warning on the short shot cut entry', () => {
  // 도입 0–6400 / 실제 플레이 6400–6600 / 엔딩 6600–32000, BPM 120.
  // 경계 6400 → 6500, 경계 6600 → 6500이라 실제 플레이 샷이
  // 6500–6500 = 0ms가 된다.
  const squeezed = structuredClone(dasiPlan);
  squeezed.shots = [
    { start_ms: 0, end_ms: 6400, purpose: '도입', direction: '도입' },
    { start_ms: 6400, end_ms: 6600, purpose: '실제 플레이', direction: '플레이' },
    { start_ms: 6600, end_ms: 32000, purpose: '엔딩', direction: '엔딩' },
  ];
  const out = planAudio({ plan: squeezed });
  assert.deepEqual(out.cuts.map(cut => cut.snapped_ms), [6500, 6500]);
  assert.equal(out.cuts[0].warning, '샷이 너무 짧아져요. BPM을 바꾸거나 컷을 손으로 조정하세요.');
  assert.equal(out.cuts[1].warning, undefined);
  // 정상 다시 플랜에서는 warning이 없다.
  assert.equal(result.cuts[0].warning, undefined);
  assert.equal(result.cuts[1].warning, undefined);
});

writeFileSync(new URL('./sample-audio-plan.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(`\n${passed} tests passed. Sample written: sample-audio-plan.json`);
