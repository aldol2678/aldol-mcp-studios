/* Aldol Engine validateWorldManifest, upstream df9a494647db3261658a5108a098e82cff927208.
MIT License

Copyright (c) 2026 CHOI JISEOK

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;
const TOP = ["schemaVersion", "project", "world", "assets", "zones", "places", "paths", "entities", "npcs", "quests", "events", "rules"];

function dupErrors(collection, values) {
  const seen = new Set();
  const errors = [];
  values.forEach((v, i) => {
    if (!v || typeof v.id !== "string" || !ID_RE.test(v.id)) {
      errors.push({ code: "E_ID", path: `${collection}[${i}].id`, detail: String(v?.id) });
      return;
    }
    if (seen.has(v.id)) errors.push({ code: "E_DUPLICATE_ID", path: `${collection}[${i}].id`, detail: v.id });
    seen.add(v.id);
  });
  return errors;
}

export function validateWorldManifest(input) {
  const errors = [];
  if (!input || typeof input !== "object") return { valid: false, errors: [{ code: "E_NOT_OBJECT", path: "$" }], warnings: [] };
  if (input.schemaVersion !== "worldforge/0.1") {
    errors.push({ code: "E_SCHEMA_VERSION", path: "schemaVersion", detail: String(input.schemaVersion) });
  }
  for (const key of TOP) {
    if (!(key in input)) errors.push({ code: "E_MISSING", path: key });
  }
  if (errors.length > 0) return { valid: false, errors, warnings: [] };
  const lists = ["assets", "zones", "places", "paths", "entities", "npcs", "quests", "events", "rules"];
  for (const name of lists) {
    if (!Array.isArray(input[name])) errors.push({ code: "E_NOT_ARRAY", path: name });
  }
  if (errors.length > 0) return { valid: false, errors, warnings: [] };
  for (const name of lists) errors.push(...dupErrors(name, input[name]));

  const assetIds = new Set(input.assets.map((a) => a.id));
  const URI_RE = /^(builtin|glb):[A-Za-z0-9._/-]+$/;
  input.assets.forEach((a, i) => {
    if (typeof a.uri !== "string" || !URI_RE.test(a.uri)) {
      errors.push({ code: "E_ASSET_URI", path: `assets[${i}].uri`, detail: String(a.uri) });
    } else if (a.uri.startsWith("glb:") && (!a.uri.endsWith(".glb") || a.uri.includes("..") || a.uri.slice(4).startsWith("/"))) {
      errors.push({ code: "E_ASSET_URI_UNSAFE", path: `assets[${i}].uri`, detail: a.uri });
    }
  });
  const zoneIds = new Set(input.zones.map((z) => z.id));
  const placeIds = new Set(input.places.map((p) => p.id));
  const entityIds = new Set(input.entities.map((e) => e.id));

  input.places.forEach((p, i) => {
    if (p.zoneId && !zoneIds.has(p.zoneId)) errors.push({ code: "E_ZONE_REF_NOT_FOUND", path: `places[${i}].zoneId`, detail: p.zoneId });
    if (!Array.isArray(p.position) || p.position.length !== 3) errors.push({ code: "E_PLACE_POSITION", path: `places[${i}].position` });
  });
  input.paths.forEach((p, i) => {
    if (p.from && !placeIds.has(p.from)) errors.push({ code: "E_PLACE_REF_NOT_FOUND", path: `paths[${i}].from`, detail: p.from });
    if (p.to && !placeIds.has(p.to)) errors.push({ code: "E_PLACE_REF_NOT_FOUND", path: `paths[${i}].to`, detail: p.to });
  });
  input.entities.forEach((e, i) => {
    if (e.parentId && !entityIds.has(e.parentId)) errors.push({ code: "E_ENTITY_PARENT_NOT_FOUND", path: `entities[${i}].parentId`, detail: e.parentId });
    if (e.assetId && !assetIds.has(e.assetId)) errors.push({ code: "E_ASSET_REF_NOT_FOUND", path: `entities[${i}].assetId`, detail: e.assetId });
    if (!e.transform || !Array.isArray(e.transform.position) || e.transform.position.length !== 3) {
      errors.push({ code: "E_ENTITY_TRANSFORM", path: `entities[${i}].transform` });
    }
  });
  input.npcs.forEach((n, i) => {
    if (n.entityId && !entityIds.has(n.entityId)) errors.push({ code: "E_NPC_ENTITY_REF_NOT_FOUND", path: `npcs[${i}].entityId`, detail: n.entityId });
    if (n.homePlaceId && !placeIds.has(n.homePlaceId)) errors.push({ code: "E_NPC_HOME_REF_NOT_FOUND", path: `npcs[${i}].homePlaceId`, detail: n.homePlaceId });
    if (!n.profile || typeof n.profile.role !== "string") errors.push({ code: "E_NPC_PROFILE", path: `npcs[${i}].profile` });
    if (!Array.isArray(n.schedule) || n.schedule.length === 0) errors.push({ code: "E_NPC_SCHEDULE", path: `npcs[${i}].schedule` });
  });
  input.quests.forEach((q, qi) => {
    errors.push(...dupErrors(`quests[${qi}].nodes`, q.nodes || []));
    const nodeIds = new Set((q.nodes || []).map((n) => n.id));
    (q.edges || []).forEach((e, ei) => {
      if (!nodeIds.has(e.from)) errors.push({ code: "E_QUEST_NODE_REF_NOT_FOUND", path: `quests[${qi}].edges[${ei}].from`, detail: e.from });
      if (!nodeIds.has(e.to)) errors.push({ code: "E_QUEST_NODE_REF_NOT_FOUND", path: `quests[${qi}].edges[${ei}].to`, detail: e.to });
    });
  });
  return { valid: errors.length === 0, errors, warnings: [] };
}

