// Draft for Bichum v1.6.0 — bichum_draft_narration
// Status: DRAFT, not deployed. Prepared 2026-11-24.
// Builds a per-shot narration script and a TTS timing plan (timings.json
// shape) from a shot plan or manual input. It never synthesises audio:
// estimated lengths come from a deterministic speaking-rate rule, and the
// render environment fills in actual_ms / actual_start_ms / audio_file
// after Kokoro-82M synthesis, and WhisperX fills in real word times.
//
// Deterministic rules (from draft-next-features/DESIGN.md #3):
//   - Korean: estimated_ms = ceil(non-space chars / 5.5 * 1000)
//     (about 330 chars/min). English: ceil(words / 2.5 * 1000)
//     (about 150 words/min).
//   - speaking_rate: estimated_ms = round(base * 100 / rate / 50) * 50
//     (50 ms steps), then a 500 ms floor per line.
//   - Placement: first line starts 500 ms into its shot (the 0.5 s hook
//     lead-in); later lines start 300 ms after the previous line ends,
//     never before their own shot starts.
//   - Silence: 500 ms lead-in + 300 ms after every line.
//   - fits: estimated_ms + 300 ms <= shot length, else fits: false with
//     overflow_ms. estimated_ms over 2x the shot length is an error.
//   - Auto script (when lines are not given), one line per shot:
//     도입 -> "{game_title}, {key_message first 40 chars}" (or
//     "{game_title}, 3초만 봐요" without a key message); 실제 플레이 ->
//     key_message (cut at 200 chars) or "대표 플레이 장면을 보여줄게요";
//     엔딩 -> call_to_action or "지금 바로 확인해요". Other purposes fall
//     back to the 실제 플레이 rule.
//   - Alignment is script-forced WhisperX: the screen text is the script
//     verbatim, only the timings are aligned, so there are no ASR typos.
//
// Notes on the design doc (see README.md "설계안과 달라진 점"):
//   - The design example shows nar-01 with start_ms 0 / end_ms 6400 and
//     total_silence_ms 7200, which do not follow its own rules (first line
//     starts shot.start + 500 ms, end_ms = start_ms + estimated_ms,
//     silence = 500 + 300 per line). This module follows the rules.
//   - With the real 다시, 놀이터 plan, the auto 도입 line is 6350 ms, so
//     6350 + 300 > 6400: nar-01 is fits: false (overflow 250 ms). The
//     design's test 1 expects all lines to fit, but that was computed
//     against a shorter assumed key message. fits: false is a warning,
//     not an error, and the line is still emitted.
//   - Manual mode has no shot plan, so shots use the v1.3.0 manifest
//     default (20% intro / 50% play / 30% ending); the design does not
//     specify manual-mode shots.

const LANGUAGES = ['ko', 'en'];
const TTS_ENGINES = ['kokoro', 'edge-tts'];

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

function estimateMs(text, language, speakingRate) {
  let base;
  if (language === 'en') {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    base = Math.ceil((words / 2.5) * 1000);
  } else {
    const chars = [...text.replace(/\s/g, '')].length;
    base = Math.ceil((chars / 5.5) * 1000);
  }
  const rated = Math.round((base * 100) / speakingRate / 50) * 50;
  return Math.max(500, rated);
}

function autoText(shot, game, keyMessage, callToAction) {
  const key = typeof keyMessage === 'string' ? keyMessage.trim() : '';
  const cta = typeof callToAction === 'string' ? callToAction.trim() : '';
  if (shot.purpose === '도입') {
    return key ? game + ', ' + key.slice(0, 40) : game + ', 3초만 봐요';
  }
  if (shot.purpose === '엔딩') {
    return cta || '지금 바로 확인해요';
  }
  // '실제 플레이' and any other purpose.
  return key ? key.slice(0, 200) : '대표 플레이 장면을 보여줄게요';
}

export function draftNarration(input) {
  const plan = input.plan;
  let selected;
  let shots;
  let keyMessage;
  let callToAction;
  if (plan) {
    if (Object.keys(input).some(key => !['plan', 'lines', 'tts_engine', 'language', 'speaking_rate'].includes(key))) {
      throw new Error('컷 구성표 또는 개별 항목 중 하나만 입력해 주세요.');
    }
    if (!plan || typeof plan !== 'object' || plan.schema !== 'bichum.trailer-shot-plan/1') {
      throw new Error('비춤의 컷 구성표 JSON을 입력해 주세요.');
    }
    validatePlanShots(plan);
    selected = { game_title: plan.game_title, format: plan.format, duration_seconds: plan.duration_seconds };
    shots = plan.shots;
    keyMessage = plan.key_message;
    callToAction = plan.call_to_action;
  } else {
    selected = { game_title: input.game_title, format: input.format, duration_seconds: input.duration_seconds };
    shots = defaultShots(selected.duration_seconds);
    keyMessage = input.key_message;
    callToAction = input.call_to_action;
  }
  validateSelected(selected);
  if (keyMessage !== undefined && (typeof keyMessage !== 'string' || keyMessage.length > 500)) {
    throw new Error('key_message 항목의 내용 또는 길이를 확인해 주세요.');
  }
  if (callToAction !== undefined && (typeof callToAction !== 'string' || callToAction.length > 200)) {
    throw new Error('call_to_action 항목의 내용 또는 길이를 확인해 주세요.');
  }

  const language = input.language ?? 'ko';
  if (!LANGUAGES.includes(language)) {
    throw new Error('language 항목의 내용 또는 길이를 확인해 주세요.');
  }
  const speakingRate = input.speaking_rate ?? 100;
  if (!Number.isInteger(speakingRate) || speakingRate < 80 || speakingRate > 120) {
    throw new Error('speaking_rate 항목은 80~120 정수여야 해요.');
  }
  const ttsEngine = input.tts_engine ?? 'kokoro';
  if (!TTS_ENGINES.includes(ttsEngine)) {
    throw new Error('tts_engine 항목의 내용 또는 길이를 확인해 주세요.');
  }

  const game = selected.game_title.trim();
  let scripted;
  let auto = false;
  if (input.lines !== undefined) {
    if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 40) {
      throw new Error('lines 항목 수를 확인해 주세요.');
    }
    const seen = new Set();
    scripted = input.lines.map((line, index) => {
      const label = (index + 1) + '번 대본';
      if (!line || typeof line !== 'object' || Array.isArray(line)) {
        throw new Error(label + ' 항목의 내용 또는 길이를 확인해 주세요.');
      }
      if (!Number.isInteger(line.shot_no) || line.shot_no < 1 || line.shot_no > shots.length) {
        throw new Error(label + '의 샷 번호가 컷 구성표 범위를 벗어났어요.');
      }
      if (seen.has(line.shot_no)) {
        throw new Error('한 샷에는 내레이션 한 줄만 넣을 수 있어요.');
      }
      seen.add(line.shot_no);
      if (typeof line.text !== 'string' || !line.text.trim() || line.text.trim().length > 200) {
        throw new Error(label + ' 항목의 내용 또는 길이를 확인해 주세요.');
      }
      return { shot_no: line.shot_no, text: line.text.trim() };
    });
    scripted.sort((a, b) => a.shot_no - b.shot_no);
  } else {
    auto = true;
    scripted = shots.map((shot, index) => ({
      shot_no: index + 1,
      text: autoText(shot, game, keyMessage, callToAction),
    }));
  }

  const lines = [];
  let previousEnd = null;
  for (const [index, item] of scripted.entries()) {
    const shot = shots[item.shot_no - 1];
    const shotLength = shot.end_ms - shot.start_ms;
    const estimated = estimateMs(item.text, language, speakingRate);
    if (estimated > 2 * shotLength) {
      throw new Error('내레이션이 샷보다 너무 길어요. 문구를 줄이거나 샷을 늘려 주세요.');
    }
    const start = index === 0
      ? shot.start_ms + 500
      : Math.max(shot.start_ms, previousEnd + 300);
    const fits = estimated + 300 <= shotLength;
    lines.push({
      line_id: 'nar-' + String(index + 1).padStart(2, '0'),
      shot_no: item.shot_no,
      start_ms: start,
      end_ms: start + estimated,
      text: item.text,
      ...(language === 'en'
        ? { words: item.text.trim().split(/\s+/).filter(Boolean).length }
        : { chars: [...item.text.replace(/\s/g, '')].length }),
      estimated_ms: estimated,
      fits,
      overflow_ms: fits ? 0 : estimated + 300 - shotLength,
      to_be_measured: { actual_ms: null, actual_start_ms: null, audio_file: null },
    });
    previousEnd = start + estimated;
  }

  const totalEstimated = lines.reduce((sum, line) => sum + line.estimated_ms, 0);
  const notes = [
    '예상 길이는 말하기 속도 규칙으로 계산한 값이에요. 실제 합성 길이는 렌더 환경에서 채워요.',
    'Kokoro-82M은 Apache-2.0이라 상업 이용이 가능해요. Edge-TTS는 상업 이용 권한이 명확하지 않으니 Kokoro를 우선 쓰세요.',
    'WhisperX 단어 정렬 오차는 보고서 기준 100ms 미만(세그먼트 단위는 약 1초)이에요.',
  ];
  if (auto) notes.push('자동 생성 문구예요. 그대로 쓰지 말고 다듬어 주세요.');
  if (ttsEngine === 'edge-tts') {
    notes.push('Edge-TTS를 골랐어요. 상업 이용 권한이 명확하지 않으니 실제 합성과 권리 확인은 렌더 환경에서 해 주세요.');
  }

  return {
    schema: 'bichum.narration-plan/1',
    filename: 'bichum-narration.json',
    game_title: game,
    format: selected.format,
    duration_seconds: selected.duration_seconds,
    language,
    speaking_rate: speakingRate,
    tts_engine: ttsEngine,
    lines,
    total_estimated_ms: totalEstimated,
    total_silence_ms: 500 + 300 * lines.length,
    tts_timings: lines.map(line => ({
      line_id: line.line_id,
      text: line.text,
      estimated_start_ms: line.start_ms,
      estimated_duration_ms: line.estimated_ms,
    })),
    alignment: {
      engine: 'whisperx',
      mode: 'script-forced',
      source_text: lines.map(line => line.text),
      note: '화면에 나오는 문구는 이 대본 그대로 쓰고, 시간만 WhisperX로 맞추면 오타가 없어요.',
    },
    notes,
    status: 'SCRIPT_ONLY',
  };
}
