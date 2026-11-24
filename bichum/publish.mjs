// Draft for Bichum v1.7.0 — bichum_plan_publish
// Status: DRAFT, not deployed. Prepared 2026-11-24.
// Picks thumbnail candidate frames around a peak moment, checks overlay
// text against the shared safe box, cross-checks the six Steam capsule
// sizes, and bundles per-platform titles, descriptions, hashtags and
// chapters into a publish pack. It never uploads anything and never looks
// at actual frames: candidate times are computed, frame extraction and
// sharpness/exposure measurement stay in the render environment.
//
// Deterministic rules (from draft-v1.7.0/DESIGN.md #6, which follows
// draft-next-features/DESIGN.md #6):
//   - Peak: input peak_ms, else the middle of the longest '실제 플레이'
//     shot, else 70% of the duration.
//   - Candidates: offsets [-1000, -500, 0, +500, +1000] ms from the peak,
//     clipped to [0, duration]. Base score 100/85/70 by |offset|, +10 when
//     the candidate sits inside a '실제 플레이' shot (capped at 100).
//     Recommended is the highest score; ties go to the candidate closest
//     to the peak, then the earlier one.
//   - Overlay text: no position input, so the rect is estimated — one
//     Korean char is 0.6 x font_px wide, height is 1.3 x font_px, centered
//     horizontally, top at the caption band (55% of canvas height).
//     font_px defaults to 64 (same as the #7 word-caption Style).
//     The rect is checked against universalBoxPx(format) from
//     safe-zones.mjs (shared constants, never duplicated here); outside
//     it, a clamped `corrected` rect is given, same formula as
//     safe-zone-check.mjs.
//   - Steam capsules: six fixed sizes, verified 2026-11-24 against
//     Steamworks Graphical Assets docs as read by three 2026 guides
//     (immutable.com, games.gg, steampageanalyzer.com). Width under 500 px
//     means text_safe false. Since September 2022 base capsules may only
//     show artwork, the game name and an official subtitle — so an
//     overlay_text that is not the game title warns on every capsule.
//   - Titles: YouTube "{game} — {key first 60 chars}" (or "{game} |
//     게임 트레일러" without a key message), TikTok/Instagram
//     "{game}: {key first 40 chars}", X "{game} — {key first 40 chars}",
//     Steam writes no title. YouTube titles over 100 chars are cut with
//     title_truncated: true.
//   - Length limits are design defaults, re-check at publish time:
//     YouTube title 100 / description 5000, TikTok description 2200,
//     Instagram description 2200, X post 280.
//   - Hashtags: game slug + first 2 nouns from key_message + #게임트레일러.
//     Nouns are picked deterministically: split on spaces/punctuation,
//     strip one particle suffix (longest first), drop tokens under 2 chars
//     and stopwords, take the first 2 in order.
//   - Chapters: input chapters verbatim, else built from shot purposes
//     ("0:00 도입" style, same rule as the v1.3.0 manifest).
//
// Notes on the design doc:
//   - The design's capsule aspect table (Main 1.74) does not match
//     rounding (1232/706 = 1.745 -> 1.75). The table is the fixed spec,
//     so the aspect values are encoded exactly as listed.
//   - The design's particle list has no question ending. "노는가?" would
//     strip to "노는" and be picked as the second noun, but the design's
//     own example expects #로블록스 and #친구. This module also strips
//     '는가'/'은가' (longest first), so "노는가" becomes "노" (1 char,
//     dropped by the length rule) and the example output holds.

import {
  CANVAS,
  CAPTION_BAND,
  normalizedToPx,
  universalBoxPx,
} from './safe-zones.mjs';

const PLATFORMS = ['youtube', 'tiktok', 'instagram', 'x', 'steam'];
const DESCRIPTION_LIMITS = { youtube: 5000, tiktok: 2200, instagram: 2200, x: 280 };
const TITLE_LIMIT = 100;

// Six fixed Steam capsule sizes (Steamworks Graphical Assets, verified
// 2026-11-24). Aspect values are the design table's, not recomputed.
const STEAM_CAPSULES = [
  { name: 'Header', size: '920×430', width: 920, height: 430, aspect: 2.14 },
  { name: 'Small', size: '462×174', width: 462, height: 174, aspect: 2.66 },
  { name: 'Main', size: '1232×706', width: 1232, height: 706, aspect: 1.74 },
  { name: 'Vertical', size: '748×896', width: 748, height: 896, aspect: 0.83 },
  { name: 'Library', size: '600×900', width: 600, height: 900, aspect: 0.67 },
  { name: 'Library Hero', size: '3840×1240', width: 3840, height: 1240, aspect: 3.10 },
];

const STEAM_TEXT_WARNING = 'Steam 캡슐에는 게임 이름·공식 부제 외의 문구를 넣을 수 없어요.';

// Particle suffixes, longest first. '는가'/'은가' are question endings:
// stripping them leaves a 1-char stem, which the length rule drops.
const PARTICLES = [
  '에서', '으로', '에게', '한테', '까지', '부터', '이랑', '는가', '은가',
  '은', '는', '이', '가', '을', '를', '의', '와', '과', '에', '로', '도', '만', '아', '야',
];
const STOPWORDS = new Set([
  '왜', '어떻게', '무엇', '이것', '저것', '그것', '그리고', '하지만',
  '또', '더', '잘', '많이', '다시', '어른들',
]);

// Local slug for hashtags: strip everything that is not a letter or digit.
// Unlike the studio-tools slug (which joins with '-'), a hashtag has no
// hyphen: '다시, 놀이터' -> '다시놀이터'.
function slug(value) {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '') || 'game';
}

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

function chapterClock(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  return minutes + ':' + seconds;
}

function buildChapters(shots) {
  return shots.map(shot => chapterClock(shot.start_ms) + ' ' + shot.purpose.trim()).join('\n');
}

function clampIntoBox(rect, box) {
  const x = Math.max(box.x, Math.min(rect.x, box.x + box.w - rect.w));
  const y = Math.max(box.y, Math.min(rect.y, box.y + box.h - rect.h));
  return { x, y, w: rect.w, h: rect.h };
}

function fullyInside(rect, box) {
  return rect.x >= box.x && rect.y >= box.y &&
    rect.x + rect.w <= box.x + box.w && rect.y + rect.h <= box.y + box.h;
}

function stripParticle(token) {
  for (const particle of PARTICLES) {
    if (token.length > particle.length && token.endsWith(particle)) {
      return token.slice(0, -particle.length);
    }
  }
  return token;
}

function pickNouns(keyMessage, count) {
  const picked = [];
  for (const raw of keyMessage.split(/[\s,?!.]+/u)) {
    if (!raw) continue;
    const word = stripParticle(raw);
    if (word.length < 2 || STOPWORDS.has(word) || picked.includes(word)) continue;
    picked.push(word);
    if (picked.length >= count) break;
  }
  return picked;
}

function buildHashtags(gameTitle, keyMessage) {
  const tags = ['#' + slug(gameTitle)];
  if (keyMessage) {
    for (const noun of pickNouns(keyMessage, 2)) {
      tags.push('#' + noun.replace(/[^\p{L}\p{N}]+/gu, ''));
    }
  }
  tags.push('#게임트레일러');
  return tags.slice(0, 5);
}

function buildTitle(platform, gameTitle, keyMessage) {
  const key = (keyMessage ?? '').trim();
  if (platform === 'steam') return null;
  if (platform === 'youtube') {
    return key ? gameTitle + ' — ' + key.slice(0, 60) : gameTitle + ' | 게임 트레일러';
  }
  if (platform === 'tiktok' || platform === 'instagram') {
    return key ? gameTitle + ': ' + key.slice(0, 40) : gameTitle + ' | 게임 트레일러';
  }
  // x
  return key ? gameTitle + ' — ' + key.slice(0, 40) : gameTitle + ' | 게임 트레일러';
}

export function planPublish(input) {
  const plan = input.plan;
  let selected;
  let shots;
  let keyMessage;
  let callToAction;
  if (plan) {
    if (Object.keys(input).some(key => !['plan', 'peak_ms', 'platforms', 'overlay_text', 'overlay_font_px', 'chapters', 'key_message', 'call_to_action'].includes(key))) {
      throw new Error('컷 구성표 또는 개별 항목 중 하나만 입력해 주세요.');
    }
    if (!plan || typeof plan !== 'object' || plan.schema !== 'bichum.trailer-shot-plan/1') {
      throw new Error('비춤의 컷 구성표 JSON을 입력해 주세요.');
    }
    validatePlanShots(plan);
    selected = { game_title: plan.game_title, format: plan.format, duration_seconds: plan.duration_seconds };
    shots = plan.shots;
    keyMessage = input.key_message !== undefined ? input.key_message : (plan.key_message ?? '');
    callToAction = input.call_to_action !== undefined ? input.call_to_action : (plan.call_to_action ?? '');
  } else {
    selected = { game_title: input.game_title, format: input.format, duration_seconds: input.duration_seconds };
    shots = defaultShots(selected.duration_seconds);
    keyMessage = input.key_message ?? '';
    callToAction = input.call_to_action ?? '';
  }
  validateSelected(selected);
  if (typeof keyMessage !== 'string' || keyMessage.length > 500) {
    throw new Error('key_message 항목의 내용 또는 길이를 확인해 주세요.');
  }
  if (typeof callToAction !== 'string' || callToAction.length > 200) {
    throw new Error('call_to_action 항목의 내용 또는 길이를 확인해 주세요.');
  }
  const key = keyMessage.trim();

  const durationMs = selected.duration_seconds * 1000;
  const peakMs = input.peak_ms;
  if (peakMs !== undefined && (!Number.isInteger(peakMs) || peakMs < 0 || peakMs > durationMs)) {
    throw new Error('peak_ms 항목은 0~' + durationMs + ' 정수여야 해요.');
  }

  const platforms = input.platforms ?? ['youtube'];
  if (!Array.isArray(platforms) || platforms.length < 1 || platforms.length > 5) {
    throw new Error('platforms 항목 수를 확인해 주세요.');
  }
  for (const platform of platforms) {
    if (!PLATFORMS.includes(platform)) {
      throw new Error('platforms 항목의 내용 또는 길이를 확인해 주세요.');
    }
  }
  if (new Set(platforms).size !== platforms.length) {
    throw new Error('platforms 항목이 중복됐어요.');
  }

  const overlayText = input.overlay_text !== undefined ? input.overlay_text : '';
  if (typeof overlayText !== 'string' || overlayText.length > 40) {
    throw new Error('overlay_text 항목의 내용 또는 길이를 확인해 주세요.');
  }
  const overlayFontPx = input.overlay_font_px ?? 64;
  if (!Number.isInteger(overlayFontPx) || overlayFontPx < 16 || overlayFontPx > 200) {
    throw new Error('overlay_font_px 항목은 16~200 정수여야 해요.');
  }
  const chaptersInput = input.chapters !== undefined ? input.chapters : '';
  if (typeof chaptersInput !== 'string' || chaptersInput.length > 2000) {
    throw new Error('chapters 항목의 내용 또는 길이를 확인해 주세요.');
  }

  const game = selected.game_title.trim();
  const canvas = CANVAS[selected.format];
  const box = universalBoxPx(selected.format);

  // Peak: user value, else the middle of the longest '실제 플레이' shot,
  // else 70% of the duration.
  let peak;
  let peakSource;
  if (peakMs !== undefined) {
    peak = peakMs;
    peakSource = 'user';
  } else {
    const playShots = shots.filter(shot => shot.purpose === '실제 플레이');
    if (playShots.length) {
      const longest = playShots.reduce((a, b) => (b.end_ms - b.start_ms) > (a.end_ms - a.start_ms) ? b : a);
      peak = Math.round((longest.start_ms + longest.end_ms) / 2);
      peakSource = 'auto-longest-play-shot';
    } else {
      peak = Math.round(durationMs * 0.7);
      peakSource = 'auto-70pct';
    }
  }

  // Candidates: peak +-1000/500/0 ms, clipped to the video, scored by
  // distance with a +10 bonus inside a '실제 플레이' shot (capped at 100).
  const playShots = shots.filter(shot => shot.purpose === '실제 플레이');
  const inPlayShot = (ms) => playShots.some(shot => ms >= shot.start_ms && ms < shot.end_ms);
  const candidates = [-1000, -500, 0, 500, 1000]
    .map(offset => ({ offset_ms: offset, ms: peak + offset }))
    .filter(item => item.ms >= 0 && item.ms <= durationMs)
    .map(item => {
      const base = item.offset_ms === 0 ? 100 : Math.abs(item.offset_ms) === 500 ? 85 : 70;
      const score = Math.min(100, base + (inPlayShot(item.ms) ? 10 : 0));
      return { offset_ms: item.offset_ms, ms: item.ms, score };
    });
  const recommended = candidates.reduce((best, item) => {
    if (!best) return item;
    if (item.score !== best.score) return item.score > best.score ? item : best;
    if (Math.abs(item.ms - peak) !== Math.abs(best.ms - peak)) {
      return Math.abs(item.ms - peak) < Math.abs(best.ms - peak) ? item : best;
    }
    return item.ms < best.ms ? item : best;
  }, null);

  // Overlay text: estimated rect (no position input). Width is chars x
  // 0.6 x font_px, height is 1.3 x font_px, centered horizontally, top at
  // the caption band (55% of canvas height).
  let overlay = null;
  const overlayTrimmed = overlayText.trim();
  if (overlayTrimmed) {
    const chars = [...overlayTrimmed].length;
    const rect = {
      x: Math.floor((canvas.width - Math.round(chars * 0.6 * overlayFontPx)) / 2),
      y: normalizedToPx(Math.round(CAPTION_BAND.top * 1000), canvas.height),
      w: Math.round(chars * 0.6 * overlayFontPx),
      h: Math.round(1.3 * overlayFontPx),
    };
    const inside = fullyInside(rect, box);
    let note = inside
      ? '문구는 공통 안전 박스 안에 넣었어요.'
      : '문구가 공통 안전 박스 밖으로 나갔어요. 박스 안으로 옮긴 위치를 corrected에 적었어요.';
    if (rect.w > box.w) {
      note += ' 문구가 박스보다 넓어요. 문구를 줄이거나 글자를 작게 해 주세요.';
    }
    note += ' 문구 크기는 글자 수로 추정한 값이에요. 실제 폰트로 다시 확인해 주세요.';
    overlay = {
      text: overlayTrimmed,
      rect,
      inside_safe_zone: inside,
      corrected: inside ? null : clampIntoBox(rect, box),
      note,
    };
  }

  // Steam capsules: only when steam is a publish target.
  const hasSteam = platforms.includes('steam');
  const steamCapsules = hasSteam ? STEAM_CAPSULES.map(capsule => {
    const entry = {
      name: capsule.name,
      size: capsule.size,
      aspect: capsule.aspect,
      text_safe: capsule.width >= 500,
    };
    if (!entry.text_safe) entry.reason = '작은 캡슐에서는 문구가 잘 안 보여요.';
    if (capsule.name === 'Library Hero') entry.note = '라이브러리 히어로는 아트만, 로고는 따로 얹어요.';
    if (overlayTrimmed && overlayTrimmed !== game) entry.warning = STEAM_TEXT_WARNING;
    return entry;
  }) : [];

  const chapters = chaptersInput.trim() ? chaptersInput.trim() : buildChapters(shots);
  const hashtags = buildHashtags(game, key);

  const publish = platforms.map(platform => {
    const rawTitle = buildTitle(platform, game, key);
    let title = rawTitle;
    let titleTruncated = false;
    if (rawTitle !== null && platform === 'youtube' && rawTitle.length > TITLE_LIMIT) {
      title = rawTitle.slice(0, TITLE_LIMIT);
      titleTruncated = true;
    }
    let description = key ? key + '\n\n챕터:\n' + chapters : chapters;
    let descriptionTruncated = false;
    const descriptionLimit = DESCRIPTION_LIMITS[platform];
    if (descriptionLimit !== undefined && description.length > descriptionLimit) {
      description = description.slice(0, descriptionLimit);
      descriptionTruncated = true;
    }
    const entry = {
      platform,
      title,
      title_length: title === null ? null : title.length,
      title_limit: platform === 'youtube' ? TITLE_LIMIT : null,
      title_truncated: titleTruncated,
      description,
      description_truncated: descriptionTruncated,
      hashtags,
      chapters,
    };
    if (platform === 'steam') entry.note = 'Steam은 제목을 쓰지 않고 캡슐만 검사해요.';
    return entry;
  });

  const notes = ['제목·설명 길이 제한은 게시 시점에 플랫폼 문서에서 다시 확인해 주세요.'];
  if (hasSteam && overlayTrimmed) {
    notes.push('Steam 썸네일은 텍스트 없는 프레임을 권장해요.');
  }
  if (hasSteam) {
    notes.push('Steam 라이브러리 히어로의 중앙 860×380 영역은 로고가 들어가는 안전 영역이에요.');
  }

  return {
    schema: 'bichum.publish-pack/1',
    filename: 'bichum-publish-pack.json',
    game_title: game,
    format: selected.format,
    duration_seconds: selected.duration_seconds,
    thumbnail: {
      peak_ms: peak,
      peak_source: peakSource,
      candidates,
      recommended_ms: recommended.ms,
      overlay,
      steam_capsules: steamCapsules,
    },
    publish,
    notes,
    to_be_measured: {
      frame_extraction: '렌더 환경이 후보 시간의 프레임을 뽑아 선명도·노출을 재요.',
      upload: '실제 업로드·예약은 게시자가 직접 해요.',
    },
    status: 'PUBLISH_PLAN_ONLY',
  };
}
