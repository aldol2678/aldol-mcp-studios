// Padong v0.4.0 integration test — runs the Worker entrypoint in-process.
// Usage: node tests/test-padong.mjs   (run from padong/)
import worker from '../padong.mjs';

const BASE = 'https://padong.test';
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
  'marketing_project_profile', 'marketing_create_brief', 'marketing_generate_copy',
  'marketing_review_campaign', 'marketing_build_tracking',
];

// 1. root page
{
  const res = await worker.fetch(new Request(BASE + '/', { method: 'GET' }));
  check('GET / returns 200', res.status === 200, `status=${res.status}`);
}

// 2. status endpoint
{
  const res = await worker.fetch(new Request(BASE + '/api/status', { method: 'GET' }));
  const body = await res.text();
  check('GET /api/status returns 200', res.status === 200, `status=${res.status}`);
  check('status reports 0.4.0 and 5 tools', body.includes('"0.4.0"') && body.includes('5'), body.slice(0, 200));
}

// 3. initialize → v0.4.0
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
  check('initialize 200', status === 200, `status=${status}`);
  check('server version is 0.4.0', json?.result?.serverInfo?.version === '0.4.0', JSON.stringify(json?.result?.serverInfo));
  check('server name is aldol-padong-studio', json?.result?.serverInfo?.name === 'aldol-padong-studio', JSON.stringify(json?.result?.serverInfo));
}

// 4. tools/list → exactly the 5 expected tools
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const names = (json?.result?.tools ?? []).map((t) => t.name).sort();
  check('tools/list 200', status === 200, `status=${status}`);
  check('tools/list has 5 tools', names.length === 5, `got ${names.length}: ${names.join(',')}`);
  check('tool names match v0.4.0', JSON.stringify(names) === JSON.stringify([...EXPECTED_TOOLS].sort()), names.join(','));
}

// 5. tools/call marketing_build_tracking
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'marketing_build_tracking', arguments: { base_url: 'https://example.com/game', source: 'threads', medium: 'social', campaign: 'launch' } } });
  const out = JSON.stringify(json?.result ?? json);
  check('marketing_build_tracking 200', status === 200, `status=${status}`);
  check('UTM url built', out.includes('https://example.com/game?utm_source=threads&utm_medium=social&utm_campaign=launch'), out.slice(0, 300));
  check('no network requests', out.includes('"network_requests":0'), out.slice(0, 300));
}

// 6. tools/call marketing_project_profile
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'marketing_project_profile', arguments: { project_id: 'dasi-playground', name: '다시, 놀이터', description: '잊힌 놀이터를 되살리는 이야기', category: 'adventure', features: ['탐험', '수집'], audiences: ['추억을 찾는 성인'], source_urls: ['https://example.com/game'] } } });
  const out = JSON.stringify(json?.result ?? json);
  check('marketing_project_profile 200', status === 200, `status=${status}`);
  check('profile returned', out.includes('marketing_project_profile') && out.includes('dasi-playground'), out.slice(0, 300));
}

// 7. tools/call marketing_create_brief
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'marketing_create_brief', arguments: { project: { project_id: 'dasi-playground', name: '다시, 놀이터' }, campaign_id: 'launch-01', objective: 'awareness', audience: '추억을 찾는 성인', channels: ['threads', 'x'] } } });
  const out = JSON.stringify(json?.result ?? json);
  check('marketing_create_brief 200', status === 200, `status=${status}`);
  check('brief returned', out.includes('marketing_create_brief') && out.includes('launch-01'), out.slice(0, 300));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
