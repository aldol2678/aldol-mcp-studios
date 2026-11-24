const ratios = ['16:9', '9:16', '1:1'];
const trailerTypes = ['teaser', 'gameplay', 'launch', 'shortform', 'devlog'];
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
