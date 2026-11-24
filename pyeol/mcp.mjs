import { callStudioTool, listStudioTools } from './studio-tools.mjs';

const SUPPORTED = ['2025-11-25', '2025-06-18', '2025-03-26'];
const MAX_REQUEST_BYTES = 65536;
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

function error(id, code, message, status = 200) {
  return Response.json({ jsonrpc: '2.0', id, error: { code, message } }, { status, headers });
}

function success(id, result) {
  return Response.json({ jsonrpc: '2.0', id, result }, { headers });
}

async function readMessage(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_REQUEST_BYTES) throw new RangeError('Request too large');
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError('Missing request body');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let length = 0;
  let text = '';
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > MAX_REQUEST_BYTES) throw new RangeError('Request too large');
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (cause) {
    reader.cancel().catch(() => {});
    throw cause;
  } finally {
    reader.releaseLock();
  }
}

export async function serveMcp(request, key, domain) {
  const origin = request.headers.get('Origin');
  if (origin !== null && origin !== 'https://' + domain) {
    return error(null, -32600, 'Origin is not allowed', 403);
  }
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { ...headers, Allow: 'POST' } });
  }
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return error(null, -32600, 'Content-Type must be application/json', 415);
  }
  const version = request.headers.get('MCP-Protocol-Version');
  if (version && !SUPPORTED.includes(version)) {
    return error(null, -32600, 'Unsupported MCP protocol version', 400);
  }

  let body;
  try {
    body = await readMessage(request);
  } catch (cause) {
    if (cause instanceof RangeError) return error(null, -32600, 'Request body exceeds 64 KiB', 413);
    return error(null, -32700, 'Invalid JSON', 400);
  }

  if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string' || Array.isArray(body)) {
    return error(null, -32600, 'Invalid JSON-RPC request', 400);
  }
  if (!Object.hasOwn(body, 'id')) return new Response(null, { status: 202, headers });
  const { id, method, params } = body;
  if (!(typeof id === 'string' || Number.isSafeInteger(id))) return error(null, -32600, 'Invalid request ID', 400);

  switch (method) {
    case 'initialize': {
      const requested = params?.protocolVersion;
      return success(id, {
        protocolVersion: SUPPORTED.includes(requested) ? requested : SUPPORTED[0],
        capabilities: { tools: {} },
        serverInfo: { name: key + '-studio', version: '1.1.0' },
      });
    }
    case 'ping':
      return success(id, {});
    case 'tools/list':
      return success(id, { tools: listStudioTools(key) });
    case 'tools/call':
      try {
        const value = callStudioTool(key, params?.name, params?.arguments ?? {});
        return success(id, {
          content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
          structuredContent: value,
          isError: false,
        });
      } catch (cause) {
        return success(id, { content: [{ type: 'text', text: cause.message }], isError: true });
      }
    default:
      return error(id, -32601, 'Method not found');
  }
}
