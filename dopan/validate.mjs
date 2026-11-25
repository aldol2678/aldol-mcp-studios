#!/usr/bin/env node
/* Dopan MCP validation bridge.
 *
 * Runs the editor's own validation code (vendor/engine-export.mjs, which
 * imports vendor/engine-validation.mjs) over a world manifest read from
 * stdin. The Python MCP server calls this instead of reimplementing the
 * rules, so the editor and the MCP can never disagree about validity.
 *
 * Usage:
 *   node validate.mjs validate   < world.json   -> {valid, errors, warnings, check_base_ok, check_base_error}
 *   node validate.mjs templates  < world.json   -> {templates: [{id, name, type, position}]}
 */
import { checkBase, availableTemplates } from './vendor/engine-export.mjs';
import { validateWorldManifest } from './vendor/engine-validation.mjs';

const mode = process.argv[2];

let input = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) input += chunk;

let world;
try {
  world = JSON.parse(input);
} catch (error) {
  console.log(JSON.stringify({ valid: false, errors: [{ code: 'E_NOT_JSON', path: '$', detail: String(error.message) }], warnings: [], check_base_ok: false, check_base_error: null }));
  process.exit(0);
}

if (mode === 'validate') {
  const result = validateWorldManifest(world);
  let checkBaseOk = true;
  let checkBaseError = null;
  try {
    checkBase(world);
  } catch (error) {
    checkBaseOk = false;
    checkBaseError = String(error.message);
  }
  console.log(JSON.stringify({
    valid: result.valid && checkBaseOk,
    errors: result.errors,
    warnings: result.warnings ?? [],
    check_base_ok: checkBaseOk,
    check_base_error: checkBaseError,
  }));
} else if (mode === 'templates') {
  const templates = availableTemplates(world).map((entity) => ({
    id: entity.id,
    name: entity.name,
    type: entity.type,
    position: entity.transform?.position ?? null,
  }));
  console.log(JSON.stringify({ templates }));
} else {
  console.error(`unknown mode: ${mode}`);
  process.exit(2);
}
