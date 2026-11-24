import { buildEditManifest } from './edit-manifest.mjs';
import { planAudio } from './audio.mjs';
import { planPublish } from './publish.mjs';
import { draftNarration } from './narration.mjs';
import { planWordCaptions } from './word-captions.mjs';
import { buildAssetLedger } from './asset-ledger.mjs';
import { checkSafeZones } from './safe-zone-check.mjs';
import { scoreHooks } from './score-hooks.mjs';

const ratios = ['16:9', '9:16', '1:1'];
const trailerTypes = ['teaser', 'gameplay', 'launch', 'shortform', 'devlog'];
const platforms = ['pc', 'mobile', 'console'];
const resolutions = { '16:9': '1920×1080', '9:16': '1080×1920', '1:1': '1080×1080' };
const slug = value => value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'game';
const short = (value, n) => value.length > n ? value.slice(0, n - 1).trimEnd() + '…' : value;
const title = { type: 'string', minLength: 1, maxLength: 120 };
const ratio = { type: 'string', enum: ratios };
const duration = { type: 'integer', minimum: 5, maximum: 120 };
const text = maxLength => ({ type: 'string', maxLength });
const object = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const array = (items, maxItems, minItems = 0) => ({ type: 'array', items, maxItems, minItems });

const briefInput = object({
  game_id: { type: 'string', maxLength: 80, pattern: '^[a-z0-9][a-z0-9_-]*$' },
  game_title: title,
  title,
  format: ratio,
  duration_seconds: duration,
  trailer_type: { type: 'string', enum: trailerTypes },
  key_message: text(500),
  call_to_action: text(200),
}, ['game_title', 'title', 'format', 'duration_seconds']);

const tools = {
  pyeol: [
    ['pyeol_draft_ip_record', '세계관·캐릭터·스토리와 에셋 출처를 IP 원장용 JSON 초안으로 정리합니다. 원격 원장에는 쓰지 않습니다.', object({
      game_title: title, world: text(2000), story: text(2000),
      characters: array(title, 20),
      assets: array(object({
        name: title,
        source: text(400),
        notes: text(400),
      }, ['name']), 30),
    }, ['game_title']), draftIp],
    ['pyeol_draft_trailer_brief', '게임 제목·화면비·길이·핵심 메시지로 비춤에 전달할 트레일러 브리프 JSON을 만듭니다.', briefInput, draftBrief],
  ],
  bichum: [
    ['bichum_plan_trailer_shots', '펼의 브리프 또는 게임 제목·화면비·길이를 받아 타임코드가 있는 컷 구성표를 만듭니다.', object({
      game_title: title, format: ratio, duration_seconds: duration,
      key_message: text(500), call_to_action: text(200),
      brief: { type: 'object', description: '펼 제작 도구에서 받은 트레일러 브리프 전체 JSON. 단독 입력 가능.' },
    }), planShots],
    ['bichum_build_srt', '시작·종료 시각과 문구로 영상 편집기에 가져올 UTF-8 SRT 자막 파일을 만듭니다. 시각 단위는 밀리초입니다.', object({
      cues: array(object({
        start_ms: { type: 'integer', minimum: 0, maximum: 7200000 },
        end_ms: { type: 'integer', minimum: 1, maximum: 7200000 },
        text: { type: 'string', minLength: 1, maxLength: 240 },
      }, ['start_ms', 'end_ms', 'text']), 80, 1),
    }, ['cues']), makeSrt],
    ['bichum_draft_hook', '게임 제목·화면비·핵심 메시지로 첫 3초 훅 초안 1~5개를 만듭니다. 실제 플레이 화면과 맞는 훅만 고르세요.', object({
      game_title: title, format: ratio, duration_seconds: duration,
      key_message: text(500), call_to_action: text(200),
      surprising_moment: text(300), audience: text(200),
      hook_count: { type: 'integer', minimum: 1, maximum: 5 },
    }, ['game_title', 'format']), draftHook],
    ['bichum_build_capture_checklist', '컷 구성표 또는 게임 정보로 실제 촬영용 체크리스트를 만듭니다. 촬영본과 렌더링은 만들지 않습니다.', object({
      game_title: title, format: ratio, duration_seconds: duration,
      key_message: text(500), call_to_action: text(200),
      platform: { type: 'string', enum: platforms },
      plan: { type: 'object', description: '비춤 컷 구성표(bichum.trailer-shot-plan/1) 전체 JSON. 단독 입력 가능하며 platform과 함께 쓸 수 있어요.' },
    }), buildCapture],
    ['bichum_export_edit_manifest', '컷 구성표로 편집 매니페스트(EDL·OTIO·챕터)를 만듭니다. 영상 파일은 만들지 않습니다.', object({
      game_title: title, format: ratio, duration_seconds: duration,
      key_message: text(500), call_to_action: text(200),
      frame_rate: { type: 'integer', minimum: 24, maximum: 60 },
      plan: { type: 'object', description: '비춤 컷 구성표(bichum.trailer-shot-plan/1) 전체 JSON. 단독 입력 가능하며 frame_rate·sources와 함께 쓸 수 있어요.' },
      sources: array(object({
        shot_no: { type: 'integer', minimum: 1, maximum: 80 },
        file_name: { type: 'string', minLength: 1, maxLength: 200 },
      }, ['shot_no', 'file_name']), 80),
    }), buildEditManifest],
    ['bichum_build_asset_ledger', '게임 용어 사전과 자산별 출처·라이선스·만료일을 기록해 사용 가능 여부를 정리합니다. 권리 확인은 아니에요.', object({
      game_title: title, format: ratio, duration_seconds: duration,
      plan: { type: 'object', description: '비춤 컷 구성표(bichum.trailer-shot-plan/1) 전체 JSON. 단독 입력 가능하며 assets·glossary_additions와 함께 쓸 수 있어요.' },
      assets: array(object({
        name: title,
        kind: { type: 'string', enum: ['music', 'sfx', 'image', 'video', 'font', '3d', 'other'] },
        source: text(400),
        license: { type: 'string', enum: ['original', 'cc0', 'cc-by', 'cc-by-sa', 'purchased', 'royalty-free', 'unknown'] },
        license_url: text(500),
        expiry_date: { type: 'string', pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' },
        allowed_platforms: array({ type: 'string', enum: ['youtube', 'tiktok', 'instagram', 'x', 'steam', 'all'] }, 5),
        notes: text(400),
      }, ['name', 'kind', 'source', 'license']), 50, 1),
      glossary_additions: array(object({
        term_ko: { type: 'string', minLength: 1, maxLength: 60 },
        term_en: text(60),
        aliases: array({ type: 'string', minLength: 1, maxLength: 60 }, 5),
        category: { type: 'string', enum: ['name', 'jargon', 'mechanic'] },
      }, ['term_ko']), 30),
      publish_platforms: array({ type: 'string', enum: ['youtube', 'tiktok', 'instagram', 'x', 'steam'] }, 5),
      hooks: { type: 'object', description: '비춤 훅 초안(bichum.hook-draft/1) 전체 JSON. 용어 사용처(used_in) 계산에만 써요.' },
      narration: { type: 'object', description: '내레이션 계획 JSON. 용어 사용처(used_in) 계산에만 써요.' },
    }, ['assets']), buildAssetLedger],
    ['bichum_check_safe_zones', '화면비·플랫폼별 가림 영역에 대해 제목·자막·HUD·CTA 배치를 검수합니다. 실제 화면은 보지 않습니다.', object({
      game_title: title, format: ratio, duration_seconds: duration,
      platforms: array({ type: 'string', enum: ['youtube', 'tiktok', 'instagram', 'x'] }, 4),
      elements: array(object({
        id: { type: 'string', minLength: 1, maxLength: 40 },
        kind: { type: 'string', enum: ['title', 'caption', 'hud', 'cta', 'logo'] },
        x: { type: 'integer', minimum: 0, maximum: 1000 },
        y: { type: 'integer', minimum: 0, maximum: 1000 },
        w: { type: 'integer', minimum: 1, maximum: 1000 },
        h: { type: 'integer', minimum: 1, maximum: 1000 },
        text: text(200),
      }, ['id', 'kind', 'x', 'y', 'w', 'h']), 20, 1),
      plan: { type: 'object', description: '비춤 컷 구성표(bichum.trailer-shot-plan/1) 전체 JSON. 단독 입력 가능하며 platforms·elements와 함께 쓸 수 있어요.' },
    }, ['elements']), checkSafeZones],
    ['bichum_score_hooks', '훅 초안(JSON) 또는 직접 입력한 훅을 규칙으로 채점하고 순위를 매깁니다. 실제 반응은 아니에요.', object({
      game_title: title, format: ratio,
      hooks: { type: 'object', description: '비춤 훅 초안(bichum.hook-draft/1) 전체 JSON. manual_hooks와 함께 쓸 수 없어요.' },
      manual_hooks: array(object({
        angle: { type: 'string', enum: ['question', 'surprise', 'number', 'empathy', 'direct'] },
        on_screen_text: { type: 'string', minLength: 1, maxLength: 60 },
        narration_line: { type: 'string', minLength: 1, maxLength: 60 },
        visual_direction: { type: 'string', minLength: 1, maxLength: 300 },
      }, ['angle', 'on_screen_text', 'narration_line', 'visual_direction']), 5, 1),
      plan: { type: 'object', description: '비춤 컷 구성표(bichum.trailer-shot-plan/1) 전체 JSON. 있으면 Steam 마이크로트레일러 검사를 함께 해요.' },
    }), scoreHooks],
    ['bichum_draft_narration', '샷별 내레이션 문구와 TTS용 예상 길이를 만들어요. 음성은 만들지 않아요.', object({
      game_title: title, format: ratio, duration_seconds: duration,
      key_message: text(500), call_to_action: text(200),
      plan: { type: 'object', description: '비춤 컷 구성표(bichum.trailer-shot-plan/1) 전체 JSON. 단독 입력 가능하며 lines·language·speaking_rate·tts_engine과 함께 쓸 수 있어요.' },
      lines: array(object({
        shot_no: { type: 'integer', minimum: 1, maximum: 80 },
        text: { type: 'string', minLength: 1, maxLength: 200 },
      }, ['shot_no', 'text']), 40, 1),
      language: { type: 'string', enum: ['ko', 'en'] },
      speaking_rate: { type: 'integer', minimum: 80, maximum: 120 },
      tts_engine: { type: 'string', enum: ['kokoro', 'edge-tts'] },
    }), draftNarration],
    ['bichum_plan_word_captions', '대본·SRT에서 단어별 자막(ASS)을 만들어요. 시간은 추정치예요.', object({
      narration: { type: 'object', description: '내레이션 계획 JSON(bichum.narration-plan/1). srt·lines와 함께 쓸 수 없어요.' },
      srt: { type: 'object', description: 'SRT 자막 결과 JSON 또는 큐 배열. narration·lines와 함께 쓸 수 없어요.' },
      lines: array(object({
        start_ms: { type: 'integer', minimum: 0, maximum: 7200000 },
        end_ms: { type: 'integer', minimum: 1, maximum: 7200000 },
        text: { type: 'string', minLength: 1, maxLength: 240 },
      }, ['start_ms', 'end_ms', 'text']), 80, 1),
      style: { type: 'string', enum: ['karaoke', 'hormozi', 'mrbeast', 'minimal', 'tiktok'] },
      words_per_line: { type: 'integer', minimum: 1, maximum: 4 },
      highlight_color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
      format: ratio,
    }), planWordCaptions],
    ['bichum_plan_audio', 'BPM으로 비트 그리드를 만들고 컷을 비트에 맞춰요. 음악은 만들지 않아요.', object({
      game_title: title, format: ratio, duration_seconds: duration,
      plan: { type: 'object', description: '비춤 컷 구성표(bichum.trailer-shot-plan/1) 전체 JSON. 단독 입력 가능하며 bpm·beats_per_bar·mood·ducking·silence와 함께 쓸 수 있어요.' },
      bpm: { type: 'integer', minimum: 60, maximum: 180 },
      beats_per_bar: { type: 'integer', minimum: 3, maximum: 4 },
      mood: { type: 'string', enum: ['tense', 'uplifting', 'calm', 'epic'] },
      ducking: object({
        threshold_db: { type: 'integer', minimum: -30, maximum: -6 },
        ratio: { type: 'integer', minimum: 2, maximum: 8 },
        attack_ms: { type: 'integer', minimum: 1, maximum: 50 },
        release_ms: { type: 'integer', minimum: 50, maximum: 1000 },
      }),
      silence: object({
        threshold_db: { type: 'integer', minimum: -50, maximum: -20 },
        min_duration_ms: { type: 'integer', minimum: 200, maximum: 2000 },
        margin_ms: { type: 'integer', minimum: 0, maximum: 500 },
      }),
    }), planAudio],
    ['bichum_plan_publish', '썸네일 후보 시간과 플랫폼별 제목·설명을 묶어 발행 팩을 만들어요. 업로드는 직접 해요.', object({
      game_title: title, format: ratio, duration_seconds: duration,
      key_message: text(500), call_to_action: text(200),
      plan: { type: 'object', description: '비춤 컷 구성표(bichum.trailer-shot-plan/1) 전체 JSON. 단독 입력 가능하며 peak_ms·platforms·overlay_text·overlay_font_px·chapters와 함께 쓸 수 있어요.' },
      peak_ms: { type: 'integer', minimum: 0, maximum: 120000 },
      platforms: array({ type: 'string', enum: ['youtube', 'tiktok', 'instagram', 'x', 'steam'] }, 5),
      overlay_text: text(40),
      overlay_font_px: { type: 'integer', minimum: 16, maximum: 200 },
      chapters: text(2000),
    }), planPublish],
  ],
};

function validate(schema, value, name = '입력') {
  switch (schema.type) {
    case 'object':
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(name + '은 JSON 객체여야 해요.');
      for (const key of schema.required ?? []) {
        if (!Object.hasOwn(value, key)) throw new Error(key + ' 항목을 입력해 주세요.');
      }
      for (const [key, item] of Object.entries(value)) {
        if (schema.properties && Object.hasOwn(schema.properties, key)) validate(schema.properties[key], item, key);
        else if (schema.additionalProperties === false) throw new Error('지원하지 않는 입력 항목이 있어요.');
      }
      return;
    case 'array':
      if (!Array.isArray(value) || value.length < schema.minItems || value.length > schema.maxItems) {
        throw new Error(name + ' 항목 수를 확인해 주세요.');
      }
      for (const item of value) validate(schema.items, item, name);
      return;
    case 'integer':
      if (!Number.isInteger(value) || value < schema.minimum || value > schema.maximum) {
        throw new Error(name + ' 항목은 ' + schema.minimum + '~' + schema.maximum + ' 정수여야 해요.');
      }
      return;
    case 'string':
      if (typeof value !== 'string' || value.length > (schema.maxLength ?? Infinity) ||
          (schema.minLength && !value.trim()) || (schema.enum && !schema.enum.includes(value)) ||
          (schema.pattern && !new RegExp(schema.pattern).test(value))) {
        throw new Error(name + ' 항목의 내용 또는 길이를 확인해 주세요.');
      }
  }
}

function draftIp({ game_title, world = '', story = '', characters = [], assets = [] }) {
  return {
    schema: 'pyeol.ip-record-draft/1',
    game_title: game_title.trim(),
    world: world.trim(),
    story: story.trim(),
    characters: characters.map(name => ({ name: name.trim() })),
    assets: assets.map(({ name, source = '', notes = '' }) => ({
      name: name.trim(), source: source.trim(), notes: notes.trim(), permission_status: 'UNREVIEWED',
    })),
    record_status: 'DRAFT_ONLY',
    legal_rights_verified_by_mcp: false,
  };
}

function draftBrief({ game_id, game_title, title, format, duration_seconds, trailer_type = 'teaser', key_message = '', call_to_action = '' }) {
  return {
    schema: 'pyeol.bichum.trailer-brief/0.1',
    game_id: game_id || 'draft-' + game_title.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 72),
    game_title: game_title.trim(),
    title: title.trim(),
    format,
    duration_seconds,
    trailer_type,
    key_message: key_message.trim(),
    call_to_action: call_to_action.trim(),
    assets: [],
    draft_media_ready: false,
    legal_rights_verified_by_mcp: false,
    release_status: 'DRAFT_ONLY',
    final_qa: 'NOT_RUN',
  };
}

function planShots(input) {
  const brief = input.brief ?? input;
  if (input.brief && Object.keys(input).length !== 1) throw new Error('브리프 또는 개별 항목 중 하나만 입력해 주세요.');
  if (input.brief && !['pyeol.bichum.trailer-brief/0.1', 'pyeol.bichum.trailer-brief/0.2'].includes(brief.schema)) {
    throw new Error('펼의 트레일러 브리프 JSON을 입력해 주세요.');
  }
  const { game_title, format, duration_seconds, key_message = '', call_to_action = '' } = brief;
  const selected = { game_title, format, duration_seconds, key_message, call_to_action };
  validate(object({
    game_title: title, format: ratio, duration_seconds: duration,
    key_message: text(1200), call_to_action: text(300),
  }, ['game_title', 'format', 'duration_seconds']), selected);
  const first = duration_seconds * 200;
  const last = duration_seconds * 700;
  return {
    schema: 'bichum.trailer-shot-plan/1',
    ...selected,
    shots: [
      { start_ms: 0, end_ms: first, purpose: '도입', direction: '게임 제목 또는 대표 화면으로 시작' },
      { start_ms: first, end_ms: last, purpose: '실제 플레이', direction: key_message || '대표 조작과 핵심 플레이 장면을 배치' },
      { start_ms: last, end_ms: duration_seconds * 1000, purpose: '엔딩', direction: call_to_action || '검토된 엔딩 문구 배치' },
    ],
    status: 'PLAN_ONLY',
  };
}

function draftHook({ game_title, format, duration_seconds = 22, key_message = '', call_to_action = '', surprising_moment = '', audience = '', hook_count = 3 }) {
  const game = game_title.trim();
  const key = key_message.trim();
  const surprise = surprising_moment.trim();
  const people = audience.trim();
  const cta = call_to_action.trim();
  const angles = [
    { angle: 'question', label: '질문형',
      on_screen_text: '이 게임, 3초면 알 수 있어요',
      narration_line: short(game + ', 3초만 봐요', 30),
      visual_direction: key
        ? '핵심 장면(' + short(key, 60) + ')을 0초부터 바로 보여주고, 제목 화면은 뒤로 미루세요.'
        : '대표 플레이 장면을 0초부터 바로 보여주고, 제목 화면은 뒤로 미루세요.',
      why_it_works: '질문은 답을 확인하려고 시청자가 3초를 더 보게 해요.' },
    { angle: 'surprise', label: '반전형',
      on_screen_text: '이 장면이 반전이에요',
      narration_line: '이 장면, 끝까지 봐요',
      visual_direction: (surprise || key)
        ? '반전 장면(' + short(surprise || key, 60) + ')을 0초부터 보여주세요.'
        : '가장 놀라운 플레이 장면을 0초부터 보여주세요.',
      why_it_works: '예상과 다른 장면은 멈춰서 보게 해요. 없는 장면을 암시하면 안 돼요.' },
    { angle: 'number', label: '숫자형',
      on_screen_text: '단 ' + duration_seconds + '초 안에 결판',
      narration_line: duration_seconds + '초, 딱 한 판만 봐요',
      visual_direction: '가장 긴장되는 플레이 3초를 0초부터 보여주세요.',
      why_it_works: '구체적인 숫자는 영상의 길이를 예고해서 이탈을 줄여요.' },
    { angle: 'empathy', label: '공감형',
      on_screen_text: people ? short(people + '라면 알 거예요', 24) : '아는 사람은 바로 알아요',
      narration_line: people ? short(people + ', 이 장면 기억나요?', 30) : '이 장면, 기억나세요?',
      visual_direction: '공감되는 대표 장면(실수하거나 성공하는 순간)을 0초부터 보여주세요.',
      why_it_works: '아는 사람만 아는 장면은 댓글과 공유를 부르고, 모르는 사람도 궁금해해요.' },
    { angle: 'direct', label: '지시형',
      on_screen_text: cta ? short(cta, 24) : '지금 바로 확인해요',
      narration_line: cta ? short(cta, 30) : '지금, 3초만 봐요',
      visual_direction: '엔딩 문구와 이어지는 핵심 장면을 0초부터 보여주세요.',
      why_it_works: '다음 행동을 정해주면 시청자가 뭘 해야 할지 바로 알아요.' },
  ];
  return {
    schema: 'bichum.hook-draft/1',
    filename: 'bichum-hooks.json',
    game_title: game, format, duration_seconds,
    key_message: key, call_to_action: cta,
    hook_window_ms: { start_ms: 0, end_ms: 3000 },
    hooks: angles.slice(0, hook_count).map((hook, index) => ({ id: 'hook-' + (index + 1), ...hook })),
    notes: [
      '훅은 실제 플레이 화면과 일치하는 것만 사용해 주세요.',
      '화면 문구는 24자 이내, 내레이션은 30자 이내로 짧게 유지했어요.',
      '3초 안에 게임의 핵심이 안 보이면 훅을 바꿔 주세요.',
    ],
    status: 'DRAFT_ONLY',
  };
}

const purposeGuide = {
  '도입': { camera: '고정 화면으로 제목과 대표 화면을 흔들림 없이 찍어요.', action: '타이틀 화면에서 잠시 대기한 뒤 대표 화면으로 넘어가세요.', avoid: '로딩 화면이나 검은 화면을 길게 찍지 마세요.' },
  '실제 플레이': { camera: '플레이어를 화면 중앙에 두고 따라가세요. 9:16이면 좌우 여백을 확인하세요.', action: '핵심 조작을 끊기지 않게 연속으로 수행하세요.', avoid: 'HUD나 채팅창이 핵심 장면을 가리지 않게 하세요.' },
  '엔딩': { camera: '고정 화면으로 엔드 카드와 문구가 끝까지 보이게 찍어요.', action: '엔딩 문구가 다 보일 때까지 기다리세요.', avoid: '엔딩 전에 녹화를 끊지 마세요.' },
};

function defaultShots(duration_seconds, key_message, call_to_action) {
  const first = duration_seconds * 200;
  const last = duration_seconds * 700;
  return [
    { start_ms: 0, end_ms: first, purpose: '도입', direction: '게임 제목 또는 대표 화면으로 시작' },
    { start_ms: first, end_ms: last, purpose: '실제 플레이', direction: key_message || '대표 조작과 핵심 플레이 장면을 배치' },
    { start_ms: last, end_ms: duration_seconds * 1000, purpose: '엔딩', direction: call_to_action || '검토된 엔딩 문구 배치' },
  ];
}

function buildCapture(input) {
  const plan = input.plan;
  let selected;
  let shots;
  let source;
  if (plan) {
    if (Object.keys(input).some(key => key !== 'plan' && key !== 'platform')) {
      throw new Error('컷 구성표 또는 개별 항목 중 하나만 입력해 주세요.');
    }
    if (!['bichum.trailer-shot-plan/1'].includes(plan.schema)) {
      throw new Error('비춤의 컷 구성표 JSON을 입력해 주세요.');
    }
    selected = { game_title: plan.game_title, format: plan.format, duration_seconds: plan.duration_seconds, key_message: plan.key_message ?? '', call_to_action: plan.call_to_action ?? '' };
    if (!Array.isArray(plan.shots) || !plan.shots.length) throw new Error('컷 구성표에 샷이 없어요. 컷 구성표부터 다시 만들어 주세요.');
    shots = plan.shots;
    source = 'bichum.trailer-shot-plan/1';
  } else {
    selected = { game_title: input.game_title, format: input.format, duration_seconds: input.duration_seconds, key_message: input.key_message ?? '', call_to_action: input.call_to_action ?? '' };
    shots = defaultShots(selected.duration_seconds, selected.key_message, selected.call_to_action);
    source = 'manual';
  }
  validate(object({
    game_title: title, format: ratio, duration_seconds: duration,
    key_message: text(1200), call_to_action: text(300),
  }, ['game_title', 'format', 'duration_seconds']), selected);
  for (const [index, shot] of shots.entries()) {
    if (!Number.isInteger(shot.start_ms) || !Number.isInteger(shot.end_ms) || shot.end_ms <= shot.start_ms ||
        typeof shot.purpose !== 'string' || !shot.purpose.trim()) {
      throw new Error((index + 1) + '번 샷의 시작·종료 시각과 용도를 확인해 주세요.');
    }
  }
  const game = selected.game_title.trim();
  const key = slug(game);
  const platform = input.platform ?? 'pc';
  const items = shots.map((shot, index) => {
    const guide = purposeGuide[shot.purpose] ?? { camera: '샷의 목적이 드러나게 찍어요.', action: (shot.direction ?? '').trim(), avoid: '핵심 장면이 화면 밖으로 나가지 않게 하세요.' };
    return {
      shot_no: index + 1, purpose: shot.purpose, start_ms: shot.start_ms, end_ms: shot.end_ms,
      capture_seconds: (shot.end_ms - shot.start_ms) / 1000,
      scene: (shot.direction ?? '').trim(),
      camera: guide.camera, action: guide.action, avoid: guide.avoid,
      file_name: key + '-shot-' + String(index + 1).padStart(2, '0') + '.mp4',
      status: 'TODO',
    };
  });
  return {
    schema: 'bichum.capture-checklist/1',
    filename: 'bichum-capture-checklist.json',
    game_title: game, format: selected.format, duration_seconds: selected.duration_seconds,
    key_message: selected.key_message.trim(), call_to_action: selected.call_to_action.trim(),
    platform, resolution: resolutions[selected.format], frame_rate: '60fps 권장',
    source_plan: source,
    hook_capture: { start_ms: 0, end_ms: 3000, note: '도입 샷의 첫 3초가 훅이에요. 훅에 쓸 장면을 따로 한 번 더 찍어 두면 편집할 때 편해요.' },
    setup: [
      '해상도 ' + resolutions[selected.format] + '·60fps로 녹화 설정을 확인하세요.',
      '게임 소리는 켜고, 필요 없으면 마이크는 끄세요.',
      '핵심 장면을 가리는 HUD·채팅창·알림은 미리 정리하세요.',
      '저장 공간이 충분한지, 저장 폴더를 미리 정했는지 확인하세요.',
    ],
    items,
    verify_after: ['각 파일을 끝까지 재생해 끊김이 없는지 확인하세요.', '파일명과 길이를 컷 구성표와 대조하세요.', '원본을 한 부 백업하세요.'],
    status: 'CHECKLIST_ONLY',
  };
}

function srtClock(ms) {
  const value = new Date(ms).toISOString().slice(11, 23);
  return value.replace('.', ',');
}

function makeSrt({ cues }) {
  let previousEnd = 0;
  const segments = cues.map(({ start_ms, end_ms, text }, index) => {
    const content = text.trim().replace(/\r\n?/g, '\n');
    if (start_ms < previousEnd || end_ms <= start_ms) {
      throw new Error((index + 1) + '번 자막의 시작·종료 시각과 앞 자막의 겹침을 확인해 주세요.');
    }
    if (content.split('\n').some(line => !line.trim() || /[<>&]|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(line))) {
      throw new Error((index + 1) + '번 자막은 빈 줄이나 서식 기호가 없는 일반 문장으로 입력해 주세요.');
    }
    previousEnd = end_ms;
    return (index + 1) + '\n' + srtClock(start_ms) + ' --> ' + srtClock(end_ms) + '\n' + content;
  });
  return { filename: 'bichum-subtitles.srt', cue_count: cues.length, srt: segments.join('\n\n') + '\n' };
}

export function listStudioTools(key) {
  return tools[key].map(([name, description, inputSchema]) => ({
    name, description, inputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }));
}

export function callStudioTool(key, name, input) {
  const tool = tools[key].find(item => item[0] === name);
  if (!tool) throw new Error('이 스튜디오에서 제공하는 도구를 선택해 주세요.');
  const [, , schema, run] = tool;
  validate(schema, input);
  return run(input);
}