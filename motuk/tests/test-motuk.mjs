// Motuk v0.3.0 integration test — runs the Worker entrypoint in-process.
// Usage: node tests/test-motuk.mjs   (run from motuk/)
import worker from '../motuk.mjs';

const BASE = 'https://motuk.test';
let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name} ${detail}`); }
}
async function mcp(body) {
  const res = await worker.fetch(new Request(BASE + '/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  }));
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

const EXPECTED_TOOLS = [
  'capabilities', 'inventory_preview', 'audit_preview',
  'sound_presets', 'sound_generate', 'sound_variations', 'sound_export_pack',
  'sound_bgm_presets', 'sound_bgm_generate',
  'title_create', 'title_preview', 'title_update', 'title_export',
];

// 1. root page
{
  const res = await worker.fetch(new Request(BASE + '/', { method: 'GET' }));
  check('GET / returns 200', res.status === 200, `status=${res.status}`);
}

// 2. initialize → v0.3.0
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
  check('initialize 200', status === 200, `status=${status}`);
  check('server is ALDOL Asset Factory Studio 0.3.0',
    json?.result?.serverInfo?.name === 'ALDOL Asset Factory Studio' && json?.result?.serverInfo?.version === '0.3.0',
    JSON.stringify(json?.result?.serverInfo));
}

// 3. tools/list → exactly the 13 expected tools
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const names = (json?.result?.tools ?? []).map((t) => t.name).sort();
  check('tools/list 200', status === 200, `status=${status}`);
  check('tools/list has 13 tools', names.length === 13, `got ${names.length}: ${names.join(',')}`);
  check('tool names match v0.3.0', JSON.stringify(names) === JSON.stringify([...EXPECTED_TOOLS].sort()), names.join(','));
}

// 4. tools/call capabilities
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'capabilities', arguments: {} } });
  const out = JSON.stringify(json?.result ?? json);
  let cap = null;
  try { cap = JSON.parse(json?.result?.content?.[0]?.text ?? 'null'); } catch { /* ignore */ }
  check('capabilities 200', status === 200, `status=${status}`);
  check('adapter_version is 0.3.0', cap?.adapter_version === '0.3.0', out.slice(0, 200));
}

// 5. tools/call sound_presets → six presets
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'sound_presets', arguments: {} } });
  const out = JSON.stringify(json?.result ?? json);
  check('sound_presets 200', status === 200, `status=${status}`);
  check('six presets listed', ['fire', 'water', 'light', 'break', 'button', 'clear'].every((p) => out.includes(p)), out.slice(0, 300));
}

// 6. tools/call sound_generate → deterministic WAV
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'sound_generate', arguments: { recipe: { preset: 'button', duration: 0.5, seed: 7 } } } });
  const out = JSON.stringify(json?.result ?? json);
  check('sound_generate 200', status === 200, `status=${status}`);
  check('WAV result returned', out.includes('wav') || out.includes('audio'), out.slice(0, 300));
}

// 7. tools/call title_create
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'title_create', arguments: { title: '다시, 놀이터' } } });
  const out = JSON.stringify(json?.result ?? json);
  check('title_create 200', status === 200, `status=${status}`);
  check('title project returned', out.includes('다시, 놀이터'), out.slice(0, 300));
}

// 8. tools/call inventory_preview → metadata validation only
{
  const { status, json } = await mcp({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'inventory_preview', arguments: { project_id: 'test-proj', assets: [{ id: 'a1', file: 'assets/sfx.wav', byte_size: 1234 }] } } });
  const out = JSON.stringify(json?.result ?? json);
  check('inventory_preview 200', status === 200, `status=${status}`);
  check('metadata structure PASS', out.includes('PASS'), out.slice(0, 300));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
