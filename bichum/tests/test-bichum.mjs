// Bichum v1.7.0 integration test — runs the Worker entrypoint in-process.
// Usage: node tests/test-bichum.mjs   (run from bichum/)
import worker from '../bichum.mjs';

const BASE = 'https://bichum.test';
let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name} ${detail}`); }
}
async function mcp(body) {
  const res = await worker.fetch(new Request(BASE + '/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify(body),
  }));
  const text = await res.text();
  const json = text.split('\n').map((l) => l.replace(/^data:\s*/, '')).map((l) => { try { return JSON.parse(l); } catch { return null; } }).find(Boolean);
  return { status: res.status, json: json ?? null, raw: text };
}

const EXPECTED_TOOLS = [
  'bichum_plan_trailer_shots', 'bichum_build_srt', 'bichum_draft_hook',
  'bichum_build_capture_checklist', 'bichum_export_edit_manifest',
  'bichum_build_asset_ledger', 'bichum_check_safe_zones', 'bichum_score_hooks',
  'bichum_draft_narration', 'bichum_plan_word_captions',
  'bichum_plan_audio', 'bichum_plan_publish',
];

// 1. root page
{
  const res = await worker.fetch(new Request(BASE + '/', { method: 'GET' }));
  check('GET / returns 200', res.status === 200, `status=${res.status}`);
}

// 2. initialize → v1.7.0
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
  check('initialize 200', status === 200, `status=${status}`);
  check('server version is 1.7.0', json?.result?.serverInfo?.version === '1.7.0', JSON.stringify(json?.result?.serverInfo));
}

// 3. tools/list → exactly the 12 expected tools
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const names = (json?.result?.tools ?? []).map((t) => t.name).sort();
  check('tools/list 200', status === 200, `status=${status}`);
  check('tools/list has 12 tools', names.length === 12, `got ${names.length}: ${names.join(',')}`);
  check('tool names match v1.7.0', JSON.stringify(names) === JSON.stringify([...EXPECTED_TOOLS].sort()), names.join(','));
}

// 4. tools/call bichum_build_srt
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'bichum_build_srt', arguments: { cues: [{ start_ms: 0, end_ms: 3000, text: '밤이 깊어질수록, 도시는 깨어난다' }] } } });
  const out = JSON.stringify(json?.result ?? json);
  check('bichum_build_srt 200', status === 200, `status=${status}`);
  check('SRT contains timestamp', out.includes('00:00:00,000'), out.slice(0, 200));
}

// 5. tools/call bichum_plan_trailer_shots
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'bichum_plan_trailer_shots', arguments: { game_title: '다시, 놀이터', format: '16:9', duration_seconds: 30, key_message: '잊힌 놀이터를 되살리는 이야기' } } });
  const out = JSON.stringify(json?.result ?? json);
  check('bichum_plan_trailer_shots 200', status === 200, `status=${status}`);
  check('shot plan returned', out.includes('bichum.trailer-shot-plan/1') || out.includes('shot'), out.slice(0, 200));
}

// 6. tools/call bichum_draft_hook
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'bichum_draft_hook', arguments: { game_title: '다시, 놀이터', format: '16:9', key_message: '잊힌 놀이터를 되살리는 이야기' } } });
  const out = JSON.stringify(json?.result ?? json);
  check('bichum_draft_hook 200', status === 200, `status=${status}`);
  check('hook draft returned', out.includes('bichum.hook-draft/1') || out.includes('hook'), out.slice(0, 200));
}

// 7. tools/call bichum_plan_audio
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'bichum_plan_audio', arguments: { game_title: '다시, 놀이터', format: '16:9', duration_seconds: 32, bpm: 120 } } });
  const out = JSON.stringify(json?.result ?? json);
  check('bichum_plan_audio 200', status === 200, `status=${status}`);
  check('audio plan returned', out.includes('bichum.audio-plan/1'), out.slice(0, 200));
}

// 8. tools/call bichum_plan_publish
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'bichum_plan_publish', arguments: { game_title: '다시, 놀이터', format: '16:9', duration_seconds: 32, peak_ms: 15000, platforms: ['youtube'], overlay_text: '어른들의 놀이터' } } });
  const out = JSON.stringify(json?.result ?? json);
  check('bichum_plan_publish 200', status === 200, `status=${status}`);
  check('publish pack returned', out.includes('bichum.publish-pack/1'), out.slice(0, 200));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
