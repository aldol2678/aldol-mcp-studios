// Shared safe-zone constants for Bichum (#2, reused by #6 and #7).
// Draft for Bichum v1.4.0. Status: DRAFT, not deployed.
//
// Sources disagree on exact pixel values, so this module encodes the most
// conservative published values and marks the rest unknown — never a single
// "true" number. Research: research_notes/bichum-opensource-video-tools-20261123-1338/report.md
// "Could not verify": TikTok bottom unsafe 400 vs 460 vs 484 vs 660 px (for
// ads); universal box 810x1186 vs 840x1190 vs 900x1400. Platforms publish
// safe zones for ads only; none publishes an organic spec (Primores.org,
// verified Nov 2026). TikTok bottom 400~660 px is the only platform figure
// confirmed in the research — YouTube Shorts, Instagram Reels and X have no
// verified pixel values, so they are `unknown` here and judged by the
// universal box only.

export const CANVAS = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
};

// Universal safe box, 9:16 basis: 810x1186 on a 1080x1920 canvas — the
// smallest of the three published boxes (810x1186 / 840x1190 / 900x1400).
// Stored as fractions so it scales to 16:9 and 1:1: width 75% (810/1080),
// height 61.8% (1186/1920), centered.
export const UNIVERSAL_BOX = { x: 0.125, y: 367 / 1920, w: 0.75, h: 1186 / 1920 };

// TikTok bottom occlusion, 1080x1920 basis, as a range in px from the bottom.
// `min` is the most lenient published figure, `max` the strictest.
export const TIKTOK_BOTTOM_OCCLUSION_PX = { min: 400, max: 660, basis_height: 1920 };

// Platforms with no verified pixel values — judged by the universal box only.
export const OCCLUSION_UNKNOWN_PLATFORMS = ['youtube', 'instagram', 'x'];

// Caption band: captions should sit within 55-75% of screen height.
export const CAPTION_BAND = { top: 0.55, bottom: 0.75 };

export const SAFE_ZONE_HEDGE_NOTE =
  '플랫폼이 공개하는 세이프존은 광고용 기준만 있고, 일반 영상용 공식 수치는 없어요(Primores.org, 2026-11 검증). TikTok 하단 400~660px도 출처마다 달라서 가장 보수적인 값으로 판정했어요.';

// Universal safe box in px for a format, centered on the canvas.
export function universalBoxPx(format) {
  const canvas = CANVAS[format];
  return {
    x: Math.round(canvas.width * UNIVERSAL_BOX.x),
    y: Math.round(canvas.height * UNIVERSAL_BOX.y),
    w: Math.round(canvas.width * UNIVERSAL_BOX.w),
    h: Math.round(canvas.height * UNIVERSAL_BOX.h),
  };
}

// TikTok occlusion boundaries for a canvas height, in px from the top.
// strictTop: top edge of the strictest (660 px) bottom zone; lenientTop: top
// edge of the most lenient (400 px) bottom zone. Both scale with canvas
// height because the published figures are for 1080x1920.
export function tiktokOcclusionTopPx(canvasHeight) {
  const { min, max, basis_height } = TIKTOK_BOTTOM_OCCLUSION_PX;
  return {
    strictTop: Math.round(canvasHeight * (1 - max / basis_height)),
    lenientTop: Math.round(canvasHeight * (1 - min / basis_height)),
  };
}

// Normalized coordinate (0-1000) to px on one axis.
export function normalizedToPx(value, size) {
  return Math.round((value / 1000) * size);
}
