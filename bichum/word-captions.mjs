// Draft for Bichum v1.6.0 — bichum_plan_word_captions
// Status: DRAFT, not deployed. Prepared 2026-11-24.
// Turns a narration plan (#3), an SRT result, or direct lines into
// word-level caption timings and a styled ASS file (karaoke {\k} tags).
// Times are estimates from character-count ratios inside each line;
// WhisperX replaces them with real alignment in the render environment.
// This tool only plans — it never listens to audio and never burns
// captions into video.
//
// Deterministic rules (from draft-next-features/DESIGN.md #7):
//   - Words split on whitespace (Korean and English alike). A spaceless
//     sentence over 20 chars is cut into 10-char chunks so one long word
//     never fills the screen. Punctuation stays on the preceding word.
//   - Word time: round(line length * word chars / line chars), minimum
//     80 ms for every word but the last; the last word absorbs rounding
//     (and the 80 ms raises) so word times sum to the line length exactly.
//   - words_per_line groups words per ASS Dialogue; {\k} numbers are
//     10 ms units and are adjusted on the last word so their sum equals
//     the line length in 10 ms units.
//   - Styles (9:16 base size; 16:9 scales x0.9, 1:1 x1.0): karaoke 64,
//     hormozi 72, mrbeast 80, minimal 48, tiktok 64. MarginV 240 / 120 /
//     180 px (9:16 / 16:9 / 1:1). PlayRes 1080x1920 / 1920x1080 /
//     1080x1080. Alignment 2 (bottom centre).
//   - Font: Noto Sans KR, or Arial when the language is English.
//   - ASS time format H:MM:SS.cc.
//
// Notes on the design doc (see README.md "설계안과 달라진 점"):
//   - The design's V4+ Styles format has no Outline-width column, so
//     tiktok's "thicker black outline" cannot be expressed in the Style
//     line itself; it is recorded in notes instead.
//   - hormozi's active colour is "yellow-ish" without a fixed hex, so it
//     uses highlight_color (default #FFD60A, yellow).
//   - A line shorter than 80 ms x (words - 1) cannot keep the 80 ms floor
//     and still sum to the line length. In that degenerate case the floor
//     is dropped and times are split proportionally (last word absorbs),
//     so the sum is still exact. Narration lines are >= 500 ms, so this
//     only matters for very short hand-written SRT cues.

const STYLES = ['karaoke', 'hormozi', 'mrbeast', 'minimal', 'tiktok'];
const FORMATS = ['16:9', '9:16', '1:1'];
const PLAY_RES = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080] };
const MARGIN_V = { '16:9': 120, '9:16': 240, '1:1': 180 };
// size: 9:16 base. primary: base colour. active: 'highlight' means the
// highlight_color input, otherwise a fixed hex. alpha: ASS alpha byte
// for the primary colour (00 = opaque, 1A = 90% opaque).
const STYLE_TABLE = {
  karaoke: { size: 64, primary: '#FFFFFF', active: 'highlight', bold: -1, alpha: '00' },
  hormozi: { size: 72, primary: '#FFFFFF', active: 'highlight', bold: -1, alpha: '00' },
  mrbeast: { size: 80, primary: '#FFD60A', active: '#FFFFFF', bold: -1, alpha: '00' },
  minimal: { size: 48, primary: '#FFFFFF', active: '#FFFFFF', bold: 0, alpha: '1A' },
  tiktok: { size: 64, primary: '#FFFFFF', active: 'highlight', bold: -1, alpha: '00' },
};

const pad2 = n => String(n).padStart(2, '0');

function assTime(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor(ms / 60000) % 60;
  const seconds = Math.floor(ms / 1000) % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return hours + ':' + pad2(minutes) + ':' + pad2(seconds) + '.' + pad2(centiseconds);
}

function srtClockToMs(clock) {
  const match = /^(\d+):(\d{2}):(\d{2}),(\d{3})$/.exec(clock.trim());
  if (!match) return null;
  return (Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000 + Number(match[4]);
}

function parseSrtText(text) {
  const blocks = text.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map(block => block.trim()).filter(Boolean);
  const cues = [];
  for (const [index, block] of blocks.entries()) {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const timeLine = lines.find(line => line.includes('-->'));
    if (!timeLine) throw new Error((index + 1) + '번 자막의 시간 형식을 확인해 주세요.');
    const [startClock, endClock] = timeLine.split('-->').map(part => part.trim());
    const start = srtClockToMs(startClock);
    const end = srtClockToMs(endClock);
    if (start === null || end === null) throw new Error((index + 1) + '번 자막의 시간 형식을 확인해 주세요.');
    const content = lines.filter(line => line !== timeLine && !/^\d+$/.test(line)).join(' ');
    cues.push({ start_ms: start, end_ms: end, text: content });
  }
  if (!cues.length) throw new Error('SRT 자막에 큐가 없어요.');
  return cues;
}

// Same rules as makeSrt in studio-tools.mjs: no overlap, end > start,
// no empty lines, no formatting symbols.
function validateCues(cues) {
  if (!Array.isArray(cues) || cues.length < 1 || cues.length > 80) {
    throw new Error('lines 항목 수를 확인해 주세요.');
  }
  let previousEnd = 0;
  for (const [index, cue] of cues.entries()) {
    const label = (index + 1) + '번 자막';
    if (!cue || typeof cue !== 'object' || Array.isArray(cue)) {
      throw new Error(label + ' 항목의 내용 또는 길이를 확인해 주세요.');
    }
    if (!Number.isInteger(cue.start_ms) || cue.start_ms < 0 || cue.start_ms > 7200000 ||
        !Number.isInteger(cue.end_ms) || cue.end_ms < 1 || cue.end_ms > 7200000) {
      throw new Error(label + ' 항목은 0~7200000 정수여야 해요.');
    }
    if (cue.start_ms < previousEnd || cue.end_ms <= cue.start_ms) {
      throw new Error(label + '의 시작·종료 시각과 앞 자막의 겹침을 확인해 주세요.');
    }
    if (typeof cue.text !== 'string' || !cue.text.trim() || cue.text.trim().length > 240) {
      throw new Error(label + ' 항목의 내용 또는 길이를 확인해 주세요.');
    }
    const content = cue.text.trim().replace(/\r\n?/g, '\n');
    if (content.split('\n').some(line => !line.trim() || /[<>&]|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(line))) {
      throw new Error(label + '은 빈 줄이나 서식 기호가 없는 일반 문장으로 입력해 주세요.');
    }
    previousEnd = cue.end_ms;
  }
  return cues.map(cue => ({ start_ms: cue.start_ms, end_ms: cue.end_ms, text: cue.text.trim().replace(/\r\n?/g, ' ') }));
}

function splitWords(text) {
  const trimmed = text.trim();
  if (!trimmed.includes(' ') && [...trimmed].length > 20) {
    const chars = [...trimmed];
    const chunks = [];
    for (let i = 0; i < chars.length; i += 10) chunks.push(chars.slice(i, i + 10).join(''));
    return chunks;
  }
  return trimmed.split(/\s+/).filter(Boolean);
}

function wordTimes(lineMs, words) {
  const charCounts = words.map(word => [...word].length);
  const totalChars = charCounts.reduce((sum, count) => sum + count, 0);
  if (words.length === 1) return [lineMs];
  let times = charCounts.map(count => Math.round((lineMs * count) / totalChars));
  for (let i = 0; i < times.length - 1; i++) {
    if (times[i] < 80) times[i] = 80;
  }
  let last = lineMs - times.slice(0, -1).reduce((sum, time) => sum + time, 0);
  if (last <= 0) {
    // Degenerate: the line is too short for the 80 ms floor. Drop the
    // floor and split proportionally; the last word still absorbs.
    times = charCounts.map(count => Math.max(1, Math.round((lineMs * count) / totalChars)));
    last = lineMs - times.slice(0, -1).reduce((sum, time) => sum + time, 0);
    if (last <= 0) {
      const each = Math.floor(lineMs / words.length);
      times = words.map(() => each);
      last = lineMs - each * (words.length - 1);
    }
  }
  times[times.length - 1] = last;
  return times;
}

function hexToBgr(hex) {
  const r = hex.slice(1, 3);
  const g = hex.slice(3, 5);
  const b = hex.slice(5, 7);
  return b + g + r;
}

export function planWordCaptions(input) {
  const sources = ['narration', 'srt', 'lines'].filter(key => input[key] !== undefined);
  if (sources.length !== 1) {
    throw new Error('내레이션 계획, SRT 자막, 직접 입력 중 하나만 넣어 주세요.');
  }

  let cues;
  let format = input.format ?? '9:16';
  let language = 'ko';
  let title = 'Bichum';
  if (input.narration !== undefined) {
    const narration = input.narration;
    if (!narration || typeof narration !== 'object' || narration.schema !== 'bichum.narration-plan/1') {
      throw new Error('비춤의 내레이션 계획 JSON을 입력해 주세요.');
    }
    if (!Array.isArray(narration.lines) || !narration.lines.length) {
      throw new Error('내레이션 계획에 대본 줄이 없어요.');
    }
    cues = narration.lines.map(line => ({ start_ms: line.start_ms, end_ms: line.end_ms, text: line.text }));
    format = narration.format ?? format;
    language = narration.language ?? 'ko';
    title = typeof narration.game_title === 'string' && narration.game_title.trim() ? narration.game_title.trim() : 'Bichum';
  } else if (input.srt !== undefined) {
    const srt = input.srt;
    if (Array.isArray(srt)) {
      cues = srt;
    } else if (srt && typeof srt === 'object' && typeof srt.srt === 'string') {
      cues = parseSrtText(srt.srt);
    } else if (srt && typeof srt === 'object' && Array.isArray(srt.cues)) {
      cues = srt.cues;
    } else {
      throw new Error('SRT 자막 결과 JSON 또는 큐 배열을 입력해 주세요.');
    }
  } else {
    cues = input.lines;
  }
  cues = validateCues(cues);

  if (input.format !== undefined) format = input.format;
  if (!FORMATS.includes(format)) {
    throw new Error('format 항목의 내용 또는 길이를 확인해 주세요.');
  }
  const style = input.style ?? 'karaoke';
  if (!STYLES.includes(style)) {
    throw new Error('style 항목의 내용 또는 길이를 확인해 주세요.');
  }
  const wordsPerLine = input.words_per_line ?? 2;
  if (!Number.isInteger(wordsPerLine) || wordsPerLine < 1 || wordsPerLine > 4) {
    throw new Error('words_per_line 항목은 1~4 정수여야 해요.');
  }
  const highlightColor = input.highlight_color ?? '#FFD60A';
  if (typeof highlightColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(highlightColor)) {
    throw new Error('highlight_color 항목은 #RRGGBB 형식이어야 해요.');
  }
  if (input.narration === undefined && input.srt === undefined) {
    const text = cues.map(cue => cue.text).join(' ');
    language = /[^\x00-\x7F]/.test(text) ? 'ko' : 'en';
  }

  const spec = STYLE_TABLE[style];
  const fontSize = format === '16:9' ? Math.round(spec.size * 0.9) : spec.size;
  const fontName = language === 'en' ? 'Arial' : 'Noto Sans KR';
  const primary = '&H' + spec.alpha + hexToBgr(spec.primary);
  const activeHex = spec.active === 'highlight' ? highlightColor : spec.active;
  const secondary = '&H00' + hexToBgr(activeHex);

  const lines = cues.map((cue, index) => {
    const words = splitWords(cue.text);
    const lineMs = cue.end_ms - cue.start_ms;
    const times = wordTimes(lineMs, words);
    let cursor = cue.start_ms;
    const timed = words.map((word, wordIndex) => {
      const entry = { word, start_ms: cursor, end_ms: cursor + times[wordIndex], estimated: true };
      cursor += times[wordIndex];
      return entry;
    });
    return {
      line_id: 'cap-' + String(index + 1).padStart(2, '0'),
      start_ms: cue.start_ms,
      end_ms: cue.end_ms,
      text: cue.text,
      words: timed,
    };
  });

  const dialogueLines = [];
  for (const line of lines) {
    const lineMs = line.end_ms - line.start_ms;
    let kValues = line.words.map(word => Math.round((word.end_ms - word.start_ms) / 10));
    const targetK = Math.round(lineMs / 10);
    kValues[kValues.length - 1] += targetK - kValues.reduce((sum, value) => sum + value, 0);
    for (let start = 0; start < line.words.length; start += wordsPerLine) {
      const group = line.words.slice(start, start + wordsPerLine);
      const groupK = kValues.slice(start, start + wordsPerLine);
      const text = group.map((word, i) => '{\\k' + groupK[i] + '}' + word.word).join(' ');
      dialogueLines.push(
        'Dialogue: 0,' + assTime(group[0].start_ms) + ',' + assTime(group[group.length - 1].end_ms) +
        ',Default,' + text,
      );
    }
  }

  const [resX, resY] = PLAY_RES[format];
  const ass = [
    '[Script Info]',
    'Title: ' + title,
    'PlayResX: ' + resX,
    'PlayResY: ' + resY,
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Alignment, MarginV',
    'Style: Default, ' + fontName + ', ' + fontSize + ', ' + primary + ', ' + secondary +
      ', &H00000000, &H80000000, ' + spec.bold + ', 0, 2, ' + MARGIN_V[format],
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Text',
    ...dialogueLines,
    '',
  ].join('\n');

  const notes = [
    'ASS는 FFmpeg·Premiere·CapCut에서 자막으로 가져올 수 있어요.',
    '단어 시간은 추정치예요. 실제 음성과 100ms 이상 어긋나면 WhisperX 정렬 결과를 쓰세요.',
  ];
  if (style === 'tiktok') {
    notes.push('틱톡 스타일의 두꺼운 검은 테두리는 이 ASS 형식에 굵기 항목이 없어서, 렌더 환경에서 Outline 굵기를 올려 주세요.');
  }

  return {
    schema: 'bichum.word-captions/1',
    filename: 'bichum-word-captions.ass',
    format,
    style,
    words_per_line: wordsPerLine,
    highlight_color: highlightColor,
    lines,
    ass,
    alignment: {
      engine: 'whisperx',
      mode: 'script-forced',
      to_be_aligned_by_whisperx: true,
      note: '단어 시간은 대본 글자 수 비율로 추정한 값이에요. WhisperX가 실제 음성으로 맞추면 이 값을 덮어써요.',
    },
    notes,
    to_be_measured: { actual_word_times: 'WhisperX 단어 정렬 결과로 채울 것' },
    status: 'CAPTION_PLAN_ONLY',
  };
}
