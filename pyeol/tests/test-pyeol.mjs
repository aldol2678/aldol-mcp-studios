// Pyeol v1.1.0 integration test — runs the Worker entrypoint in-process.
// Usage: node tests/test-pyeol.mjs   (run from pyeol/)
import worker from '../pyeol.mjs';

const BASE = 'https://pyeol.test';
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
  'pyeol_draft_ip_record',
  'pyeol_draft_trailer_brief',
];

// 1. root page
{
  const res = await worker.fetch(new Request(BASE + '/', { method: 'GET' }));
  check('GET / returns 200', res.status === 200, `status=${res.status}`);
}

// 2. initialize → v1.1.0
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
  check('initialize 200', status === 200, `status=${status}`);
  check('server version is 1.1.0', json?.result?.serverInfo?.version === '1.1.0', JSON.stringify(json?.result?.serverInfo));
}

// 3. tools/list → exactly the 2 expected tools
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const names = (json?.result?.tools ?? []).map((t) => t.name).sort();
  check('tools/list 200', status === 200, `status=${status}`);
  check('tools/list has 2 tools', names.length === 2, `got ${names.length}: ${names.join(',')}`);
  check('tool names match v1.1.0', JSON.stringify(names) === JSON.stringify([...EXPECTED_TOOLS].sort()), names.join(','));
}

// 4. tools/call pyeol_draft_ip_record
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'pyeol_draft_ip_record', arguments: { game_title: '다시, 놀이터', world: '잊힌 놀이터가 깨어나는 마을', story: '아이들이 떠난 놀이터에 다시 불이 켜진다', characters: ['도깨비', '아이'] } } });
  const out = JSON.stringify(json?.result ?? json);
  check('pyeol_draft_ip_record 200', status === 200, `status=${status}`);
  check('IP record draft returned', out.includes('pyeol.ip-record-draft/1') && out.includes('DRAFT_ONLY'), out.slice(0, 200));
}

// 5. tools/call pyeol_draft_trailer_brief
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'pyeol_draft_trailer_brief', arguments: { game_title: '다시, 놀이터', title: '어른들의 놀이터', format: '16:9', duration_seconds: 30, key_message: '잊힌 놀이터를 되살리는 이야기', call_to_action: '지금 플레이하기' } } });
  const out = JSON.stringify(json?.result ?? json);
  check('pyeol_draft_trailer_brief 200', status === 200, `status=${status}`);
  check('trailer brief returned', out.includes('pyeol.bichum.trailer-brief/0.1') && out.includes('DRAFT_ONLY'), out.slice(0, 200));
}

// 6. tools/call pyeol_draft_trailer_brief without title → error (matches live)
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'pyeol_draft_trailer_brief', arguments: { game_title: '다시, 놀이터', format: '16:9', duration_seconds: 30 } } });
  const out = JSON.stringify(json?.result ?? json);
  check('trailer brief without title errors', status === 200 && out.includes('title 항목을 입력해 주세요'), `status=${status} ${out.slice(0, 200)}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
