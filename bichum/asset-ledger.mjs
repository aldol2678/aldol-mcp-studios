// Draft for Bichum v1.5.0 — bichum_build_asset_ledger
// Status: DRAFT, not deployed. Prepared 2026-11-23.
// Builds an asset rights ledger from a shot plan or manual input:
//   - static game glossary pack (game-glossary.mjs) + one-off additions
//   - per-asset source, license, expiry date, allowed platforms
//   - mechanical permission_status only: EXPIRED / UNREVIEWED / CLEARED.
//     BLOCKED is never produced here; it is reserved for a person who has
//     read the license itself and judged the asset unusable.
// Bichum does NOT verify rights. The ledger is a record plus date/license
// arithmetic; whether an asset may actually be used must be checked by a
// person against the license text and purchase records. That line is stated
// in the output notes and in `legal_rights_verified_by_mcp: false`.
// Pattern reference: pyeol IP ledger (`permission_status: 'UNREVIEWED'` +
// `legal_rights_verified_by_mcp: false`), DESIGN.md #8, edit-manifest.mjs.
import { getGlossaryPack } from './game-glossary.mjs';

const LICENSES = ['original', 'cc0', 'cc-by', 'cc-by-sa', 'purchased', 'royalty-free', 'unknown'];
const KINDS = ['music', 'sfx', 'image', 'video', 'font', '3d', 'other'];
const PLATFORMS = ['youtube', 'tiktok', 'instagram', 'x', 'steam'];
const ALLOWED_PLATFORMS = [...PLATFORMS, 'all'];
const CATEGORIES = ['name', 'jargon', 'mechanic'];
const EXPIRY_SOON_DAYS = 30;

const todayKey = () => new Date().toISOString().slice(0, 10);

function parseDate(value) {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return value;
}

function daysUntil(dateStr, today) {
  return Math.round((Date.parse(dateStr + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
}

// Collect {id, text} pairs from a hooks/narration JSON document so glossary
// terms can be matched against the words actually used. Any nested object
// with a string `id` contributes its own string fields as its text.
function collectUsages(doc) {
  const found = [];
  const walk = node => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object') return;
    if (typeof node.id === 'string' && node.id.trim()) {
      const text = Object.values(node).filter(value => typeof value === 'string' && value !== node.id).join(' ');
      found.push({ id: node.id.trim(), text });
    }
    for (const value of Object.values(node)) walk(value);
  };
  walk(doc);
  return found;
}

function usedIn(term, hookUsages, narrationUsages) {
  const used = [];
  const hit = text => {
    if (!text) return false;
    if (term.term_ko && text.includes(term.term_ko)) return true;
    if (term.term_en && text.toLowerCase().includes(term.term_en.toLowerCase())) return true;
    return false;
  };
  for (const usage of hookUsages) if (hit(usage.text)) used.push(usage.id);
  for (const usage of narrationUsages) if (hit(usage.text)) used.push('narration ' + usage.id);
  return [...new Set(used)];
}

export function buildAssetLedger(input) {
  const plan = input.plan;
  let selected;
  let source;
  if (plan) {
    if (Object.keys(input).some(key => !['plan', 'assets', 'glossary_additions', 'publish_platforms', 'hooks', 'narration'].includes(key))) {
      throw new Error('컷 구성표 또는 개별 항목 중 하나만 입력해 주세요.');
    }
    if (plan.schema !== 'bichum.trailer-shot-plan/1') {
      throw new Error('비춤의 컷 구성표 JSON을 입력해 주세요.');
    }
    selected = { game_title: plan.game_title, format: plan.format, duration_seconds: plan.duration_seconds };
    if (!Array.isArray(plan.shots) || !plan.shots.length) throw new Error('컷 구성표에 샷이 없어요. 컷 구성표부터 다시 만들어 주세요.');
    for (const [index, shot] of plan.shots.entries()) {
      if (!Number.isInteger(shot.start_ms) || !Number.isInteger(shot.end_ms) || shot.end_ms <= shot.start_ms ||
          typeof shot.purpose !== 'string' || !shot.purpose.trim()) {
        throw new Error((index + 1) + '번 샷의 시작·종료 시각과 용도를 확인해 주세요.');
      }
    }
    source = 'bichum.trailer-shot-plan/1';
  } else {
    selected = { game_title: input.game_title, format: input.format, duration_seconds: input.duration_seconds };
    source = 'manual';
  }
  if (typeof selected.game_title !== 'string' || !selected.game_title.trim() || selected.game_title.length > 120) {
    throw new Error('game_title 항목의 내용 또는 길이를 확인해 주세요.');
  }
  if (!['16:9', '9:16', '1:1'].includes(selected.format)) {
    throw new Error('format 항목의 내용 또는 길이를 확인해 주세요.');
  }
  if (!Number.isInteger(selected.duration_seconds) || selected.duration_seconds < 5 || selected.duration_seconds > 120) {
    throw new Error('duration_seconds 항목은 5~120 정수여야 해요.');
  }

  const assets = input.assets;
  if (!Array.isArray(assets) || !assets.length || assets.length > 50) {
    throw new Error('assets 항목을 입력해 주세요.');
  }
  const publish = input.publish_platforms ?? ['youtube'];
  if (!Array.isArray(publish) || !publish.length || publish.length > 5 ||
      publish.some(platform => !PLATFORMS.includes(platform))) {
    throw new Error('publish_platforms 항목의 내용 또는 길이를 확인해 주세요.');
  }
  if (new Set(publish).size !== publish.length) {
    throw new Error('publish_platforms 항목에 중복된 플랫폼이 있어요.');
  }
  const additions = input.glossary_additions ?? [];
  if (!Array.isArray(additions) || additions.length > 30) {
    throw new Error('glossary_additions 항목의 내용 또는 길이를 확인해 주세요.');
  }

  const today = todayKey();
  const seenNames = new Set();
  for (const [index, asset] of assets.entries()) {
    const label = (index + 1) + '번 에셋';
    if (typeof asset !== 'object' || asset === null) throw new Error(label + ' 항목의 내용 또는 길이를 확인해 주세요.');
    if (typeof asset.name !== 'string' || !asset.name.trim() || asset.name.length > 120) {
      throw new Error(label + '의 name 항목의 내용 또는 길이를 확인해 주세요.');
    }
    if (seenNames.has(asset.name.trim())) throw new Error('\'' + asset.name.trim() + '\' 에셋이 중복됐어요.');
    seenNames.add(asset.name.trim());
    if (!KINDS.includes(asset.kind)) throw new Error(label + '의 kind 항목의 내용 또는 길이를 확인해 주세요.');
    if (typeof asset.source !== 'string' || !asset.source.trim() || asset.source.length > 400) {
      throw new Error(label + '의 source 항목의 내용 또는 길이를 확인해 주세요.');
    }
    if (!LICENSES.includes(asset.license)) throw new Error(label + '의 license 항목의 내용 또는 길이를 확인해 주세요.');
    if (asset.license_url !== undefined && (typeof asset.license_url !== 'string' || asset.license_url.length > 500)) {
      throw new Error(label + '의 license_url 항목의 내용 또는 길이를 확인해 주세요.');
    }
    if (asset.expiry_date !== undefined && asset.expiry_date !== null && !parseDate(asset.expiry_date)) {
      throw new Error(label + '의 만료일(YYYY-MM-DD) 형식을 확인해 주세요.');
    }
    if (asset.allowed_platforms !== undefined) {
      if (!Array.isArray(asset.allowed_platforms) || !asset.allowed_platforms.length || asset.allowed_platforms.length > 5 ||
          asset.allowed_platforms.some(platform => !ALLOWED_PLATFORMS.includes(platform))) {
        throw new Error(label + '의 allowed_platforms 항목의 내용 또는 길이를 확인해 주세요.');
      }
      if (asset.allowed_platforms.includes('all') && asset.allowed_platforms.length > 1) {
        throw new Error(label + '의 allowed_platforms에서 \'all\'은 다른 플랫폼과 함께 쓸 수 없어요.');
      }
    }
    if (asset.notes !== undefined && (typeof asset.notes !== 'string' || asset.notes.length > 400)) {
      throw new Error(label + '의 notes 항목의 내용 또는 길이를 확인해 주세요.');
    }
  }
  for (const [index, addition] of additions.entries()) {
    const label = (index + 1) + '번 용어 추가';
    if (typeof addition !== 'object' || addition === null) throw new Error(label + ' 항목의 내용 또는 길이를 확인해 주세요.');
    if (typeof addition.term_ko !== 'string' || !addition.term_ko.trim() || addition.term_ko.length > 60) {
      throw new Error(label + '의 term_ko 항목의 내용 또는 길이를 확인해 주세요.');
    }
    if (addition.term_en !== undefined && (typeof addition.term_en !== 'string' || addition.term_en.length > 60)) {
      throw new Error(label + '의 term_en 항목의 내용 또는 길이를 확인해 주세요.');
    }
    if (addition.aliases !== undefined &&
        (!Array.isArray(addition.aliases) || addition.aliases.length > 5 ||
         addition.aliases.some(alias => typeof alias !== 'string' || !alias.trim() || alias.length > 60))) {
      throw new Error(label + '의 aliases 항목의 내용 또는 길이를 확인해 주세요.');
    }
    if (addition.category !== undefined && !CATEGORIES.includes(addition.category)) {
      throw new Error(label + '의 category 항목의 내용 또는 길이를 확인해 주세요.');
    }
  }

  const game = selected.game_title.trim();
  const pack = getGlossaryPack(game);
  const hookUsages = input.hooks ? collectUsages(input.hooks) : [];
  const narrationUsages = input.narration ? collectUsages(input.narration) : [];
  const terms = [...pack.terms];
  const knownKo = new Set(terms.map(term => term.term_ko));
  for (const addition of additions) {
    const termKo = addition.term_ko.trim();
    if (knownKo.has(termKo)) continue;
    knownKo.add(termKo);
    terms.push({
      term_ko: termKo,
      term_en: (addition.term_en ?? '').trim(),
      aliases: (addition.aliases ?? []).map(alias => alias.trim()),
      category: addition.category ?? 'jargon',
    });
  }
  const glossary = {
    pack: pack.pack,
    terms: terms.map(term => ({ ...term, used_in: usedIn(term, hookUsages, narrationUsages) })),
    note: '용어 사전은 정적 데이터예요. 새 게임은 glossary_additions로 추가해요.',
  };

  const blockedPlatforms = {};
  let cleared = 0;
  let unreviewed = 0;
  let expired = 0;
  const outAssets = assets.map(asset => {
    const warnings = [];
    const expiry = asset.expiry_date ?? null;
    const allowed = asset.allowed_platforms ?? ['all'];
    let permissionStatus;
    if (expiry && expiry < today) {
      permissionStatus = 'EXPIRED';
      expired += 1;
      warnings.push('만료일이 지났어요. 갱신하거나 교체해 주세요.');
    } else if (asset.license === 'unknown') {
      permissionStatus = 'UNREVIEWED';
      unreviewed += 1;
      warnings.push('라이선스가 확인되지 않았어요. 출처와 라이선스를 먼저 확인해 주세요.');
    } else {
      permissionStatus = 'CLEARED';
      cleared += 1;
      if (asset.license === 'cc-by' || asset.license === 'cc-by-sa') {
        warnings.push('출처 표기가 필요해요. 설명란에 출처를 넣어 주세요.');
      }
      if (asset.license === 'cc-by-sa') {
        warnings.push('같은 라이선스로 공유해야 해요.');
      }
    }
    if (expiry && expiry >= today && daysUntil(expiry, today) <= EXPIRY_SOON_DAYS) {
      warnings.push('만료가 30일 이내로 남았어요. 갱신 일정을 확인해 주세요.');
    }
    for (const platform of publish) {
      if (!allowed.includes('all') && !allowed.includes(platform)) {
        warnings.push('\'' + platform + '\'에는 이 에셋을 쓸 수 없어요.');
        (blockedPlatforms[platform] ??= []).push(asset.name.trim());
      }
    }
    return {
      name: asset.name.trim(),
      kind: asset.kind,
      source: asset.source.trim(),
      license: asset.license,
      license_url: (asset.license_url ?? '').trim(),
      expiry_date: expiry,
      allowed_platforms: allowed,
      permission_status: permissionStatus,
      warnings,
      notes: (asset.notes ?? '').trim(),
    };
  });

  return {
    schema: 'bichum.asset-ledger/1',
    filename: 'bichum-asset-ledger.json',
    game_title: game,
    format: selected.format,
    duration_seconds: selected.duration_seconds,
    source_plan: source,
    glossary,
    assets: outAssets,
    summary: {
      total: outAssets.length,
      cleared,
      unreviewed,
      blocked: 0,
      expired,
      publish_ready: expired === 0 && unreviewed === 0,
      blocked_platforms: blockedPlatforms,
    },
    notes: [
      '이 장부는 기록일 뿐, 권리 확인이 아니에요. 실제 사용 가능 여부는 라이선스 원문과 구매 내역으로 직접 확인해 주세요.',
      'BLOCKED 상태는 이 도구가 직접 만들지 않아요. 사람이 라이선스 원문을 보고 사용 불가라고 판단했을 때만 따로 기록해 주세요.',
      '만료일은 오늘 날짜(' + today + ') 기준으로 판정했어요.',
    ],
    legal_rights_verified_by_mcp: false,
    status: 'LEDGER_ONLY',
  };
}
