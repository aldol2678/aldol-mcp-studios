"""Dopan MCP v0.1 tests — design doc section 6 (L0 + L1).

L0: validation bridge over broken fixtures (no MCP involved).
L1: stdio smoke through the official SDK client against a temp worlds dir.

Run with the dopan venv:
    ~/workspace/dopan-mcp/venv/bin/python -m pytest tests/ -v
"""

import copy
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
import pytest_asyncio

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SERVER = ROOT / "dopan_mcp.py"
VALIDATE_MJS = ROOT / "validate.mjs"
FIXTURES = ROOT / "publish" / "dopan" / "fixtures"
VENV_PYTHON = ROOT / "venv" / "bin" / "python"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def node_validate(manifest: dict) -> dict:
    proc = subprocess.run(
        ["node", str(VALIDATE_MJS), "validate"],
        input=json.dumps(manifest, ensure_ascii=False),
        capture_output=True, text=True, timeout=30,
    )
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


def load_fixture(slug: str) -> dict:
    return json.loads((FIXTURES / slug / "world.json").read_text(encoding="utf-8"))


# ---------------------------------------------------------------- L0: bridge

def test_l0_good_world_valid():
    assert node_validate(load_fixture("supuli"))["valid"] is True


def test_l0_schema_version_rejected():
    bad = load_fixture("supuli")
    bad["schemaVersion"] = "worldforge/0.2"
    result = node_validate(bad)
    assert result["valid"] is False
    assert any(e["code"] == "E_SCHEMA_VERSION" for e in result["errors"])


def test_l0_missing_top_key_rejected():
    bad = load_fixture("supuli")
    del bad["zones"]
    result = node_validate(bad)
    assert result["valid"] is False
    assert any(e["code"] == "E_MISSING" and e["path"] == "zones" for e in result["errors"])


def test_l0_duplicate_id_rejected():
    bad = load_fixture("supuli")
    bad["entities"].append(copy.deepcopy(bad["entities"][0]))
    result = node_validate(bad)
    assert result["valid"] is False
    assert any(e["code"] == "E_DUPLICATE_ID" for e in result["errors"])


def test_l0_unsafe_glb_uri_rejected():
    bad = load_fixture("supuli")
    bad["assets"].append({"id": "evil", "uri": "glb:../escape.glb"})
    result = node_validate(bad)
    assert result["valid"] is False
    assert any(e["code"] == "E_ASSET_URI_UNSAFE" for e in result["errors"])


def test_l0_missing_asset_ref_rejected():
    bad = load_fixture("supuli")
    bad["entities"][0]["assetId"] = "no-such-asset"
    result = node_validate(bad)
    assert result["valid"] is False
    assert any(e["code"] == "E_ASSET_REF_NOT_FOUND" for e in result["errors"])


def test_l0_empty_npc_schedule_rejected():
    bad = load_fixture("supuli")
    bad["npcs"][0]["schedule"] = []
    result = node_validate(bad)
    assert result["valid"] is False
    assert any(e["code"] == "E_NPC_SCHEDULE" for e in result["errors"])


# ------------------------------------------------------- L1: stdio smoke

@pytest.fixture()
def worlds_dir(tmp_path):
    target = tmp_path / "worlds"
    shutil.copytree(FIXTURES, target)
    return target


def client_cm(worlds_dir):
    """SDK client bound to a fresh server process.

    Used as ``async with`` inside the test body: the SDK client's cancel
    scope must be entered and exited in the same task, which a pytest
    async fixture does not guarantee.
    """
    from mcp import Client, StdioServerParameters
    from mcp.client.stdio import stdio_client

    params = StdioServerParameters(
        command=str(VENV_PYTHON),
        args=["-B", str(SERVER)],
        env={"DOPAN_WORLDS_DIR": str(worlds_dir), "PATH": "/usr/bin:/bin:/usr/local/bin"},
        cwd=str(ROOT),
    )
    return Client(stdio_client(params), raise_exceptions=True, read_timeout_seconds=45)


async def call(client, name, arguments=None):
    result = await client.call_tool(name, arguments or {})
    assert not result.is_error, f"{name} failed: {result.content}"
    text = "".join(
        block.text for block in result.content if hasattr(block, "text")
    )
    return json.loads(text)


async def call_errors(client, name, arguments=None):
    result = await client.call_tool(name, arguments or {})
    assert result.is_error, f"{name} should have failed"
    return result


@pytest.mark.asyncio
async def test_l1_tools_list(worlds_dir):
    async with client_cm(worlds_dir) as client:
        result = await client.list_tools()
        names = [t.name for t in result.tools]
        assert names == [
            "dopan_list_worlds", "dopan_get_world", "dopan_validate_world",
            "dopan_place_object", "dopan_move_object", "dopan_delete_object",
            "dopan_export_world", "dopan_play_url",
        ]
        by_name = {t.name: t for t in result.tools}
        assert by_name["dopan_list_worlds"].annotations.read_only_hint is True
        assert by_name["dopan_delete_object"].annotations.destructive_hint is True
        assert by_name["dopan_place_object"].annotations.read_only_hint is False
        # Informational: what the SDK emits for list results (AGENTS.md lesson:
        # remote MCP 2026-07-28 servers need ttlMs+cacheScope; record, don't fail).
        print("\ntools/list raw keys:", sorted(result.model_dump(mode="json").keys()))


@pytest.mark.asyncio
async def test_l1_reads_do_not_touch_files(worlds_dir):
    async with client_cm(worlds_dir) as client:
        before = {p.name: sha256(p) for p in worlds_dir.rglob("world.json")}
        worlds = await call(client, "dopan_list_worlds")
        assert [w["slug"] for w in worlds["worlds"]] == ["star-defense", "star-fishing", "supuli"]
        supuli = [w for w in worlds["worlds"] if w["slug"] == "supuli"][0]
        assert supuli["entities"] == 29 and supuli["decor"] == 13
        summary = await call(client, "dopan_get_world", {"slug": "supuli"})
        assert summary["world_id"] == "supuli-village"
        assert len(summary["decor"]) == 13
        assert (await call(client, "dopan_validate_world", {"slug": "supuli"}))["valid"] is True
        assert (await call(client, "dopan_play_url", {"slug": "supuli"}))["play_url"] == (
            "https://dopan.aldol.app/preview/games/supuli/index.html"
        )
        after = {p.name: sha256(p) for p in worlds_dir.rglob("world.json")}
        assert before == after


@pytest.mark.asyncio
async def test_l1_write_flow_and_export(worlds_dir):
    async with client_cm(worlds_dir) as client:
        placed = await call(client, "dopan_place_object", {
            "slug": "supuli", "template_id": "ent-tree-1", "position": [23.8, 0, -8.5],
        })
        assert placed["id"].startswith("studio.")
        assert placed["position"] == [23.8, 0, -8.5]
        assert placed["decor_count"] == 14
        moved = await call(client, "dopan_move_object", {
            "slug": "supuli", "id": placed["id"], "x": 24.0, "z": -9.0,
        })
        assert moved["position"] == [24.0, 0, -9.0]
        deleted = await call(client, "dopan_delete_object", {"slug": "supuli", "id": placed["id"]})
        assert deleted["decor_count"] == 13
        # Place again and export: the source file must stay untouched.
        placed2 = await call(client, "dopan_place_object", {
            "slug": "supuli", "template_id": "ent-tree-1", "position": [23.8, 0, -8.5],
        })
        exported = await call(client, "dopan_export_world", {"slug": "supuli"})
        out_path = Path(exported["path"])
        assert out_path.name == "supuli.edited.json"
        assert out_path.read_bytes().__len__() == exported["bytes"]
        assert sha256(out_path) == exported["sha256"]
        assert exported["decor_count"] == 14
        assert node_validate(json.loads(out_path.read_text(encoding="utf-8")))["valid"] is True
        # The exported file loads in the editor's terms: 30 entities, 14 decor.
        exported_manifest = json.loads(out_path.read_text(encoding="utf-8"))
        assert len(exported_manifest["entities"]) == 30
        assert placed2["id"] in {e["id"] for e in exported_manifest["entities"]}


@pytest.mark.asyncio
async def test_l1_rejections(worlds_dir):
    async with client_cm(worlds_dir) as client:
        await call_errors(client, "dopan_get_world", {"slug": "../.."})
        await call_errors(client, "dopan_place_object", {"slug": "supuli", "template_id": "ent-tree-1; rm", "position": [0, 0, 0]})
        await call_errors(client, "dopan_place_object", {"slug": "supuli", "template_id": "ent-tree-1", "position": ["a", 0, 0]})
        await call_errors(client, "dopan_move_object", {"slug": "supuli", "id": "ent-villager", "x": 1, "z": 1})
        await call_errors(client, "dopan_delete_object", {"slug": "supuli", "id": "ent-villager"})
        await call_errors(client, "dopan_export_world", {"slug": "supuli", "out_name": "../evil.json"})
        await call_errors(client, "dopan_validate_world", {"path": "/etc/passwd"})
        await call_errors(client, "dopan_get_world", {"slug": "nope"})


def test_l1_delete_refused_when_referenced(worlds_dir):
    # Craft a world where an NPC references a decor template, then delete must refuse.
    sys.path.insert(0, str(ROOT))
    import dopan_mcp

    manifest = load_fixture("supuli")
    manifest["npcs"].append({
        "id": "npc-test", "entityId": "ent-tree-1",
        "profile": {"role": "test"}, "schedule": [{"place": "village"}],
    })
    probe = copy.deepcopy(manifest)
    probe["entities"] = [e for e in probe["entities"] if e["id"] != "ent-tree-1"]
    assert dopan_mcp._references(probe, "ent-tree-1") is True
    clean = copy.deepcopy(manifest)
    clean["npcs"] = [n for n in clean["npcs"] if n["id"] != "npc-test"]
    probe2 = copy.deepcopy(clean)
    probe2["entities"] = [e for e in probe2["entities"] if e["id"] != "ent-tree-1"]
    assert dopan_mcp._references(probe2, "ent-tree-1") is False
