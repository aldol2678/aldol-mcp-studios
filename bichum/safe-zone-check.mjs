// Draft for Bichum v1.4.0 — bichum_check_safe_zones
// Status: DRAFT, not deployed. Prepared 2026-11-23.
// Checks title / caption / HUD / CTA placement against the universal safe box
// and per-platform occlusion, and returns corrected coordinates.
// Like the other Bichum tools it is stateless and renders no video: it only
// judges coordinates the user supplies — it never looks at actual frames.
//
// Verdict model (deterministic, from draft-next-features/DESIGN.md #2):
//   - PASS: element fully inside the universal safe box (and, for captions,
//     inside the 55-75% caption band).
//   - FAIL: element is more than half outside the universal box, or its
//     bottom reaches past the TikTok bottom 400 px line (the most lenient
//     published figure — the part that is certainly covered).
//   - WARN: element is outside the box but neither FAIL condition holds —
//     including the uncertain 400~660 px band, where sources disagree.
// Note on the design doc: its verdict bullet says FAIL on touching the
// 660 px (strict) zone, but its own test 4 expects WARN for an element just
// above the 400 px line — under the strict reading that element would FAIL.
// This module follows the tests: the 400~660 px range is treated as an
// uncertain band (WARN) and only the part below the 400 px line is definite
// occlusion (FAIL). The range is kept in the data (safe-zones.mjs), not
// collapsed to one number. See README.md "설계안과 달라진 점".
// References: auto-clipper safe zones, FrameKit/ByteCap/RGBA guides,
// Primores.org (ads-only specs) — see the research page
// "비춤 오픈소스 참고 조사" (research_notes/bichum-opensource-video-tools-20261123-1338).

import {
  CANVAS,
  CAPTION_BAND,
  OCCLUSION_UNKNOWN_PLATFORMS,
  SAFE_ZONE_HEDGE_NOTE,
  normalizedToPx,
  tiktokOcclusionTopPx,
  universalBoxPx,
} from './safe-zones.mjs';

const PLATFORMS = ['youtube', 'tiktok', 'instagram', 'x'];
const KINDS = ['title', 'caption', 'hud', 'cta', 'logo'];

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

function validateElements(elements) {
  if (!Array.isArray(elements) || elements.length < 1 || elements.length > 20) {
    throw new Error('요소 항목 수를 확인해 주세요.');
  }
  for (const [index, el] of elements.entries()) {
    const label = (index + 1) + '번 요소';
    if (!el || typeof el !== 'object' || Array.isArray(el)) {
      throw new Error(label + ' 항목의 내용 또는 길이를 확인해 주세요.');
    }
    if (typeof el.id !== 'string' || !el.id.trim() || el.id.length > 40) {
      throw new Error(label + ' 항목의 내용 또는 길이를 확인해 주세요.');
    }
    if (!KINDS.includes(el.kind)) {
      throw new Error(label + ' 항목의 내용 또는 길이를 확인해 주세요.');
    }
    for (const key of ['x', 'y']) {
      if (!Number.isInteger(el[key]) || el[key] < 0 || el[key] > 1000) {
        throw new Error(label + ' 항목은 0~1000 정수여야 해요.');
      }
    }
    for (const key of ['w', 'h']) {
      if (!Number.isInteger(el[key]) || el[key] < 1 || el[key] > 1000) {
        throw new Error(label + ' 항목은 1~1000 정수여야 해요.');
      }
    }
    if (el.x + el.w > 1000 || el.y + el.h > 1000) {
      throw new Error('요소의 위치와 크기가 화면을 벗어났어요.');
    }
    if (el.kind === 'caption' && (typeof el.text !== 'string' || !el.text.trim())) {
      throw new Error('자막 요소에는 문구를 입력해 주세요.');
    }
    if (el.text !== undefined && (typeof el.text !== 'string' || el.text.length > 200)) {
      throw new Error(label + ' 항목의 내용 또는 길이를 확인해 주세요.');
    }
  }
}

function fullyInside(rect, box) {
  return rect.x >= box.x && rect.y >= box.y &&
    rect.x + rect.w <= box.x + box.w && rect.y + rect.h <= box.y + box.h;
}

function outsideFraction(rect, box) {
  const ix = Math.max(0, Math.min(rect.x + rect.w, box.x + box.w) - Math.max(rect.x, box.x));
  const iy = Math.max(0, Math.min(rect.y + rect.h, box.y + box.h) - Math.max(rect.y, box.y));
  const area = rect.w * rect.h;
  return area > 0 ? 1 - (ix * iy) / area : 0;
}

// Move the rect, keeping its size, to the nearest position inside the box.
// Moving up is preferred for elements below the box; clamp() does that.
function clampIntoBox(rect, box) {
  const x = Math.max(box.x, Math.min(rect.x, box.x + box.w - rect.w));
  const y = Math.max(box.y, Math.min(rect.y, box.y + box.h - rect.h));
  return { x, y, w: rect.w, h: rect.h };
}

function judge(rect, box, canvas, platform, kind) {
  const inside = fullyInside(rect, box);
  const bandOk = kind !== 'caption' ||
    (rect.y >= Math.round(canvas.height * CAPTION_BAND.top) &&
     rect.y + rect.h <= Math.round(canvas.height * CAPTION_BAND.bottom));
  if (inside) return bandOk ? 'PASS' : 'WARN';
  if (outsideFraction(rect, box) > 0.5) return 'FAIL';
  if (platform === 'tiktok') {
    const { strictTop } = tiktokOcclusionTopPx(canvas.height);
    if (rect.y + rect.h > strictTop) return 'FAIL';
  }
  return 'WARN';
}

export function checkSafeZones(input) {
  const plan = input.plan;
  let selected;
  if (plan) {
    if (Object.keys(input).some(key => !['plan', 'platforms', 'elements'].includes(key))) {
      throw new Error('컷 구성표 또는 개별 항목 중 하나만 입력해 주세요.');
    }
    if (plan.schema !== 'bichum.trailer-shot-plan/1') {
      throw new Error('비춤의 컷 구성표 JSON을 입력해 주세요.');
    }
    validatePlanShots(plan);
    selected = { game_title: plan.game_title, format: plan.format, duration_seconds: plan.duration_seconds };
  } else {
    selected = { game_title: input.game_title, format: input.format, duration_seconds: input.duration_seconds };
  }
  validateSelected(selected);

  let platforms = input.platforms;
  if (!platforms || !platforms.length) platforms = ['youtube'];
  if (!Array.isArray(platforms) || platforms.length > 4) {
    throw new Error('platforms 항목 수를 확인해 주세요.');
  }
  for (const platform of platforms) {
    if (!PLATFORMS.includes(platform)) {
      throw new Error('platforms 항목의 내용 또는 길이를 확인해 주세요.');
    }
  }
  if (new Set(platforms).size !== platforms.length) {
    throw new Error('플랫폼이 중복됐어요.');
  }

  validateElements(input.elements);

  const game = selected.game_title.trim();
  const canvas = CANVAS[selected.format];
  const box = universalBoxPx(selected.format);
  const notes = [SAFE_ZONE_HEDGE_NOTE];
  if (platforms.some(p => OCCLUSION_UNKNOWN_PLATFORMS.includes(p))) {
    notes.push('YouTube·Instagram·X는 검증된 세이프존 픽셀값이 없어서 공통 안전 박스만으로 판정했어요.');
  }

  const elements = input.elements.map(el => {
    const rect = {
      x: normalizedToPx(el.x, canvas.width),
      y: normalizedToPx(el.y, canvas.height),
      w: normalizedToPx(el.w, canvas.width),
      h: normalizedToPx(el.h, canvas.height),
    };
    const checks = { universal: judge(rect, box, canvas, 'universal', el.kind) };
    for (const platform of platforms) {
      checks[platform] = judge(rect, box, canvas, platform, el.kind);
    }
    const inside = fullyInside(rect, box);
    const bandOk = el.kind !== 'caption' ||
      (rect.y >= Math.round(canvas.height * CAPTION_BAND.top) &&
       rect.y + rect.h <= Math.round(canvas.height * CAPTION_BAND.bottom));
    const reasons = [];
    if (!inside) {
      if (outsideFraction(rect, box) > 0.5) reasons.push('공통 안전 박스 밖으로 절반 이상 나갔어요.');
      else reasons.push('공통 안전 박스 밖으로 나갔어요.');
      if (platforms.includes('tiktok') && rect.y + rect.h > tiktokOcclusionTopPx(canvas.height).strictTop) {
        reasons.push('TikTok 하단 가림 영역(400~660px)에 들어갔어요.');
      }
      reasons.push('공통 안전 박스 안으로 옮겼어요.');
    }
    if (el.kind === 'caption' && !bandOk) {
      reasons.push('자막이 화면 아래쪽 UI와 겹칠 수 있어요. 자막은 화면 세로 55~75% 안에 두는 게 좋아요.');
    }
    if (!reasons.length) reasons.push('공통 안전 박스 안에 있어요.');
    return {
      id: el.id.trim(),
      kind: el.kind,
      rect,
      checks,
      corrected_rect: inside ? null : clampIntoBox(rect, box),
      reason: reasons.join(' '),
    };
  });

  const results = platforms.map(platform => {
    const failed = elements.filter(el => el.checks[platform] === 'FAIL').map(el => el.id);
    const warned = elements.filter(el => el.checks[platform] === 'WARN').map(el => el.id);
    return {
      platform,
      verdict: failed.length ? 'FAIL' : warned.length ? 'WARN' : 'PASS',
      failed_elements: failed,
      warned_elements: warned,
    };
  });

  return {
    schema: 'bichum.safe-zone-check/1',
    filename: 'bichum-safe-zones.json',
    game_title: game,
    format: selected.format,
    canvas: { width: canvas.width, height: canvas.height },
    platforms,
    universal_box: { ...box, note: '세 출처 중 가장 보수적인 값' },
    results,
    elements,
    notes,
    to_be_measured: { rendered_frame_check: '실제 렌더 프레임에서 UI·자막 겹침을 육안으로 확인할 것' },
    status: 'CHECK_ONLY',
  };
}
