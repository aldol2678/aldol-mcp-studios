// MOTUK MCP — standalone Cloudflare Worker entry for the MCP handler.
//
// The handler itself lives in ./lib/asset-mcp.js (recovered from the local
// MOTUK Title Studio MCP P0 integration source, verified byte-for-byte
// behaviour-identical to the live worker: same initialize response,
// same 13-tool list with identical descriptions/schemas, same capabilities
// JSON). In the Next.js app this handler is wired as app/mcp/route.ts:
//
//   import { handleMcp } from '../../lib/asset-mcp.js';
//   export const POST = handleMcp;
//   export const GET = handleMcp;
//
// This thin entry exposes the same handler as a plain Worker so the MCP
// server can run and be tested without the Next.js app shell. It serves
// no web UI and no sound files — only the /mcp endpoint.
import { handleMcp } from './lib/asset-mcp.js';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/mcp') return handleMcp(request);
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(
        'MOTUK MCP 0.3.0 — ALDOL Asset Factory Studio\nMCP endpoint: POST /mcp\n',
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
      );
    }
    return new Response('Not found', { status: 404 });
  },
};
