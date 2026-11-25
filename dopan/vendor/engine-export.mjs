import {validateWorldManifest} from './engine-validation.mjs';

const decorTypes = new Set(['entity.house', 'entity.tree', 'entity.reed', 'entity.scarecrow']);

export function checkBase(world) {
  const result = validateWorldManifest(world);
  if (!result.valid) {
    const first = result.errors[0];
    throw Error(`기준 월드를 확인하세요 (${first.path}, ${first.code}).`);
  }
  const coordinates = world.world;
  if (!coordinates || (coordinates.units ?? 'meter') !== 'meter' ||
      (coordinates.upAxis ?? 'Y') !== 'Y' || (coordinates.handedness ?? 'right') !== 'right') {
    throw Error('미터 단위의 오른손 Y-up 월드가 필요합니다.');
  }
}

export function availableTemplates(world) {
  return world.entities.filter(entity => decorTypes.has(entity.type) && !entity.parentId);
}

// Templates supply the engine representation. Studio supplies the placement and display name.
export function exportPlacements(scene, base, templateId, assignments = new Map()) {
  checkBase(base);
  if (scene.schemaVersion !== '0.1.0' || !scene.entities?.length) {
    throw Error('Studio 씬에 내보낼 도형을 배치하세요.');
  }
  const templates = new Map(availableTemplates(base).map(entity => [entity.id, entity]));
  const ids = new Set(base.entities.map(entity => entity.id));
  const placements = scene.entities.map(node => {
    if (node.parentId || node.kind !== 'prop' || node.components?.['core.renderable'] ||
        Object.keys(node.components ?? {}).some(key => key !== 'world.structure')) {
      throw Error(`${node.name}은 기본 도형이 아닙니다. 최상위 기본 도형만 내보낼 수 있습니다.`);
    }
    const template = templates.get(assignments.get(node.id) || templateId);
    if (!template) throw Error('기준 월드에서 배치할 원형을 선택하세요.');
    const id = 'studio.' + node.id;
    if (ids.has(id)) throw Error(`ID 중복 (${id}). 처음 사용한 기준 월드를 선택하세요.`);
    ids.add(id);
    return {...template, id, name: node.name, enabled: node.enabled, transform: node.transform};
  });
  const world = {...base, entities: [...base.entities, ...placements]};
  checkBase(world);
  return world;
}

export function bindEngineExport(doc, readNodes) {
  const input = doc.getElementById('engine-base');
  const select = doc.getElementById('engine-template');
  const button = doc.getElementById('engine-export');
  const map = doc.getElementById('engine-map');
  const result = doc.getElementById('engine-result');
  const overrides = doc.getElementById('engine-overrides');
  const assignments = new Map();
  function refreshAssignments() {
    overrides.replaceChildren();
    if (!base) return;
    for (const node of readNodes()) {
      const label = doc.createElement('label');
      label.textContent = node.name;
      const field = doc.createElement('select');
      field.add(new Option('기본 원형 사용', ''));
      for (const opt of select.options) field.add(new Option(opt.text, opt.value));
      field.value = assignments.get(node.id) || '';
      field.onchange = () => assignments.set(node.id, field.value);
      label.append(field);
      overrides.append(label);
    }
  }
  doc.addEventListener('studio-scene-change', refreshAssignments);
  let base;
  let selection = 0;
  input.addEventListener('change', async () => {
    const version = ++selection;
    const file = input.files[0];
    base = undefined;
    assignments.clear();
    refreshAssignments();
    select.replaceChildren();
    select.disabled = map.disabled = button.disabled = true;
    result.textContent = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (version !== selection) return;
      checkBase(parsed);
      const templates = availableTemplates(parsed);
      if (!templates.length) throw Error('집·나무·갈대·허수아비가 있는 기준 월드가 필요합니다.');
      for (const entity of templates) {
        select.add(new Option(`${entity.name} (${entity.id})`, entity.id));
      }
      base = parsed;
      refreshAssignments();
      select.disabled = map.disabled = button.disabled = false;
    } catch (error) {
      if (version === selection) result.textContent = error.message;
    }
  });
  async function run(openMap) {
    const version = selection;
    const templateId = select.value;
    try {
      const response = await fetch('/api/export', {cache: 'no-store'});
      if (!response.ok) throw Error('Studio 씬을 읽을 수 없습니다.');
      const scene = await response.json();
      if (version !== selection) return;
      const world = exportPlacements(scene, base, templateId, assignments);
      if (openMap) {
        sessionStorage.setItem('aldol.map.transfer', JSON.stringify(world));
        location.assign('/map.html');
        return;
      }
      const url = URL.createObjectURL(new Blob([JSON.stringify(world, null, 2)], {type: 'application/json'}));
      const link = doc.createElement('a');
      link.href = url;
      link.download = 'world.studio.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      result.textContent = `${scene.entities.length}개 배치 · world.studio.json`;
    } catch (error) {
      if (version === selection) result.textContent = error.message;
    }
  }
  button.onclick = () => run(false);
  map.onclick = () => run(true);
}
