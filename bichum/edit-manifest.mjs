// Draft for Bichum v1.3.0 — bichum_export_edit_manifest
// Status: DRAFT, not deployed. Prepared 2026-11-23 in a proactive look-back.
// Turns a Bichum shot plan (bichum.trailer-shot-plan/1) into an edit manifest:
//   - CMX3600 EDL text (non-drop-frame, frame-exact at the chosen frame rate)
//   - OpenTimelineIO Timeline JSON (.otio, RationalTime frame-exact)
//   - YouTube chapters text
// Like the other Bichum tools it is stateless and renders no video.
// Assumptions (stated in the output notes, not hidden):
//   - Each shot's source clip is trimmed to the shot, so source in/out run
//     00:00:00:00 .. shot duration. The record timeline is frame-exact.
//   - Shots must be contiguous: first starts at 0, each starts where the
//     previous ends, last ends at duration_seconds. Gaps are rejected.
// References: OpenTimelineIO (Apache-2.0), auto-editor / MakeMyClip EDL
// export, beat-synced-edit staged JSON plans — see the research page
// "비춤 오픈소스 참고 조사" (research_notes/bichum-opensource-video-tools-20261123-1338).

const FPS_OPTIONS = [24, 25, 30, 60];
const slug = value => value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'game';

function timecode(ms, fps) {
  const frames = Math.round((ms / 1000) * fps);
  const f = frames % fps;
  const totalSeconds = Math.floor(frames / fps);
  const pad = n => String(n).padStart(2, '0');
  return pad(Math.floor(totalSeconds / 3600)) + ':' + pad(Math.floor(totalSeconds / 60) % 60) + ':' + pad(totalSeconds % 60) + ':' + pad(f);
}

function chapterStamp(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  return Math.floor(totalSeconds / 60) + ':' + String(totalSeconds % 60).padStart(2, '0');
}

const rational = (value, rate) => ({ OTIO_SCHEMA: 'RationalTime.1', value, rate });
const timeRange = (start, duration, rate) => ({ OTIO_SCHEMA: 'TimeRange.1', start_time: rational(start, rate), duration: rational(duration, rate) });

function defaultShots(durationSeconds) {
  const first = durationSeconds * 200;
  const last = durationSeconds * 700;
  return [
    { start_ms: 0, end_ms: first, purpose: '도입', direction: '게임 제목 또는 대표 화면으로 시작' },
    { start_ms: first, end_ms: last, purpose: '실제 플레이', direction: '대표 조작과 핵심 플레이 장면을 배치' },
    { start_ms: last, end_ms: durationSeconds * 1000, purpose: '엔딩', direction: '검토된 엔딩 문구 배치' },
  ];
}

export function buildEditManifest(input) {
  const plan = input.plan;
  let selected;
  let shots;
  let source;
  if (plan) {
    if (Object.keys(input).some(key => !['plan', 'frame_rate', 'sources'].includes(key))) {
      throw new Error('컷 구성표 또는 개별 항목 중 하나만 입력해 주세요.');
    }
    if (plan.schema !== 'bichum.trailer-shot-plan/1') {
      throw new Error('비춤의 컷 구성표 JSON을 입력해 주세요.');
    }
    selected = { game_title: plan.game_title, format: plan.format, duration_seconds: plan.duration_seconds };
    if (!Array.isArray(plan.shots) || !plan.shots.length) throw new Error('컷 구성표에 샷이 없어요. 컷 구성표부터 다시 만들어 주세요.');
    shots = plan.shots;
    source = 'bichum.trailer-shot-plan/1';
  } else {
    selected = { game_title: input.game_title, format: input.format, duration_seconds: input.duration_seconds };
    shots = defaultShots(selected.duration_seconds);
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
  const fps = input.frame_rate ?? 30;
  if (!FPS_OPTIONS.includes(fps)) throw new Error('프레임 속도는 24, 25, 30, 60 중 하나여야 해요.');
  const totalMs = selected.duration_seconds * 1000;
  let cursor = 0;
  for (const [index, shot] of shots.entries()) {
    if (!Number.isInteger(shot.start_ms) || !Number.isInteger(shot.end_ms) || shot.end_ms <= shot.start_ms ||
        typeof shot.purpose !== 'string' || !shot.purpose.trim()) {
      throw new Error((index + 1) + '번 샷의 시작·종료 시각과 용도를 확인해 주세요.');
    }
    if (shot.start_ms !== cursor) {
      throw new Error((index + 1) + '번 샷이 앞 샷과 이어지지 않아요. 샷 사이에 빈 구간이 있으면 안 돼요.');
    }
    cursor = shot.end_ms;
  }
  if (cursor !== totalMs) {
    throw new Error('마지막 샷이 영상의 끝(' + selected.duration_seconds + '초)과 맞지 않아요.');
  }
  const game = selected.game_title.trim();
  const key = slug(game);
  const byShot = new Map();
  for (const item of input.sources ?? []) {
    if (!Number.isInteger(item.shot_no) || item.shot_no < 1 || item.shot_no > shots.length ||
        typeof item.file_name !== 'string' || !item.file_name.trim()) {
      throw new Error('sources 항목의 샷 번호와 파일명을 확인해 주세요.');
    }
    if (byShot.has(item.shot_no)) throw new Error(item.shot_no + '번 샷의 원본 파일이 중복됐어요.');
    byShot.set(item.shot_no, item.file_name.trim());
  }
  let recordFrames = 0;
  const events = shots.map((shot, index) => {
    const frames = Math.round(((shot.end_ms - shot.start_ms) / 1000) * fps);
    const event = {
      event_no: index + 1,
      shot_no: index + 1,
      purpose: shot.purpose,
      direction: (shot.direction ?? '').trim(),
      file_name: byShot.get(index + 1) ?? (key + '-shot-' + String(index + 1).padStart(2, '0') + '.mp4'),
      source_in_tc: timecode(0, fps),
      source_out_tc: timecode(shot.end_ms - shot.start_ms, fps),
      record_in_tc: timecode(recordFrames * 1000 / fps, fps),
      record_out_tc: timecode((recordFrames + frames) * 1000 / fps, fps),
      frames,
    };
    recordFrames += frames;
    return event;
  });
  const edlLines = ['TITLE: ' + game, 'FCM: NON-DROP FRAME', ''];
  for (const event of events) {
    edlLines.push(
      String(event.event_no).padStart(3, '0') + '  AX       V     C        ' +
      event.source_in_tc + ' ' + event.source_out_tc + ' ' + event.record_in_tc + ' ' + event.record_out_tc,
    );
    edlLines.push('* FROM CLIP NAME: ' + event.file_name);
    if (event.purpose || event.direction) edlLines.push('* ' + event.purpose + (event.direction ? ' — ' + event.direction : ''));
  }
  const clips = events.map(event => ({
    OTIO_SCHEMA: 'Clip.1',
    name: 'shot-' + String(event.shot_no).padStart(2, '0') + ' · ' + event.purpose,
    source_range: timeRange(0, event.frames, fps),
    media_reference: {
      OTIO_SCHEMA: 'ExternalReference.1',
      target_url: event.file_name,
      available_range: timeRange(0, event.frames, fps),
    },
    markers: [{
      OTIO_SCHEMA: 'Marker.1',
      name: event.purpose,
      marked_range: timeRange(0, event.frames, fps),
      metadata: { direction: event.direction },
    }],
    metadata: {},
  }));
  const otio = {
    OTIO_SCHEMA: 'Timeline.1',
    name: game,
    metadata: { frame_rate: fps, source_plan: source, format: selected.format },
    tracks: {
      OTIO_SCHEMA: 'Stack.1',
      name: 'tracks',
      children: [{
        OTIO_SCHEMA: 'Track.1',
        name: 'V1',
        kind: 'Video',
        children: clips,
        markers: [],
        metadata: {},
      }],
      markers: [],
      metadata: {},
    },
  };
  const chapters = events.map(event => chapterStamp(shots[event.shot_no - 1].start_ms) + ' ' + event.purpose).join('\n');
  return {
    schema: 'bichum.edit-manifest/1',
    filename: 'bichum-edit-manifest.json',
    game_title: game,
    format: selected.format,
    duration_seconds: selected.duration_seconds,
    frame_rate: fps,
    source_plan: source,
    total_frames: recordFrames,
    events,
    edl: edlLines.join('\n') + '\n',
    otio,
    chapters: chapters + '\n',
    notes: [
      '원본 클립은 각 샷 길이만큼 잘린 파일이라고 가정했어요. 소스 인·아웃은 00:00:00:00부터 샷 길이까지예요.',
      '레코드 타임라인은 선택한 프레임 속도(' + fps + 'fps) 기준으로 프레임 단위까지 정확해요.',
      'EDL은 CMX3600, 논드롭 프레임이에요. OTIO JSON은 OpenTimelineIO 어댑터로 Premiere·Resolve·Final Cut용으로 바꿀 수 있어요.',
      '챕터는 유튜브 챕터 형식이에요. 첫 챕터는 0:00부터 시작해야 해요.',
    ],
    status: 'MANIFEST_ONLY',
  };
}
