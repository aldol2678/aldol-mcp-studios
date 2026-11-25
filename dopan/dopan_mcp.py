#!/usr/bin/env python3
"""Dopan MCP v0.1 — local stdio MCP server for the Dopan 2D map editor.

Official Python MCP SDK v2, stdio transport (same pattern as ALDOL MCP
Forge). It edits world manifests (WorldForge ``worldforge/0.1``) held in a
local worlds directory — never the live site, never the canonical files.

Run:
    python dopan_mcp.py [--worlds-dir PATH]

The worlds directory holds one subdirectory per game slug, each with a
``world.json`` (copy ``fixtures/`` there to start). Writes only touch the
in-memory working copy; ``dopan_export_world`` writes ``<slug>.edited.json``
after the editor's own validation passes.

Validation is never reimplemented here: every check runs through
``validate.mjs``, which imports the editor's own ``checkBase`` /
``validateWorldManifest`` / ``availableTemplates`` from
``vendor/engine-export.mjs`` + ``vendor/engine-validation.mjs``.
"""

import argparse
import copy
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Annotated, Any, Literal

from pydantic import Field
from mcp.server import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.types import ToolAnnotations

HERE = Path(__file__).resolve().parent
VALIDATE_MJS = HERE / "validate.mjs"
DEFAULT_WORLDS_DIR = HERE / "worlds"

SLUG_RE = re.compile(r"^[a-z][a-z0-9-]{0,31}$")
OUT_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*\.json$")
NODE_TIMEOUT_SECONDS = 15

READ_ONLY = ToolAnnotations(read_only_hint=True, destructive_hint=False, idempotent_hint=True, open_world_hint=False)
WRITE = ToolAnnotations(read_only_hint=False, destructive_hint=False, idempotent_hint=False, open_world_hint=False)
WRITE_IDEMPOTENT = ToolAnnotations(read_only_hint=False, destructive_hint=False, idempotent_hint=True, open_world_hint=False)
DELETE = ToolAnnotations(read_only_hint=False, destructive_hint=True, idempotent_hint=False, open_world_hint=False)

# The official SDK 2.0.0 decorator silently drops unknown keys from tool
# arguments. Preserve Forge's strict behavior at the pre-validation boundary:
# this middleware only REFUSES unknown arguments.
_ALLOWED_TOOL_KEYS: dict[str, frozenset[str]] = {
    "dopan_list_worlds": frozenset(),
    "dopan_get_world": frozenset({"slug", "view"}),
    "dopan_validate_world": frozenset({"slug", "path"}),
    "dopan_place_object": frozenset({"slug", "template_id", "position"}),
    "dopan_move_object": frozenset({"slug", "id", "x", "z"}),
    "dopan_delete_object": frozenset({"slug", "id"}),
    "dopan_export_world": frozenset({"slug", "out_name"}),
    "dopan_play_url": frozenset({"slug"}),
}


async def reject_unknown_tool_arguments(ctx, call_next):
    if ctx.method != "tools/call":
        return await call_next(ctx)
    params = ctx.params
    if isinstance(params, dict):
        name, arguments = params.get("name"), params.get("arguments", {})
        if name in _ALLOWED_TOOL_KEYS and isinstance(arguments, dict):
            unknown = arguments.keys() - _ALLOWED_TOOL_KEYS[name]
            if unknown:
                raise ToolError(f"unknown arguments for {name}: {sorted(unknown)}")
    return await call_next(ctx)


app = MCPServer("dopan-mcp", middleware=[reject_unknown_tool_arguments])

_WORLDS_DIR: Path | None = None
# slug -> {"manifest": dict, "source_sha256": str, "path": Path}
_STORE: dict[str, dict[str, Any]] = {}


def _node() -> str:
    node = shutil.which("node")
    if not node:
        raise ToolError("node is required but was not found on PATH")
    return node


def _run_node(mode: str, manifest: dict) -> dict:
    """Run validate.mjs in ``mode`` over ``manifest``; return its JSON."""
    try:
        proc = subprocess.run(
            [_node(), str(VALIDATE_MJS), mode],
            input=json.dumps(manifest, ensure_ascii=False),
            capture_output=True,
            text=True,
            timeout=NODE_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        raise ToolError(f"validation timed out after {NODE_TIMEOUT_SECONDS}s") from exc
    if proc.returncode != 0:
        raise ToolError(f"validation bridge failed: {proc.stderr.strip()[:300]}")
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise ToolError(f"validation bridge returned bad JSON: {proc.stdout[:200]}") from exc


def _validate(manifest: dict) -> dict:
    return _run_node("validate", manifest)


def _templates(manifest: dict) -> list[dict]:
    return _run_node("templates", manifest)["templates"]


def _load_worlds(worlds_dir: Path) -> dict[str, dict[str, Any]]:
    if not worlds_dir.is_dir():
        raise SystemExit(
            f"worlds directory not found: {worlds_dir}\n"
            "Copy fixtures/ there first, e.g.:\n"
            f"  cp -r {HERE / 'fixtures'} {worlds_dir}"
        )
    store: dict[str, dict[str, Any]] = {}
    for sub in sorted(worlds_dir.iterdir()):
        if not sub.is_dir():
            continue
        world_file = sub / "world.json"
        if not world_file.is_file():
            continue
        slug = sub.name
        if not SLUG_RE.match(slug):
            raise SystemExit(f"invalid world directory name (must be a game slug): {slug}")
        raw = world_file.read_bytes()
        try:
            manifest = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise SystemExit(f"{world_file} is not valid JSON: {exc}") from exc
        store[slug] = {
            "manifest": manifest,
            "source_sha256": hashlib.sha256(raw).hexdigest(),
            "path": world_file,
        }
    if not store:
        raise SystemExit(f"no world.json found under {worlds_dir}")
    return store


def _get(slug: str) -> dict[str, Any]:
    if not SLUG_RE.match(slug or ""):
        raise ToolError(f"invalid game slug: {slug!r}")
    entry = _STORE.get(slug)
    if entry is None:
        raise ToolError(f"unknown world slug: {slug!r} (loaded: {sorted(_STORE)})")
    return entry


def _entity(manifest: dict, entity_id: str) -> dict | None:
    for entity in manifest.get("entities", []):
        if entity.get("id") == entity_id:
            return entity
    return None


def _decor_ids(manifest: dict) -> set[str]:
    return {t["id"] for t in _templates(manifest)}


def _references(value: Any, target_id: str) -> bool:
    """Mirror the editor's references(): any string anywhere equal to the id.

    The editor checks ``{...world, entities: filtered}`` — the entity being
    deleted is excluded via the filtered list, so its own id does not count.
    """
    if isinstance(value, str):
        return value == target_id
    if isinstance(value, dict):
        return any(_references(child, target_id) for child in value.values())
    if isinstance(value, list):
        return any(_references(child, target_id) for child in value)
    return False


def _apply(slug: str, new_entities: list[dict]) -> dict:
    """Mirror the editor's apply(): validate the candidate, then commit.

    The working copy is untouched when validation fails.
    """
    entry = _get(slug)
    candidate = copy.deepcopy(entry["manifest"])
    candidate["entities"] = new_entities
    result = _validate(candidate)
    if not result.get("valid"):
        raise ToolError(f"validation failed, change not applied: {result.get('errors')}")
    entry["manifest"] = candidate
    return candidate


def _decor_count(manifest: dict) -> int:
    return len(_templates(manifest))


@app.tool(annotations=READ_ONLY)
def dopan_list_worlds() -> dict[str, Any]:
    """List the loaded worlds with their slugs, ids, counts and source hashes."""
    worlds = []
    for slug in sorted(_STORE):
        entry = _STORE[slug]
        manifest = entry["manifest"]
        worlds.append({
            "slug": slug,
            "world_id": manifest.get("world", {}).get("id"),
            "name": manifest.get("world", {}).get("name"),
            "entities": len(manifest.get("entities", [])),
            "zones": len(manifest.get("zones", [])),
            "paths": len(manifest.get("paths", [])),
            "decor": _decor_count(manifest),
            "source_sha256": entry["source_sha256"],
            "path": str(entry["path"]),
        })
    return {"worlds": worlds}


@app.tool(annotations=READ_ONLY)
def dopan_get_world(
    slug: Annotated[str, Field(description="Game slug, e.g. supuli")],
    view: Annotated[Literal["summary", "decor", "full"], Field(description="Detail level")] = "summary",
) -> dict[str, Any]:
    """Get a world: summary (default), decor entities only, or the full manifest."""
    entry = _get(slug)
    manifest = entry["manifest"]
    if view == "full":
        return {"slug": slug, "manifest": manifest}
    templates = _templates(manifest)
    if view == "decor":
        decor_ids = {t["id"] for t in templates}
        return {
            "slug": slug,
            "decor": [e for e in manifest.get("entities", []) if e.get("id") in decor_ids],
        }
    return {
        "slug": slug,
        "world_id": manifest.get("world", {}).get("id"),
        "name": manifest.get("world", {}).get("name"),
        "world": manifest.get("world", {}),
        "zones": [{"id": z.get("id"), "name": z.get("name"), "type": z.get("type")} for z in manifest.get("zones", [])],
        "paths_count": len(manifest.get("paths", [])),
        "decor": templates,
    }


@app.tool(annotations=READ_ONLY)
def dopan_validate_world(
    slug: Annotated[str | None, Field(description="Game slug to validate")] = None,
    path: Annotated[str | None, Field(description="Path to a world JSON file inside the worlds dir")] = None,
) -> dict[str, Any]:
    """Validate a working copy (slug) or a file (path) with the editor's own rules."""
    if (slug is None) == (path is None):
        raise ToolError("pass exactly one of slug or path")
    if slug is not None:
        manifest = _get(slug)["manifest"]
        return {"slug": slug, **_validate(manifest)}
    resolved = (Path(path).expanduser().resolve() if Path(path).is_absolute() else (_WORLDS_DIR / path).resolve())
    if not resolved.is_relative_to(_WORLDS_DIR.resolve()):
        raise ToolError("path must stay inside the worlds directory")
    if not resolved.is_file():
        raise ToolError(f"file not found: {path}")
    try:
        manifest = json.loads(resolved.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ToolError(f"not valid JSON: {exc}") from exc
    return {"path": str(resolved), **_validate(manifest)}


@app.tool(annotations=WRITE)
def dopan_place_object(
    slug: Annotated[str, Field(description="Game slug, e.g. supuli")],
    template_id: Annotated[str, Field(description="Template entity id, e.g. ent-tree-1")],
    position: Annotated[list[float], Field(description="[x, y, z] in meters; x/z are rounded to 1 decimal like the editor")],
) -> dict[str, Any]:
    """Place a decor object (house/tree/reed/scarecrow) cloned from a template.

    The change stays in the working copy only; use dopan_export_world to write a file.
    """
    entry = _get(slug)
    manifest = entry["manifest"]
    if len(position) != 3 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in position):
        raise ToolError("position must be [x, y, z] of finite numbers")
    template = _entity(manifest, template_id)
    if template is None or template_id not in _decor_ids(manifest):
        raise ToolError(f"unknown decor template: {template_id!r}")
    entity = copy.deepcopy(template)
    entity["id"] = "studio." + str(uuid.uuid4())
    entity["enabled"] = True
    entity["transform"]["position"] = [round(position[0], 1), template["transform"]["position"][1], round(position[2], 1)]
    candidate = _apply(slug, [*manifest.get("entities", []), entity])
    return {
        "id": entity["id"],
        "name": entity.get("name"),
        "type": entity.get("type"),
        "position": entity["transform"]["position"],
        "decor_count": _decor_count(candidate),
    }


@app.tool(annotations=WRITE_IDEMPOTENT)
def dopan_move_object(
    slug: Annotated[str, Field(description="Game slug, e.g. supuli")],
    id: Annotated[str, Field(description="Decor entity id to move")],
    x: Annotated[float, Field(description="New X in meters")],
    z: Annotated[float, Field(description="New Z in meters")],
) -> dict[str, Any]:
    """Move a decor object to a new X/Z, keeping its Y like the editor's move button."""
    entry = _get(slug)
    manifest = entry["manifest"]
    if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in (x, z)):
        raise ToolError("x and z must be finite numbers")
    entity = _entity(manifest, id)
    if entity is None or id not in _decor_ids(manifest):
        raise ToolError(f"unknown decor object: {id!r}")
    previous = list(entity["transform"]["position"])
    new_entities = []
    for e in manifest.get("entities", []):
        if e.get("id") == id:
            moved = copy.deepcopy(e)
            moved["transform"]["position"] = [x, previous[1], z]
            new_entities.append(moved)
        else:
            new_entities.append(e)
    _apply(slug, new_entities)
    return {"id": id, "previous_position": previous, "position": [x, previous[1], z]}


@app.tool(annotations=DELETE)
def dopan_delete_object(
    slug: Annotated[str, Field(description="Game slug, e.g. supuli")],
    id: Annotated[str, Field(description="Decor entity id to delete")],
) -> dict[str, Any]:
    """Delete a decor object. Refuses when another world entry references it, like the editor."""
    entry = _get(slug)
    manifest = entry["manifest"]
    entity = _entity(manifest, id)
    if entity is None or id not in _decor_ids(manifest):
        raise ToolError(f"unknown decor object: {id!r}")
    remaining = [e for e in manifest.get("entities", []) if e.get("id") != id]
    probe = copy.deepcopy(manifest)
    probe["entities"] = remaining
    if _references(probe, id):
        raise ToolError(f"다른 월드 항목이 이 오브젝트를 참조하고 있어 삭제할 수 없습니다: {id}")
    candidate = _apply(slug, remaining)
    return {"id": id, "decor_count": _decor_count(candidate)}


@app.tool(annotations=WRITE_IDEMPOTENT)
def dopan_export_world(
    slug: Annotated[str, Field(description="Game slug, e.g. supuli")],
    out_name: Annotated[str | None, Field(description="Output file name in the worlds dir, default <slug>.edited.json")] = None,
) -> dict[str, Any]:
    """Validate the working copy and write it as <slug>.edited.json (never overwrites the source)."""
    entry = _get(slug)
    manifest = entry["manifest"]
    result = _validate(manifest)
    if not result.get("valid"):
        raise ToolError(f"validation failed, nothing written: {result.get('errors')}")
    name = out_name or f"{slug}.edited.json"
    if not OUT_NAME_RE.match(name):
        raise ToolError(f"invalid output name: {name!r}")
    out_path = (_WORLDS_DIR / name).resolve()
    if not out_path.is_relative_to(_WORLDS_DIR.resolve()):
        raise ToolError("output must stay inside the worlds directory")
    text = json.dumps(manifest, indent=2, ensure_ascii=False)
    out_path.write_text(text, encoding="utf-8")
    raw = out_path.read_bytes()
    return {
        "path": str(out_path),
        "bytes": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "decor_count": _decor_count(manifest),
    }


@app.tool(annotations=READ_ONLY)
def dopan_play_url(
    slug: Annotated[str, Field(description="Game slug, e.g. supuli")],
) -> dict[str, Any]:
    """Return the map editor and game play URLs for a world.

    An edited world cannot be played from a URL yet: the editor plays an
    in-memory snapshot. Open an exported *.edited.json with the editor's
    '월드 파일 열기' to play it.
    """
    _get(slug)
    return {
        "slug": slug,
        "map_url": "https://dopan.aldol.app/map",
        "play_url": f"https://dopan.aldol.app/preview/games/{slug}/index.html",
        "note": "편집한 월드는 URL로 플레이할 수 없습니다. 내보낸 *.edited.json을 에디터의 '월드 파일 열기'로 열어 플레이하세요.",
    }


def main() -> None:
    global _WORLDS_DIR, _STORE
    parser = argparse.ArgumentParser(description="Dopan MCP v0.1 (local stdio)")
    parser.add_argument("--worlds-dir", default=None, help="Directory holding <slug>/world.json (default: ./worlds or $DOPAN_WORLDS_DIR)")
    args = parser.parse_args()
    import os

    worlds_dir = Path(args.worlds_dir or os.environ.get("DOPAN_WORLDS_DIR") or DEFAULT_WORLDS_DIR)
    _WORLDS_DIR = worlds_dir.resolve()
    if not VALIDATE_MJS.is_file():
        raise SystemExit(f"validation bridge missing: {VALIDATE_MJS}")
    _node()  # fail fast when node is absent
    _STORE = _load_worlds(_WORLDS_DIR)
    app.run()


if __name__ == "__main__":
    main()
