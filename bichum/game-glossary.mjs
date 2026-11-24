// Static game glossary packs for Bichum v1.5.0 — bichum_build_asset_ledger
// Status: DRAFT, not deployed. Prepared 2026-11-23.
// This module is static data, not an MCP tool. The ledger tool imports it
// to attach the matching pack to its output; nothing here is stored anywhere.
// Pack rules (DESIGN.md #8):
//   - `common`: generic trailer/shorts terms, used for every game.
//   - A game pack (e.g. `dasi-playground`) is used when the game title maps
//     to it; its terms are output together with the common terms.
//   - No matching pack -> `common` only.
// Start scope (alternative note in DESIGN.md): `common` 20 terms +
// `dasi-playground` 10 terms. New game packs are a data change, shipped
// with a code deploy; one-off additions go through `glossary_additions`.
// Categories: 'name' (game title / proper name), 'jargon' (general term),
// 'mechanic' (gameplay system or action).

export const GAME_GLOSSARY = {
  common: {
    pack: 'common',
    terms: [
      { term_ko: '트레일러', term_en: 'Trailer', aliases: [], category: 'jargon' },
      { term_ko: '티저', term_en: 'Teaser', aliases: [], category: 'jargon' },
      { term_ko: '쇼츠', term_en: 'Shorts', aliases: ['숏폼'], category: 'jargon' },
      { term_ko: '훅', term_en: 'Hook', aliases: [], category: 'jargon' },
      { term_ko: '컷', term_en: 'Cut', aliases: ['샷'], category: 'jargon' },
      { term_ko: 'BGM', term_en: 'BGM', aliases: ['배경 음악', '배경음악'], category: 'jargon' },
      { term_ko: '내레이션', term_en: 'Narration', aliases: ['보이스오버'], category: 'jargon' },
      { term_ko: '자막', term_en: 'Subtitle', aliases: ['캡션'], category: 'jargon' },
      { term_ko: '썸네일', term_en: 'Thumbnail', aliases: ['커버'], category: 'jargon' },
      { term_ko: '챕터', term_en: 'Chapter', aliases: [], category: 'jargon' },
      { term_ko: '엔딩', term_en: 'Ending', aliases: ['엔드 카드'], category: 'jargon' },
      { term_ko: '도입', term_en: 'Intro', aliases: ['오프닝'], category: 'jargon' },
      { term_ko: '실제 플레이', term_en: 'Gameplay', aliases: ['플레이'], category: 'jargon' },
      { term_ko: 'HUD', term_en: 'HUD', aliases: ['인터페이스'], category: 'jargon' },
      { term_ko: '프레임', term_en: 'Frame', aliases: [], category: 'jargon' },
      { term_ko: '해상도', term_en: 'Resolution', aliases: [], category: 'jargon' },
      { term_ko: '세이프존', term_en: 'Safe Zone', aliases: ['안전 영역'], category: 'jargon' },
      { term_ko: '보스', term_en: 'Boss', aliases: ['보스전'], category: 'mechanic' },
      { term_ko: '퀘스트', term_en: 'Quest', aliases: ['미션'], category: 'mechanic' },
      { term_ko: '스테이지', term_en: 'Stage', aliases: [], category: 'mechanic' },
    ],
  },
  'dasi-playground': {
    pack: 'dasi-playground',
    terms: [
      { term_ko: '다시, 놀이터', term_en: 'Dasi Playground', aliases: ['다시놀이터'], category: 'name' },
      { term_ko: '점핑 타워', term_en: 'Jumping Tower', aliases: ['점타'], category: 'mechanic' },
      { term_ko: '로블록스', term_en: 'Roblox', aliases: [], category: 'name' },
      { term_ko: '놀이터', term_en: 'Playground', aliases: [], category: 'jargon' },
      { term_ko: '친구', term_en: 'Friend', aliases: [], category: 'jargon' },
      { term_ko: '추억', term_en: 'Memory', aliases: [], category: 'jargon' },
      { term_ko: '점프', term_en: 'Jump', aliases: [], category: 'mechanic' },
      { term_ko: '낙하', term_en: 'Fall', aliases: [], category: 'mechanic' },
      { term_ko: '광장', term_en: 'Plaza', aliases: [], category: 'jargon' },
      { term_ko: '미니게임', term_en: 'Minigame', aliases: ['미니 게임'], category: 'mechanic' },
    ],
  },
};

const slug = value => value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'game';

// Korean titles do not slug to the English pack names, so known titles are
// mapped explicitly. A title whose slug already equals a pack name also
// matches (e.g. an English title).
const TITLE_TO_PACK = {
  '다시, 놀이터': 'dasi-playground',
};

export function getGlossaryPack(gameTitle) {
  const title = (gameTitle ?? '').trim();
  const key = TITLE_TO_PACK[title] ?? (Object.hasOwn(GAME_GLOSSARY, slug(title)) ? slug(title) : null);
  const common = GAME_GLOSSARY.common.terms;
  if (!key || key === 'common') return { pack: 'common', terms: common.map(term => ({ ...term })) };
  const game = GAME_GLOSSARY[key].terms;
  return { pack: key, terms: [...game, ...common].map(term => ({ ...term })) };
}
