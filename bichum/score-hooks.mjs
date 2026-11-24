// Draft for Bichum v1.4.0 — bichum_score_hooks
// Status: DRAFT, not deployed. Prepared 2026-11-23.
// Scores hook drafts (bichum.hook-draft/1) or hand-written hooks with a
// deterministic rubric — 5 criteria x 20 points, no model or LLM — ranks
// them, and runs the Steam microtrailer check when a shot plan is given.
// Like the other Bichum tools it is stateless and renders no video.
// References: ShortsFlow (per-clip score + reason), ShortFormStudio
// (virality 1-10), auto-video-editor (quality gate), Steam microtrailer
// convention — see the research page "비춤 오픈소스 참고 조사"
// (research_notes/bichum-opensource-video-tools-20261123-1338).
//
// Note on the design doc: its test 1 expects the surprise hook to be the top
// pick, but under the rubric as written the question hook scores higher
// (90 vs 80 — the surprise hook scores 0 on specificity: no title, no
// number, no key-message word in its text). This module follows the rubric;
// see README.md "설계안과 달라진 점".

const ANGLES = ['question', 'surprise', 'number', 'empathy', 'direct'];
const ANGLE_LABELS = {
  question: '질문형', surprise: '반전형', number: '숫자형', empathy: '공감형', direct: '지시형',
};
// Action verbs that mark a visible movement in the first 3 seconds.
const ACTION_VERBS = ['보여주', '낙하', '달리', '점프', '추격', '폭발', '부수', '날아', '떨어', '싸우', '도망', '올라', '내려'];
const SCENE_NOUNS = ['장면', '화면', '플레이'];
const AUDIO_WORDS = ['들어보세요', '소리를', '음성'];

const hasDigit = text => /\d/.test(text);
const includesAny = (text, words) => words.some(word => text.includes(word));
// Words of 2+ characters from a text; used only to check whether a word from
// the game title / key message appears verbatim in a hook line.
const wordsOf = text => (text ?? '').split(/[^\p{L}\p{N}]+/gu).filter(word => word.length >= 2);

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

function validateManualHooks(hooks) {
  if (!Array.isArray(hooks) || hooks.length < 1 || hooks.length > 5) {
    throw new Error('manual_hooks 항목 수를 확인해 주세요.');
  }
  for (const [index, hook] of hooks.entries()) {
    const label = (index + 1) + '번 훅';
    if (!hook || typeof hook !== 'object' || Array.isArray(hook)) {
      throw new Error(label + ' 항목의 내용 또는 길이를 확인해 주세요.');
    }
    if (!ANGLES.includes(hook.angle)) {
      throw new Error(label + ' 항목의 내용 또는 길이를 확인해 주세요.');
    }
    if (typeof hook.on_screen_text !== 'string' || !hook.on_screen_text.trim() || hook.on_screen_text.length > 60) {
      throw new Error(label + ' 항목의 내용 또는 길이를 확인해 주세요.');
    }
    if (typeof hook.narration_line !== 'string' || !hook.narration_line.trim() || hook.narration_line.length > 60) {
      throw new Error(label + ' 항목의 내용 또는 길이를 확인해 주세요.');
    }
    if (typeof hook.visual_direction !== 'string' || !hook.visual_direction.trim() || hook.visual_direction.length > 300) {
      throw new Error(label + ' 항목의 내용 또는 길이를 확인해 주세요.');
    }
  }
}

function scoreAngleMatch(hook) {
  const screen = hook.on_screen_text;
  const narration = hook.narration_line;
  const visual = hook.visual_direction;
  switch (hook.angle) {
    case 'question':
      return (screen.includes('?') || includesAny(screen, ['왜', '어떻게', '무엇']))
        ? [20, '질문형 문구에 질문이 들어 있어요.']
        : [10, '질문형인데 화면 문구에 질문이 없어요. ‘왜’나 ‘?’를 넣어 보세요.'];
    case 'number':
      return (hasDigit(screen) || hasDigit(narration))
        ? [20, '숫자형 문구에 숫자가 들어 있어요.']
        : [0, '숫자형인데 문구에 숫자가 없어요. 구체적인 숫자를 넣어 보세요.'];
    case 'surprise':
      return includesAny(visual, ['반전', '놀라운', '예상'])
        ? [20, '반전형 문구가 장면과 맞아요.']
        : [10, '반전형인데 장면 설명에 반전이 드러나지 않아요.'];
    case 'empathy':
      return (includesAny(screen, ['라면', '아는 사람', '기억']) || includesAny(narration, ['라면', '아는 사람', '기억']))
        ? [20, '공감형 문구에 보는 사람을 부르는 말이 있어요.']
        : [10, '공감형인데 보는 사람을 부르는 말이 없어요.'];
    case 'direct':
      return (includesAny(screen, ['확인', '지금', '바로']) || includesAny(narration, ['확인', '지금', '바로']))
        ? [20, '지시형 문구에 행동을 부르는 말이 있어요.']
        : [10, '지시형인데 행동을 부르는 말이 없어요.'];
    default:
      return [0, '훅 각도를 확인해 주세요.'];
  }
}

function scoreLength(hook) {
  const screenLen = hook.on_screen_text.length;
  const narrationLen = hook.narration_line.length;
  const screenScore = screenLen <= 24 ? 20 : screenLen <= 30 ? 10 : 0;
  const narrationScore = narrationLen <= 30 ? 20 : narrationLen <= 40 ? 10 : 0;
  const score = Math.min(screenScore, narrationScore);
  const reason = '화면 문구 ' + screenLen + '자, 내레이션 ' + narrationLen + '자 — ' +
    (score === 20 ? '둘 다 제한 안이에요.'
      : score === 10 ? '한쪽이 제한을 살짝 넘었어요. 화면 문구는 24자, 내레이션은 30자 안에 줄여 보세요.'
        : '제한을 많이 넘었어요. 화면 문구는 24자, 내레이션은 30자 안에 줄여 보세요.');
  return [score, reason];
}

function scoreSpecificity(hook, gameTitle, keyMessage) {
  if (!gameTitle) return null;
  const text = hook.on_screen_text + ' ' + hook.narration_line;
  let score = 0;
  const parts = [];
  if (text.includes(gameTitle)) {
    score += 8;
    parts.push('게임 제목이 들어 있어요');
  }
  if (hasDigit(text)) {
    score += 6;
    parts.push('숫자가 들어 있어요');
  }
  const candidates = [...new Set([...wordsOf(gameTitle), ...wordsOf(keyMessage)])];
  const hit = candidates.find(word => text.includes(word));
  if (hit) {
    score += 6;
    parts.push('‘' + hit + '’ 같은 고유한 단어가 들어 있어요');
  }
  return [score, parts.length ? parts.join('. ') + '.' : '게임 제목·숫자·고유한 단어가 없어요. 제목이나 숫자를 넣어 보세요.'];
}

function scoreVisualAction(hook) {
  const visual = hook.visual_direction;
  if (includesAny(visual, ACTION_VERBS)) return [20, '첫 3초에 움직임이 보이는 장면이 적혀 있어요.'];
  if (includesAny(visual, SCENE_NOUNS)) return [10, '장면은 적혀 있지만 움직임이 드러나지 않아요. 동작을 넣어 보세요.'];
  return [0, '첫 3초에 뭘 보여줄지 장면 설명이 없어요.'];
}

function scoreSoundOff(hook) {
  const screen = hook.on_screen_text;
  if (includesAny(screen, AUDIO_WORDS)) return [0, '‘소리를 들어보세요’ 같은 말은 소리를 끈 사람에게 안 통해요.'];
  if (screen.length < 4) return [10, '화면 문구가 너무 짧아서 내용만으로 이해하기 어려워요.'];
  return [20, '소리를 꺼도 문구만으로 내용이 통해요.'];
}

function scoreOne(hook, gameTitle, keyMessage) {
  const criteria = [];
  const [angleScore, angleReason] = scoreAngleMatch(hook);
  criteria.push({ name: 'angle_match', score: angleScore, max: 20, reason: angleReason });
  const [lengthScore, lengthReason] = scoreLength(hook);
  criteria.push({ name: 'length', score: lengthScore, max: 20, reason: lengthReason });
  const specificity = scoreSpecificity(hook, gameTitle, keyMessage);
  if (specificity) {
    criteria.push({ name: 'specificity', score: specificity[0], max: 20, reason: specificity[1] });
  } else {
    criteria.push({
      name: 'specificity', score: null, max: 20, not_scored: true,
      reason: '게임 제목이 없어서 구체성은 채점하지 않았어요.',
    });
  }
  const [visualScore, visualReason] = scoreVisualAction(hook);
  criteria.push({ name: 'visual_action', score: visualScore, max: 20, reason: visualReason });
  const [soundScore, soundReason] = scoreSoundOff(hook);
  criteria.push({ name: 'sound_off', score: soundScore, max: 20, reason: soundReason });
  const total = criteria.reduce((sum, item) => sum + (item.score ?? 0), 0);
  const band = total >= 80 ? 'strong' : total >= 60 ? 'usable' : 'revise';
  return { criteria, total, band };
}

// Steam builds a 6-second looping microtrailer from six 1-second slices of
// the first trailer. A slice reads alone when its shot changes purpose
// inside the slice, or its direction has a keyword no other slice shares.
function steamCheck(plan) {
  const note = 'Steam은 첫 트레일러에서 1초씩 6개를 골라 6초짜리 반복 마이크로트레일러를 만들어요.';
  if (!plan) {
    return { checked: false, verdict: null, slices: [], note };
  }
  validatePlanShots(plan);
  const slices = [];
  for (let second = 0; second < 6; second++) {
    const start = second * 1000;
    const end = start + 1000;
    const shot = plan.shots.find(item => item.start_ms <= start && item.end_ms > start);
    if (!shot) {
      slices.push({ second, purpose: null, readable_alone: false, reason: '이 구간에 샷이 없어요.' });
      continue;
    }
    const boundary = plan.shots.some(item => item.start_ms > start && item.start_ms < end);
    const myWords = new Set(wordsOf(shot.direction));
    // Keywords are compared against the other slices, not other shots: a
    // slice whose shot also fills another slice shares that direction, so
    // its keywords are not unique.
    const otherSliceWords = [];
    for (let other = 0; other < 6; other++) {
      if (other === second) continue;
      const otherShot = plan.shots.find(item => item.start_ms <= other * 1000 && item.end_ms > other * 1000);
      if (otherShot) otherSliceWords.push(...wordsOf(otherShot.direction));
    }
    const unique = [...myWords].some(word => !otherSliceWords.includes(word));
    const readable = boundary || unique;
    slices.push({
      second,
      purpose: shot.purpose,
      readable_alone: readable,
      ...(readable ? {} : { reason: '같은 장면이 이어져서 1초만으로는 구분이 안 돼요.' }),
    });
  }
  const trueCount = slices.filter(item => item.readable_alone).length;
  const verdict = trueCount >= 4 ? 'PASS' : trueCount >= 2 ? 'WARN' : 'FAIL';
  return { checked: true, verdict, slices, note };
}

export function scoreHooks(input) {
  const hasHooks = input.hooks !== undefined;
  const hasManual = input.manual_hooks !== undefined;
  if (hasHooks && hasManual) {
    throw new Error('훅 초안 또는 직접 입력 중 하나만 넣어 주세요.');
  }
  if (!hasHooks && !hasManual) {
    throw new Error('훅 초안 JSON 또는 직접 입력 중 하나를 넣어 주세요.');
  }
  let hooks;
  let gameTitle = typeof input.game_title === 'string' ? input.game_title.trim() : '';
  let format = input.format ?? null;
  let keyMessage = '';
  if (hasHooks) {
    const draft = input.hooks;
    if (!draft || typeof draft !== 'object' || Array.isArray(draft) || draft.schema !== 'bichum.hook-draft/1') {
      throw new Error('훅 초안 JSON을 입력해 주세요.');
    }
    if (!Array.isArray(draft.hooks) || !draft.hooks.length) {
      throw new Error('훅 초안에 훅이 없어요. 훅 초안부터 다시 만들어 주세요.');
    }
    hooks = draft.hooks;
    if (!gameTitle) gameTitle = typeof draft.game_title === 'string' ? draft.game_title.trim() : '';
    if (!format) format = draft.format ?? null;
    keyMessage = typeof draft.key_message === 'string' ? draft.key_message.trim() : '';
  } else {
    validateManualHooks(input.manual_hooks);
    hooks = input.manual_hooks;
  }
  if (input.plan !== undefined) {
    if (!input.plan || typeof input.plan !== 'object' || input.plan.schema !== 'bichum.trailer-shot-plan/1') {
      throw new Error('비춤의 컷 구성표 JSON을 입력해 주세요.');
    }
  }

  const scored = hooks.map((hook, index) => {
    const item = {
      id: hook.id ?? 'hook-' + (index + 1),
      angle: hook.angle,
      on_screen_text: (hook.on_screen_text ?? '').trim(),
      narration_line: (hook.narration_line ?? '').trim(),
      visual_direction: (hook.visual_direction ?? '').trim(),
    };
    const result = scoreOne(item, gameTitle, keyMessage);
    return { ...item, label: ANGLE_LABELS[item.angle] ?? item.angle, ...result, order: index };
  });
  scored.sort((a, b) => b.total - a.total || a.order - b.order);
  const ranked = scored.map((item, index) => ({
    rank: index + 1,
    id: item.id,
    angle: item.angle,
    label: item.label,
    score: item.total,
    band: item.band,
    criteria: item.criteria,
    on_screen_text: item.on_screen_text,
    narration_line: item.narration_line,
    visual_direction: item.visual_direction,
  }));
  const notes = ['점수는 규칙으로 계산한 초안 점수예요. 실제 반응(유지율)은 렌더·게시 뒤에 확인해요.'];
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
    notes.push('1위 동점이 있어요. 먼저 나온 훅을 골랐어요.');
  }
  const steam = steamCheck(input.plan);
  if (!steam.checked) {
    notes.push('컷 구성표가 없어서 Steam 검사는 건너뛰었어요.');
  }
  const specificityScored = ranked.length > 0 && ranked[0].criteria.some(item => item.name === 'specificity' && !item.not_scored);
  const output = {
    schema: 'bichum.hook-score/1',
    filename: 'bichum-hook-scores.json',
    game_title: gameTitle,
    format,
    ranked,
    top_pick: { id: ranked[0].id, angle: ranked[0].angle, score: ranked[0].score },
    steam_microtrailer_check: steam,
    notes,
    to_be_measured: {
      retention: '게시 뒤 3초 유지율로 채울 것',
      ctr: '게시 뒤 클릭률로 채울 것',
    },
    status: 'SCORE_ONLY',
  };
  if (!specificityScored) output.max_score = 80;
  return output;
}
