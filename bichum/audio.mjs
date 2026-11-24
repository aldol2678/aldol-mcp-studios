// Draft for Bichum v1.7.0 — bichum_plan_audio
// Status: DRAFT, not deployed. Prepared 2026-11-24.
// Builds a BGM brief + beat-cut plan from a shot plan or manual input.
// It never makes music: the beat grid is pure arithmetic from a supplied
// BPM, cuts are snapped to the nearest beat, and the render environment
// measures the real BPM (librosa) and re-snaps if it differs.
//
// Deterministic rules (from draft-v1.7.0/DESIGN.md #5, which follows
// draft-next-features/DESIGN.md #5):
//   - beat_ms = round(60000 / bpm); bar_ms = beat_ms x beats_per_bar.
//     Beats run 0, beat_ms, 2x beat_ms, ... strictly inside the video
//     (ms < duration_seconds x 1000). The design's prose says "up to the
//     duration", but its test 1 fixes 64 beats (0~31500 ms) for 32 s at
//     BPM 120, so the endpoint itself (32000 ms) is not a beat. Bars run
//     the same way, the last bar's end_ms clipped to the duration.
//     Note the nearest beat of a late boundary can be the duration
//     endpoint (beat_no N+1), which is not in the beats list.
//   - Cut snap: every shot boundary except the first shot's 0 ms start
//     moves to the nearest beat; ties go to the earlier beat. shift_ms is
//     the absolute move, snapped is shift_ms !== 0, nearest_beat_no is
//     snapped_ms / beat_ms + 1 (beat_no 1 is 0 ms). shift never exceeds
//     half the beat interval. If any cut snapped, notes gets
//     "샷 경계를 비트에 맞췄어요. 원본과 Nms 달라요." (N = largest shift).
//   - Snapped shot length < 100 ms -> that cut entry gets a warning.
//     The warning attaches to the cuts entry of the short shot itself
//     (shot 1 has no cuts entry, so it attaches to shot 2's entry).
//   - Music bed levels (relative dB, not absolute loudness): 도입 -18,
//     실제 플레이 -14, 엔딩 -20; other purposes fall back to -14.
//     mood calm: all -2 dB; epic: 실제 플레이 only -12 dB.
//     tense / uplifting: no adjustment.
//   - Ducking defaults: threshold_db -18, ratio 4, attack_ms 10,
//     release_ms 250. Partial input fills only the missing fields.
//   - Loudness target (fixed): -14 LUFS, true peak -1.5 dB, LRA 11,
//     ffmpeg_loudnorm "loudnorm=I=-14:TP=-1.5:LRA=11".
//   - Silence-cut defaults: threshold_db -40, min_duration_ms 500,
//     margin_ms 100. ffmpeg string is
//     "silencedetect=noise={threshold}dB:d={min_duration_ms / 1000}"
//     with d to one decimal place (500 ms -> 0.5, 1200 ms -> 1.2).
//
// Notes on the design doc (see test-audio.mjs test 11):
//   - The design's test 11 says BPM 180 gives "비트 마지막 31824ms
//     (0~31824, 96개)", but that does not follow its own rounding rule:
//     beat_ms = round(60000 / 180) = 333, beats at 0..96x333 = 0..31968
//     (97 beats, last 31968 ms). This module follows the rule and the
//     test asserts the computed values (97 beats, last 31968 ms).
//   - Manual mode has no shot plan, so shots use the v1.3.0 manifest
//     default (20% intro / 50% play / 30% ending), same as narration.
//     The design does not specify manual-mode shots.

const MOODS = ['tense', 'uplifting', 'calm', 'epic'];

const LEVEL_BASE = {
  '도입': { db: -18, note: '내레이션이 있으면 더 낮춰요.' },
  '실제 플레이': { db: -14, note: '가장 크게, 게임음이 중심이에요.' },
  '엔딩': { db: -20, note: '엔딩 문구가 끝나면 페이드아웃해요.' },
};
const LEVEL_FALLBACK = { db: -14, note: '가장 크게, 게임음이 중심이에요.' };

const DUCKING_DEFAULTS = { threshold_db: -18, ratio: 4, attack_ms: 10, release_ms: 250 };
const DUCKING_RANGES = {
  threshold_db: [-30, -6],
  ratio: [2, 8],
  attack_ms: [1, 50],
  release_ms: [50, 1000],
};
const SILENCE_DEFAULTS = { threshold_db: -40, min_duration_ms: 500, margin_ms: 100 };
const SILENCE_RANGES = {
  threshold_db: [-50, -20],
  min_duration_ms: [200, 2000],
  margin_ms: [0, 500],
};

function validatePlanShots(plan) {
  if (!Array.isArray(plan.shots) || !plan.shots.length) {
    throw new Error('컷 구성표에 샷이 없어요. 컷 구성표부터 다시 만들어 주세요.');
  }
  for (const [index, shot] of plan.shots.entries()) {
    if (!Number.isInteger(shot.start_ms) || !Number.isInteger(shot.end_ms) || shot.end_ms <= shot.start_ms ||
        typeof shot.purpose !== 'string' || !shot.purpose.trim()) {
      throw new Error((index + 1) + '번 샷의 시작·종료 시각과 용도를 확인해 주세요.');
    }
  }
}

function validateSelected(selected) {
  if (typeof selected.game_title !== 'string' || !selected.game_title.trim() || selected.game_title.length > 120) {
    throw new Error('game_title 항목의 내용 또는 길이를 확인해 주세요.');
  }
  if (!['16:9', '9:16', '1:1'].includes(selected.format)) {
    throw new Error('format 항목의 내용 또는 길이를 확인해 주세요.');
  }
  if (!Number.isInteger(selected.duration_seconds) || selected.duration_seconds < 5 || selected.duration_seconds > 120) {
    throw new Error('duration_seconds 항목은 5~120 정수여야 해요.');
  }
}

// v1.3.0 manifest default: 20% intro, 50% play, 30% ending.
function defaultShots(durationSeconds) {
  const first = durationSeconds * 200;
  const last = durationSeconds * 700;
  return [
    { start_ms: 0, end_ms: first, purpose: '도입', direction: '게임 제목 또는 대표 화면으로 시작' },
    { start_ms: first, end_ms: last, purpose: '실제 플레이', direction: '대표 조작과 핵심 플레이 장면을 배치' },
    { start_ms: last, end_ms: durationSeconds * 1000, purpose: '엔딩', direction: '검토된 엔딩 문구 배치' },
  ];
}

function intField(value, label, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(label + ' 항목은 ' + min + '~' + max + ' 정수여야 해요.');
  }
  return value;
}

function mergePartial(input, defaults, ranges, label) {
  if (input === undefined) return { ...defaults };
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(label + ' 항목의 내용 또는 길이를 확인해 주세요.');
  }
  const out = { ...defaults };
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(defaults, key)) {
      throw new Error('지원하지 않는 입력 항목이 있어요.');
    }
    const [min, max] = ranges[key];
    out[key] = intField(value, label + '.' + key, min, max);
  }
  return out;
}

export function planAudio(input) {
  const plan = input.plan;
  let selected;
  let shots;
  if (plan) {
    if (Object.keys(input).some(key => !['plan', 'bpm', 'beats_per_bar', 'mood', 'ducking', 'silence'].includes(key))) {
      throw new Error('컷 구성표 또는 개별 항목 중 하나만 입력해 주세요.');
    }
    if (!plan || typeof plan !== 'object' || plan.schema !== 'bichum.trailer-shot-plan/1') {
      throw new Error('비춤의 컷 구성표 JSON을 입력해 주세요.');
    }
    validatePlanShots(plan);
    selected = { game_title: plan.game_title, format: plan.format, duration_seconds: plan.duration_seconds };
    shots = plan.shots;
  } else {
    selected = { game_title: input.game_title, format: input.format, duration_seconds: input.duration_seconds };
    shots = defaultShots(selected.duration_seconds);
  }
  validateSelected(selected);

  const bpm = input.bpm === undefined ? 120 : intField(input.bpm, 'bpm', 60, 180);
  const beatsPerBar = input.beats_per_bar === undefined ? 4 : input.beats_per_bar;
  if (beatsPerBar !== 3 && beatsPerBar !== 4) {
    throw new Error('beats_per_bar 항목은 3 또는 4여야 해요.');
  }
  const mood = input.mood ?? 'tense';
  if (!MOODS.includes(mood)) {
    throw new Error('mood 항목의 내용 또는 길이를 확인해 주세요.');
  }
  const ducking = mergePartial(input.ducking, DUCKING_DEFAULTS, DUCKING_RANGES, 'ducking');
  const silence = mergePartial(input.silence, SILENCE_DEFAULTS, SILENCE_RANGES, 'silence');

  const durationMs = selected.duration_seconds * 1000;
  const beatMs = Math.round(60000 / bpm);
  const barMs = beatMs * beatsPerBar;

  const beats = [];
  for (let k = 0; k * beatMs < durationMs; k += 1) {
    beats.push({ beat_no: k + 1, ms: k * beatMs });
  }
  const bars = [];
  for (let j = 0; j * barMs < durationMs; j += 1) {
    bars.push({ bar_no: j + 1, start_ms: j * barMs, end_ms: Math.min((j + 1) * barMs, durationMs) });
  }

  // Snap every shot boundary except the first shot's 0 ms start.
  const snappedStarts = [0];
  const cuts = [];
  for (let i = 1; i < shots.length; i += 1) {
    const original = shots[i].start_ms;
    const lower = Math.floor(original / beatMs);
    const lowerMs = lower * beatMs;
    const upperMs = (lower + 1) * beatMs;
    const snappedMs = original - lowerMs <= upperMs - original ? lowerMs : upperMs;
    const shiftMs = Math.abs(snappedMs - original);
    snappedStarts.push(snappedMs);
    cuts.push({
      shot_no: i + 1,
      purpose: shots[i].purpose,
      original_ms: original,
      snapped_ms: snappedMs,
      shift_ms: shiftMs,
      nearest_beat_no: snappedMs / beatMs + 1,
      snapped: shiftMs !== 0,
    });
  }
  // Warn when a snapped shot becomes shorter than 100 ms. The warning
  // attaches to the cuts entry of the short shot itself; shot 1 has no
  // cuts entry, so it attaches to shot 2's entry instead.
  const snappedEnds = [...snappedStarts.slice(1), durationMs];
  for (let i = 0; i < shots.length; i += 1) {
    const length = snappedEnds[i] - snappedStarts[i];
    if (length < 100) {
      const entry = cuts[Math.max(0, i - 1)];
      if (entry) {
        entry.warning = '샷이 너무 짧아져요. BPM을 바꾸거나 컷을 손으로 조정하세요.';
      }
    }
  }

  const levels = shots.map((shot, index) => {
    const base = LEVEL_BASE[shot.purpose] ?? LEVEL_FALLBACK;
    let db = base.db;
    if (mood === 'calm') db -= 2;
    if (mood === 'epic' && shot.purpose === '실제 플레이') db = -12;
    return { shot_no: index + 1, purpose: shot.purpose, music_bed_db: db, note: base.note };
  });

  const notes = ['컷 위치는 가장 가까운 비트로 맞췄어요. 비트 감지는 렌더 환경에서 해요.'];
  const maxShift = cuts.reduce((max, cut) => Math.max(max, cut.shift_ms), 0);
  if (maxShift > 0) {
    notes.push('샷 경계를 비트에 맞췄어요. 원본과 ' + maxShift + 'ms 달라요.');
  }
  notes.push('음악 베드 레벨은 믹스 상대 레벨이에요. 절대 음량이 아니에요.');
  notes.push('BPM은 계획용이에요. 실제 음악과 다르면 렌더 환경이 컷을 다시 맞춰요.');

  return {
    schema: 'bichum.audio-plan/1',
    filename: 'bichum-audio-plan.json',
    game_title: selected.game_title.trim(),
    format: selected.format,
    duration_seconds: selected.duration_seconds,
    bpm,
    beats_per_bar: beatsPerBar,
    mood,
    beat_grid: { beat_ms: beatMs, bar_ms: barMs, beats, bars },
    cuts,
    levels,
    ducking: { ...ducking, note: '대사·내레이션이 들어올 때 BGM을 이 비율로 낮춰요.' },
    loudness: {
      target_lufs: -14,
      true_peak_db: -1.5,
      lra: 11,
      ffmpeg_loudnorm: 'loudnorm=I=-14:TP=-1.5:LRA=11',
    },
    silence_cut: {
      ...silence,
      ffmpeg_silencedetect: 'silencedetect=noise=' + silence.threshold_db + 'dB:d=' + (silence.min_duration_ms / 1000).toFixed(1),
    },
    notes,
    to_be_measured: {
      actual_bpm: null,
      measured_loudness_lufs: null,
      detected_beats: null,
      note: 'librosa로 실제 BPM·비트 위치를 재고, 컷을 다시 맞춰요.',
    },
    status: 'AUDIO_PLAN_ONLY',
  };
}
