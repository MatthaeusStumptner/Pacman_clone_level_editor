import './style.css';
import { FixedStepLoop, PassauPixelRenderer, parseLevelDocument, selectAppearanceFrame, tileKey, validateLevelDocument } from '@franz-lola/pixel-renderer';
import { catalogDocument, catalogLevel, passauCatalog, searchCatalog } from './catalog.js';
import { DraftRepository } from './draft-repository.js';
import { createStarterLevel, EditorState } from './editor-state.js';
import { floodFillPoints, linePoints, previewGuttis, rectanglePoints, worldPointFromScreen } from './editor-tools.js';
import { PlaytestEngine } from './playtest-engine.js';

const canvas = document.querySelector('#level-canvas');
const renderer = new PassauPixelRenderer(canvas, { zoom: 1 });
const drafts = new DraftRepository();
let state = new EditorState(drafts.active() ?? createStarterLevel());
let tool = 'select';
let cursor = null;
let renderResult = null;
let gesture = null;
let saveTimer = null;
let toastTimer = null;
let nextCatAppearance = null;
let spriteDraft = null;
let spritePaletteIndex = 1;
let playtest = null;
let playtestRenderer = null;
let playtestFrame = null;
let playtestLoop = null;
let playtestPaused = false;
let playtestCameraEnabled = true;
let playtestGesture = null;
let renderedRevision = -1;
let renderedLevel = null;
let spritePainting = false;
let spriteAnimationId = 'base';
let spriteFrameIndex = 0;
let spritePreviewFrame = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const clone = (value) => JSON.parse(JSON.stringify(value));
const fields = {
  id: $('#level-id'), icon: $('#level-icon'), name: $('#level-name'), dialect: $('#level-name-dialect'), mission: $('#level-mission'), description: $('#level-description'),
  area: $('#level-area'), latitude: $('#level-latitude'), longitude: $('#level-longitude'), columns: $('#level-columns'), rows: $('#level-rows'), tunnels: $('#level-tunnels'),
  theme: $('#level-theme'), ground: $('#ground-color'), wall: $('#wall-color'), curb: $('#curb-color'), water: $('#water-color'),
  cat: $('#cat-color'), accent: $('#cat-accent'), decorationType: $('#decoration-type'), decorationColor: $('#decoration-color'), decorationLabel: $('#decoration-label'), decorationWidth: $('#decoration-width'), decorationHeight: $('#decoration-height'),
  decorationAnimation: $('#decoration-animation'), decorationAnimationSpeed: $('#decoration-animation-speed'), decorationAnimationAmplitude: $('#decoration-animation-amplitude'),
};

const profileFields = {
  playerSpeed: $('#profile-player-speed'), catSpeed: $('#profile-cat-speed'), frightenedSpeed: $('#profile-frightened-speed'), catCount: $('#profile-cat-count'), lives: $('#profile-lives'), powerDuration: $('#profile-power-duration'), wander: $('#profile-wander'), grace: $('#profile-grace'),
};

const toolHelp = {
  select: 'Auswahl: Figur oder Dekoration anklicken', wall: 'Stift: ziehen malt Wände · Rechtsklick radiert', line: 'Linie: Start und Ende aufziehen', rectangle: 'Rechteck: gefüllten Bereich aufziehen',
  fill: 'Füllen: zusammenhängende freie oder Wandfläche anklicken', erase: 'Radierer: ziehen entfernt Wände', player: 'Franz & Lola: Startfeld anklicken', cat: 'Katze: Feld anklicken', power: 'Power: Feld anklicken zum Setzen oder Entfernen', decoration: 'Deko: Stempel im Design-Tab einstellen',
};

function shade(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const adjust = (shift) => Math.max(0, Math.min(255, (value >> shift & 255) + amount));
  return `#${[16, 8, 0].map((shift) => adjust(shift).toString(16).padStart(2, '0')).join('')}`;
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message; toast.classList.add('visible'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2400);
}

function scheduleSave() {
  $('#save-indicator').textContent = '● SPEICHERT …';
  $('#save-indicator').classList.add('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      drafts.save(state.toDocument());
      $('#save-indicator').textContent = '● GESPEICHERT'; $('#save-indicator').classList.remove('saving'); $('#draft-status').textContent = 'Entwurf lokal gespeichert';
      renderDraftList(); renderCatalog();
    } catch {
      $('#save-indicator').textContent = '● SPEICHERN BLOCKIERT'; $('#save-indicator').classList.add('error'); $('#draft-status').textContent = 'Browser-Speicher blockiert';
    }
  }, 220);
}

function syncFields() {
  const level = state.toDocument();
  fields.id.value = level.id; fields.icon.value = level.icon; fields.name.value = level.name.standard; fields.dialect.value = level.name.dialect;
  fields.mission.value = level.mission.standard; fields.description.value = level.description.standard; fields.area.value = level.location.area;
  fields.latitude.value = level.location.latitude; fields.longitude.value = level.location.longitude; fields.columns.value = level.board.columns; fields.rows.value = level.board.rows;
  fields.tunnels.value = level.board.tunnelRows.join(', '); fields.theme.value = level.theme.landmark;
  fields.ground.value = level.theme.palette.ground[0]; fields.wall.value = level.theme.palette.walls[0]; fields.curb.value = level.theme.palette.curb; fields.water.value = level.theme.palette.water;
  canvas.style.aspectRatio = `${level.board.columns} / ${level.board.rows}`;
  syncProfileFields(level);
}

function syncProfileFields(level = state.toDocument()) {
  const difficulty = $('#preview-difficulty').value;
  const labels = { easy: 'Spaziergang', normal: 'Gassirunde', hard: 'Abenteuer' };
  $('#difficulty-profile-name').textContent = labels[difficulty];
  const profile = level.gameplay.difficulties[difficulty];
  Object.entries(profileFields).forEach(([key, field]) => { field.value = profile[key]; });
}

function applyProfileFields() {
  const difficulty = $('#preview-difficulty').value;
  state.mutate(`Spielgefühl ${difficulty} ändern`, (draft) => {
    const profile = draft.document.gameplay.difficulties[difficulty];
    Object.entries(profileFields).forEach(([key, field]) => { profile[key] = Number(field.value); });
  });
  render(); scheduleSave();
}

function applyFields() {
  const current = state.toDocument();
  const columns = Math.max(9, Math.min(45, Number(fields.columns.value) || 25));
  const rows = Math.max(9, Math.min(45, Number(fields.rows.value) || 25));
  const tunnelRows = fields.tunnels.value.split(',').map((value) => Math.round(Number(value))).filter((value) => Number.isFinite(value) && value >= 0 && value < rows);
  state.mutate('Eigenschaften ändern', (draft) => {
    draft.document.id = fields.id.value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'mein-level';
    draft.document.icon = fields.icon.value || '◆'; draft.document.name = { standard: fields.name.value, dialect: fields.dialect.value };
    draft.document.mission = { ...draft.document.mission, standard: fields.mission.value }; draft.document.description = { ...draft.document.description, standard: fields.description.value };
    draft.document.location = { latitude: Number(fields.latitude.value), longitude: Number(fields.longitude.value), area: fields.area.value };
    draft.document.board = { ...draft.document.board, columns, rows, tunnelRows: tunnelRows.length ? tunnelRows : [Math.floor(rows / 2)] };
    draft.wallCells = new Set([...draft.wallCells].filter((key) => { const [x, y] = key.split(',').map(Number); return x < columns && y < rows; })); draft.wallsDirty = true;
    draft.document.actors.player.x = Math.max(1, Math.min(columns - 2, draft.document.actors.player.x)); draft.document.actors.player.y = Math.max(1, Math.min(rows - 2, draft.document.actors.player.y));
    draft.document.actors.cats = draft.document.actors.cats.filter((actor) => actor.x < columns && actor.y < rows);
    draft.document.collectibles.powerUps = draft.document.collectibles.powerUps.filter((point) => point.x < columns && point.y < rows);
    draft.document.decorations = draft.document.decorations.filter((item) => item.x < columns && item.y < rows);
    draft.document.theme = { id: fields.theme.value, landmark: fields.theme.value, palette: { ground: [fields.ground.value, shade(fields.ground.value, 7), shade(fields.ground.value, -7), shade(fields.ground.value, 13)], curb: fields.curb.value, walls: [fields.wall.value, shade(fields.wall.value, 10), shade(fields.wall.value, -10), shade(fields.wall.value, 18)], water: fields.water.value } };
  });
  syncFields(); render(); scheduleSave();
}

function renderCatalog(levels = searchCatalog($('#catalog-search').value)) {
  const draftIds = new Set(drafts.list().map((entry) => entry.id));
  $('#catalog-count').textContent = `${passauCatalog.length} ORIGINAL`;
  $('#catalog-list').replaceChildren(...levels.map((level) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = `catalog-card${state.document.id === level.id ? ' active' : ''}`; button.dataset.levelId = level.id;
    button.innerHTML = `<span class="catalog-icon">${level.icon}</span><span><strong>${level.name.standard}</strong><small>${level.location.area}</small></span><em>${level.board.walls.length} BLÖCKE</em>${draftIds.has(level.id) ? '<i>ENTWURF</i>' : ''}`;
    button.addEventListener('click', () => loadLevel(drafts.load(level.id) ?? catalogLevel(level.id), `Vorlage „${level.name.standard}“ geladen`));
    return button;
  }));
}

function renderDraftList() {
  const entries = drafts.list().sort((a, b) => b.savedAt.localeCompare(a.savedAt)); $('#draft-count').textContent = String(entries.length);
  if (!entries.length) { $('#draft-list').innerHTML = '<p>Noch keine eigenen Entwürfe.</p>'; return; }
  $('#draft-list').replaceChildren(...entries.map((entry) => {
    const row = document.createElement('div'); row.className = 'draft-row';
    const open = document.createElement('button'); open.type = 'button'; open.innerHTML = `<strong>${entry.name}</strong><small>${new Date(entry.savedAt).toLocaleString('de-DE')}</small>`; open.addEventListener('click', () => loadLevel(drafts.load(entry.id), 'Entwurf geladen'));
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'draft-delete'; remove.setAttribute('aria-label', `${entry.name} löschen`); remove.textContent = '×'; remove.addEventListener('click', () => { drafts.remove(entry.id); renderDraftList(); renderCatalog(); showToast('Entwurf gelöscht'); });
    row.append(open, remove); return row;
  }));
}

function loadLevel(level, message = 'Level geladen', { save = false } = {}) {
  if (!level) return;
  state = new EditorState(level); renderedRevision = -1; renderedLevel = null; cursor = null; gesture = null; syncFields(); render(); renderCatalog();
  $('#draft-status').textContent = save ? 'Neuer Entwurf' : 'Vorlage geladen';
  if (save) scheduleSave();
  showToast(message);
}

function renderActorList() {
  const level = state.toDocument(); const items = [{ kind: 'player', index: 0, name: 'Franz & Lola', actor: level.actors.player }, ...level.actors.cats.map((actor, index) => ({ kind: 'cat', index, name: `Katze ${index + 1}`, actor }))];
  $('#actor-list').replaceChildren(...items.map((item) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = state.selected?.kind === item.kind && state.selected?.index === item.index ? 'active' : '';
    button.innerHTML = `<span style="--actor-color:${item.actor.color ?? '#4ce0b3'}">${item.kind === 'player' ? '●' : '◆'}</span><strong>${item.name}</strong><small>${item.actor.x}, ${item.actor.y}${item.actor.appearance ? ' · EIGENE PIXEL' : ''}</small>`;
    button.addEventListener('click', () => { state.selected = { kind: item.kind, index: item.index }; switchInspector('figures'); render(); }); return button;
  }));
  renderSelectionCard();
}

function renderSelectionCard() {
  const card = $('#selection-card'); const object = state.selectedObject();
  if (!object) { card.innerHTML = '<p>Mit „Auswahl“ eine Figur oder Dekoration anklicken.</p>'; return; }
  const label = state.selected.kind === 'player' ? 'Franz & Lola' : state.selected.kind === 'cat' ? `Katze ${state.selected.index + 1}` : `Dekoration · ${object.type}`;
  card.innerHTML = `<strong>${label}</strong><span>Feld ${object.x}, ${object.y}${object.width ? ` · ${object.width}×${object.height}` : ''}</span><div class="selection-settings"></div><div class="selection-actions"></div>`;
  const settings = card.querySelector('.selection-settings');
  const actions = card.querySelector('.selection-actions');
  if (state.selected.kind === 'player') {
    settings.innerHTML = `<label class="wide">Steuerung<select data-setting="controller"><option value="user">Spieler/in</option><option value="autopilot">Autopilot zu Guttis</option><option value="patrol">Patrouille</option><option value="stationary">Steht still</option></select></label><label>Tempo-Faktor<input data-setting="speedMultiplier" type="number" min="0.1" max="4" step="0.1" value="${object.behavior.speedMultiplier}"></label>`;
    settings.querySelector('[data-setting="controller"]').value = object.behavior.controller;
  } else if (state.selected.kind === 'cat') {
    settings.innerHTML = `<label class="wide">Verhalten<select data-setting="strategy"><option value="chase">Direkt verfolgen</option><option value="ambush">Vorausahnen</option><option value="scatter-chase">Wechsel: Ecke / Jagd</option><option value="scatter">Zur Zielecke</option><option value="guard">Ziel bewachen</option><option value="random">Zufällig</option><option value="stationary">Steht still</option></select></label><label>Tempo-Faktor<input data-setting="speedMultiplier" type="number" min="0.1" max="4" step="0.1" value="${object.behavior.speedMultiplier}"></label><label>Voraussicht<input data-setting="lookAhead" type="number" min="0" max="12" step="1" value="${object.behavior.lookAhead}"></label><label>Zufall-Faktor<input data-setting="wanderMultiplier" type="number" min="0" max="12" step="0.1" value="${object.behavior.wanderMultiplier}"></label><label>Startpause<input data-setting="respawnDelay" type="number" min="0" max="20" step="0.1" value="${object.behavior.respawnDelay}"></label><label>Ziel X<input data-setting="targetX" type="number" min="0" max="${state.document.board.columns - 1}" value="${object.behavior.target.x}"></label><label>Ziel Y<input data-setting="targetY" type="number" min="0" max="${state.document.board.rows - 1}" value="${object.behavior.target.y}"></label>`;
    settings.querySelector('[data-setting="strategy"]').value = object.behavior.strategy;
  } else {
    settings.innerHTML = `<label class="wide">Animation<select data-setting="animationType"><option value="none">Keine</option><option value="bob">Schweben</option><option value="pulse">Pulsieren</option><option value="blink">Blinken</option><option value="spin">Drehen</option></select></label><label>Tempo<input data-setting="animationSpeed" type="number" min="0.1" max="12" step="0.1" value="${object.animation.speed}"></label><label>Stärke<input data-setting="animationAmplitude" type="number" min="0" max="1" step="0.05" value="${object.animation.amplitude}"></label>`;
    settings.querySelector('[data-setting="animationType"]').value = object.animation.type;
  }
  if (['player', 'cat'].includes(state.selected.kind) && object.appearance?.animations?.length) {
    const labelElement = document.createElement('label'); labelElement.className = 'wide'; labelElement.textContent = 'Animation im Spiel';
    const select = document.createElement('select'); select.dataset.setting = 'actorAnimation'; select.append(new Option('Automatisch (idle / walk)', ''), ...object.appearance.animations.map((animation) => new Option(animation.id, animation.id))); select.value = object.animation ?? ''; labelElement.append(select); settings.append(labelElement);
  }
  settings.querySelectorAll('[data-setting]').forEach((input) => input.addEventListener('change', () => {
    state.mutate(`${label} Verhalten ändern`, (draft) => {
      const selected = draft.selectedObject(); const key = input.dataset.setting; const value = input.tagName === 'SELECT' ? input.value : Number(input.value);
      if (key === 'controller' || key === 'strategy' || key === 'speedMultiplier' || key === 'lookAhead' || key === 'wanderMultiplier' || key === 'respawnDelay') selected.behavior[key] = value;
      else if (key === 'targetX') selected.behavior.target.x = value;
      else if (key === 'targetY') selected.behavior.target.y = value;
      else if (key === 'animationType') selected.animation.type = value;
      else if (key === 'animationSpeed') selected.animation.speed = value;
      else if (key === 'animationAmplitude') selected.animation.amplitude = value;
      else if (key === 'actorAnimation') selected.animation = value;
    });
    render(); scheduleSave();
  }));
  if (['player', 'cat'].includes(state.selected.kind)) {
    const design = document.createElement('button'); design.type = 'button'; design.textContent = 'Pixel-Design'; design.addEventListener('click', openSpriteDesigner); actions.append(design);
  }
  if (state.selected.kind !== 'player') {
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'danger-subtle'; remove.textContent = 'Entfernen'; remove.addEventListener('click', () => { state.mutate('Objekt entfernen', (draft) => draft.deleteSelected()); render(); scheduleSave(); }); actions.append(remove);
  }
}

function validationView(level, pellets) {
  const result = validateLevelDocument(level); const issues = result.errors.length + result.warnings.length;
  $('#problem-count').textContent = String(issues); $('#problem-count').classList.toggle('has-problems', issues > 0);
  $('#validation-status').className = `validation-status ${result.ok ? 'valid' : 'invalid'}`;
  $('#validation-status').innerHTML = result.ok ? '<strong>✓ Level ist spielbar</strong><span>Alle Pflichtprüfungen bestanden.</span>' : `<strong>⚠ ${result.errors.length} Fehler</strong><span>Vor dem Export bitte korrigieren.</span>`;
  $('#validation-errors').replaceChildren(...(result.errors.length ? result.errors : ['Keine Fehler.']).map((message) => Object.assign(document.createElement('li'), { textContent: message })));
  $('#validation-warnings').replaceChildren(...(result.warnings.length ? result.warnings : ['Keine Hinweise.']).map((message) => Object.assign(document.createElement('li'), { textContent: message })));
  $('#metric-reachable').textContent = String(result.metrics.reachableTiles); $('#metric-walls').textContent = String(result.metrics.wallRectangles); $('#metric-guttis').textContent = String(pellets.size);
  $('#metric-objects').textContent = String(level.actors.cats.length + level.collectibles.powerUps.length + level.decorations.length + 1);
  return result;
}

function render() {
  if (renderedRevision !== state.revision || !renderedLevel) {
    renderedLevel = state.toDocument();
    renderer.setLevel(renderedLevel);
    renderedRevision = state.revision;
  }
  const level = renderedLevel;
  const pellets = $('#show-guttis').checked ? previewGuttis(level, $('#preview-difficulty').value) : new Set();
  const powerUps = new Set(level.collectibles.powerUps.map((point) => tileKey(point.x, point.y)));
  renderResult = renderer.render({ level, player: level.actors.player, cats: level.actors.cats, pellets, powerUps, elapsed: performance.now() / 1000 }, { cameraEnabled: false, editor: { showGrid: $('#show-grid').checked, cursor } });
  $('#stage-level-name').textContent = level.name.standard; $('#stage-level-id').textContent = level.id; $('#undo').disabled = state.history.length === 0; $('#redo').disabled = state.future.length === 0;
  $('#restore-template').disabled = !passauCatalog.some((entry) => entry.id === level.id);
  validationView(level, pellets); renderActorList();
  canvas.style.aspectRatio = `${level.board.columns} / ${level.board.rows}`;
}

function animateEditorCanvas(timestamp) {
  const level = renderedLevel;
  const hasAnimation = level && (level.decorations.some((item) => item.animation?.type !== 'none')
    || [level.actors.player, ...level.actors.cats].some((actor) => actor.appearance?.animations?.length));
  if (hasAnimation) {
    const pellets = $('#show-guttis').checked ? previewGuttis(level, $('#preview-difficulty').value) : new Set();
    const powerUps = new Set(level.collectibles.powerUps.map((point) => tileKey(point.x, point.y)));
    renderResult = renderer.render({ level, player: level.actors.player, cats: level.actors.cats, pellets, powerUps, elapsed: timestamp / 1000 }, { cameraEnabled: false, alpha: 1, editor: { showGrid: $('#show-grid').checked, cursor } });
  }
  requestAnimationFrame(animateEditorCanvas);
}

function pointFromEvent(event) {
  if (!renderResult) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  return worldPointFromScreen(renderResult.camera, { x: event.clientX, y: event.clientY }, { left: rect.left, top: rect.top }, state.toDocument());
}

function cursorForGesture(point) {
  if (!gesture || !['line', 'rectangle'].includes(tool)) return { ...point };
  return { x: Math.min(gesture.start.x, point.x), y: Math.min(gesture.start.y, point.y), width: Math.abs(point.x - gesture.start.x) + 1, height: Math.abs(point.y - gesture.start.y) + 1, color: 'rgba(85,217,221,.34)' };
}

function decorationSettings() {
  return {
    type: fields.decorationType.value, color: fields.decorationColor.value, label: fields.decorationLabel.value,
    width: Number(fields.decorationWidth.value), height: Number(fields.decorationHeight.value),
    animation: { type: fields.decorationAnimation.value, speed: Number(fields.decorationAnimationSpeed.value), amplitude: Number(fields.decorationAnimationAmplitude.value) },
  };
}

function applySingleTool(point, eraseOverride = false) {
  const chosen = eraseOverride ? 'erase' : tool;
  if (chosen === 'select') { state.selectAt(point); switchInspector('figures'); render(); return; }
  if (chosen === 'fill') {
    state.beginTransaction('Fläche füllen'); const points = floodFillPoints(point, state.wallCells, state.document.board.columns, state.document.board.rows); const makeWall = !state.wallCells.has(tileKey(point.x, point.y)); state.applyWallPoints(points, makeWall); state.endTransaction();
  } else if (chosen === 'player') state.mutate('Startpunkt setzen', (draft) => draft.setPlayer(point));
  else if (chosen === 'cat') state.mutate('Katze setzen', (draft) => draft.addCat(point, { color: fields.cat.value, accent: fields.accent.value, appearance: nextCatAppearance }));
  else if (chosen === 'power') state.mutate('Schnüffel-Power setzen', (draft) => draft.togglePowerUp(point));
  else if (chosen === 'decoration') state.mutate('Dekoration setzen', (draft) => draft.addDecoration(point, decorationSettings()));
  render(); scheduleSave();
}

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 && event.button !== 2) return; event.preventDefault(); const point = pointFromEvent(event); canvas.setPointerCapture(event.pointerId);
  if (['wall', 'erase'].includes(tool) || event.button === 2) {
    const chosen = event.button === 2 ? 'erase' : tool; state.beginTransaction(chosen === 'wall' ? 'Wände zeichnen' : 'Wände radieren'); state.setWall(point.x, point.y, chosen === 'wall'); gesture = { pointerId: event.pointerId, start: point, last: point, mode: chosen };
  } else if (['line', 'rectangle'].includes(tool)) gesture = { pointerId: event.pointerId, start: point, last: point, mode: tool };
  else applySingleTool(point, event.button === 2);
  cursor = cursorForGesture(point); render();
});

canvas.addEventListener('pointermove', (event) => {
  const point = pointFromEvent(event); $('#cursor-position').textContent = `Feld ${point.x}, ${point.y}`;
  if (gesture?.pointerId === event.pointerId) {
    if (['wall', 'erase'].includes(gesture.mode) && (point.x !== gesture.last.x || point.y !== gesture.last.y)) {
      state.applyWallPoints(linePoints(gesture.last, point), gesture.mode === 'wall'); gesture.last = point; scheduleSave();
    } else gesture.last = point;
  }
  cursor = cursorForGesture(point); render();
});

function finishGesture(event) {
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  const point = pointFromEvent(event);
  if (gesture.mode === 'line') { state.beginTransaction('Wandlinie'); state.applyWallPoints(linePoints(gesture.start, point), true); state.endTransaction(); }
  else if (gesture.mode === 'rectangle') { state.beginTransaction('Wandrechteck'); state.applyWallPoints(rectanglePoints(gesture.start, point), true); state.endTransaction(); }
  else state.endTransaction();
  gesture = null; cursor = { ...point }; render(); scheduleSave();
}

canvas.addEventListener('pointerup', finishGesture); canvas.addEventListener('pointercancel', finishGesture);
canvas.addEventListener('pointerleave', () => { if (!gesture) { cursor = null; $('#cursor-position').textContent = 'Feld —'; render(); } });
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

function setTool(next) {
  if (!toolHelp[next]) return; tool = next; $$('.tool').forEach((button) => button.classList.toggle('active', button.dataset.tool === tool)); $('#tool-help').textContent = toolHelp[tool];
  if (tool === 'decoration') switchInspector('design');
}

function switchInspector(name) {
  $$('.inspector-tabs [role=tab]').forEach((button) => { const active = button.dataset.panel === name; button.setAttribute('aria-selected', String(active)); });
  $$('.inspector-section').forEach((section) => section.classList.toggle('active', section.dataset.inspector === name));
}

function downloadJson(value, filename) {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
}

function defaultSprite() {
  return { width: 8, height: 8, palette: ['transparent', '#ff6b5f', '#f4eee0', '#17212a'], pixels: ['00111100', '01111110', '11211211', '11122111', '11111111', '01111110', '01000010', '00100100'], animations: [] };
}

function openSpriteDesigner() {
  const object = state.selectedObject(); spriteDraft = clone(object?.appearance ?? nextCatAppearance ?? defaultSprite());
  spriteDraft.animations ??= [];
  const target = $('#sprite-target'); target.replaceChildren(new Option('Nächste Katze', 'next-cat'), new Option('Franz & Lola', 'player'), ...state.document.actors.cats.map((_, index) => new Option(`Katze ${index + 1}`, `cat-${index}`)));
  if (state.selected?.kind === 'player') target.value = 'player'; else if (state.selected?.kind === 'cat') target.value = `cat-${state.selected.index}`; else target.value = 'next-cat';
  spritePaletteIndex = 1; spriteAnimationId = 'base'; spriteFrameIndex = 0; renderSpriteDesigner(); $('#sprite-dialog').showModal(); startSpritePreview();
}

function selectedSpriteAnimation() { return spriteDraft.animations.find((animation) => animation.id === spriteAnimationId) ?? null; }
function currentSpriteRows() { return selectedSpriteAnimation()?.frames[spriteFrameIndex]?.pixels ?? spriteDraft.pixels; }
function updateCurrentSpriteRows(rows) {
  const animation = selectedSpriteAnimation();
  if (animation) animation.frames[spriteFrameIndex].pixels = rows;
  else spriteDraft.pixels = rows;
}

function renderSpriteDesigner() {
  const animationSelect = $('#sprite-animation');
  animationSelect.replaceChildren(new Option('Standbild', 'base'), ...spriteDraft.animations.map((animation) => new Option(animation.id, animation.id)));
  animationSelect.value = spriteAnimationId;
  const animation = selectedSpriteAnimation();
  if (animation) spriteFrameIndex = Math.min(spriteFrameIndex, animation.frames.length - 1); else spriteFrameIndex = 0;
  $('#sprite-frame-copy').textContent = animation ? `Frame ${spriteFrameIndex + 1} / ${animation.frames.length}` : 'Standbild';
  $('#sprite-prev-frame').disabled = !animation || animation.frames.length < 2;
  $('#sprite-next-frame').disabled = !animation || animation.frames.length < 2;
  $('#sprite-add-frame').disabled = !animation;
  $('#sprite-delete-frame').disabled = !animation || animation.frames.length <= 1;
  $('#sprite-delete-animation').disabled = !animation;
  $('#sprite-fps').disabled = !animation; $('#sprite-loop').disabled = !animation;
  $('#sprite-fps').value = animation?.fps ?? 6; $('#sprite-loop').checked = animation?.loop ?? true;
  const grid = $('#sprite-grid'); grid.style.setProperty('--sprite-columns', spriteDraft.width); grid.replaceChildren();
  currentSpriteRows().forEach((row, y) => [...row].forEach((token, x) => {
    const index = Number.parseInt(token, 36); const button = document.createElement('button'); button.type = 'button'; button.dataset.x = x; button.dataset.y = y;
    button.style.background = spriteDraft.palette[index] === 'transparent' ? 'transparent' : spriteDraft.palette[index]; button.setAttribute('aria-label', `Pixel ${x}, ${y}`); grid.append(button);
  }));
  $('#sprite-palette').replaceChildren(...spriteDraft.palette.map((color, index) => { const button = document.createElement('button'); button.type = 'button'; button.className = index === spritePaletteIndex ? 'active' : ''; button.style.setProperty('--palette-color', color === 'transparent' ? '#101820' : color); button.textContent = index === 0 ? '⌫' : String(index); button.addEventListener('click', () => { spritePaletteIndex = index; renderSpriteDesigner(); }); return button; }));
}

function paintSpritePixel(x, y, index) { const rows = [...currentSpriteRows()]; rows[y] = `${rows[y].slice(0, x)}${index.toString(36)}${rows[y].slice(x + 1)}`; updateCurrentSpriteRows(rows); renderSpriteDesigner(); }

function startSpritePreview() {
  cancelAnimationFrame(spritePreviewFrame);
  const draw = (timestamp) => {
    if (!$('#sprite-dialog').open || !spriteDraft) return;
    const preview = $('#sprite-preview'); const context = preview.getContext('2d'); context.clearRect(0, 0, preview.width, preview.height); context.imageSmoothingEnabled = false;
    const rows = selectAppearanceFrame(spriteDraft, { animationId: spriteAnimationId === 'base' ? '' : spriteAnimationId, elapsed: timestamp / 1000 });
    const scale = Math.max(1, Math.floor(Math.min(preview.width / spriteDraft.width, preview.height / spriteDraft.height)));
    const left = Math.floor((preview.width - spriteDraft.width * scale) / 2); const top = Math.floor((preview.height - spriteDraft.height * scale) / 2);
    rows.forEach((row, y) => [...row].forEach((token, x) => { const color = spriteDraft.palette[Number.parseInt(token, 36)]; if (!color || color === 'transparent') return; context.fillStyle = color; context.fillRect(left + x * scale, top + y * scale, scale, scale); }));
    spritePreviewFrame = requestAnimationFrame(draw);
  };
  spritePreviewFrame = requestAnimationFrame(draw);
}

function saveSprite() {
  const target = $('#sprite-target').value;
  if (target === 'next-cat') nextCatAppearance = clone(spriteDraft);
  else state.mutate('Pixel-Figur gestalten', (draft) => { draft.selected = target === 'player' ? { kind: 'player', index: 0 } : { kind: 'cat', index: Number(target.split('-')[1]) }; draft.setSelectedAppearance(spriteDraft); });
  $('#sprite-dialog').close(); render(); scheduleSave(); showToast('Pixel-Figur übernommen');
}

function startPlaytest() {
  const level = state.toDocument(); const result = validateLevelDocument(level);
  if (!result.ok) { switchInspector('check'); showToast('Vor dem Testlauf bitte die Fehler korrigieren'); return; }
  $('#playtest-dialog').showModal(); resetPlaytest(level); startPlaytestLoop();
}

function resetPlaytest(level = state.toDocument()) {
  playtest = new PlaytestEngine(level, $('#preview-difficulty').value); const playCanvas = $('#playtest-canvas'); playtestRenderer = new PassauPixelRenderer(playCanvas, { zoom: 1.12 }); playtestRenderer.setLevel(playtest.level);
  playtestLoop = new FixedStepLoop({ updatesPerSecond: 120 }); playtestPaused = false; $('#playtest-pause').textContent = 'Ⅱ Pause'; renderPlaytest(0);
}

function startPlaytestLoop() {
  cancelAnimationFrame(playtestFrame); playtestLoop.reset();
  const frame = (timestamp) => {
    if (!$('#playtest-dialog').open || !playtest) return;
    if (!playtestPaused) playtestLoop.advance(timestamp, (dt) => playtest.step(dt)); else playtestLoop.reset(timestamp);
    renderPlaytest(playtestLoop.interpolationAlpha); playtestFrame = requestAnimationFrame(frame);
  };
  playtestFrame = requestAnimationFrame(frame);
}

function stopPlaytest() {
  cancelAnimationFrame(playtestFrame); playtestFrame = null; playtestLoop = null; playtest = null; playtestRenderer = null;
  $('#playtest-dialog').classList.remove('immersive');
  if (document.fullscreenElement === $('#playtest-stage')) document.exitFullscreen().catch(() => {});
}

function renderPlaytest(alpha = 1) {
  if (!playtest || !$('#playtest-dialog').open) return;
  const snapshot = playtest.snapshot(); const total = playtest.initialPellets.size;
  playtestRenderer.render(snapshot, { cameraEnabled: playtestCameraEnabled, zoom: 1.12, alpha });
  $('#playtest-score').textContent = `${snapshot.collected} / ${total}`; $('#playtest-points').textContent = String(snapshot.score); $('#playtest-lives').textContent = String(snapshot.lives);
  const copy = playtestPaused ? 'PAUSE' : snapshot.state === 'won' ? '✓ LEVEL GESCHAFFT' : snapshot.state === 'lost' ? 'KEINE LEBEN MEHR' : snapshot.state === 'hit' ? 'AUTSCH!' : snapshot.powerTimer > 0 ? `POWER ${snapshot.powerTimer.toFixed(1)} s` : 'PFEILTASTEN · WASD · WISCHEN';
  $('#playtest-state').textContent = copy;
}

function playDirection(name) { if (playtest) playtest.setDirection(name); }

async function togglePlaytestFullscreen() {
  const stage = $('#playtest-stage'); const dialog = $('#playtest-dialog');
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (stage.requestFullscreen) await stage.requestFullscreen();
    else dialog.classList.toggle('immersive');
  } catch { dialog.classList.toggle('immersive'); }
  playtestRenderer?.resize(); renderPlaytest(playtestLoop?.interpolationAlpha ?? 1);
}

$$('.tool').forEach((button) => button.addEventListener('click', () => setTool(button.dataset.tool)));
$$('.inspector-tabs [role=tab]').forEach((button) => button.addEventListener('click', () => switchInspector(button.dataset.panel)));
Object.values(fields).filter((field) => !field.id.startsWith('cat-') && !field.id.startsWith('decoration-')).forEach((field) => field.addEventListener('change', applyFields));
Object.values(profileFields).forEach((field) => field.addEventListener('change', applyProfileFields));
$('#catalog-search').addEventListener('input', () => renderCatalog()); $('#undo').addEventListener('click', () => { if (state.undo()) { syncFields(); render(); scheduleSave(); } }); $('#redo').addEventListener('click', () => { if (state.redo()) { syncFields(); render(); scheduleSave(); } });
$('#new-level').addEventListener('click', () => loadLevel(createStarterLevel(), 'Leeres Level angelegt', { save: true })); $('#clear-cats').addEventListener('click', () => { state.mutate('Alle Katzen entfernen', (draft) => { draft.document.actors.cats = []; draft.selected = null; }); render(); scheduleSave(); });
$('#show-guttis').addEventListener('change', render); $('#show-grid').addEventListener('change', render); $('#preview-difficulty').addEventListener('change', () => { syncProfileFields(); render(); });
$('#zoom-level').addEventListener('input', (event) => { const zoom = Number(event.target.value); $('#zoom-copy').textContent = `${zoom}%`; canvas.style.width = `${zoom}%`; renderer.resize(); render(); });
$('#help-button').addEventListener('click', () => $('#help-dialog').showModal()); $('#quick-tour').addEventListener('click', () => $('#help-dialog').showModal()); $('#sprite-designer-button').addEventListener('click', openSpriteDesigner);
$('#sprite-add-color').addEventListener('click', () => { const color = $('#sprite-color').value; if (!spriteDraft.palette.includes(color) && spriteDraft.palette.length < 10) spriteDraft.palette.push(color); spritePaletteIndex = spriteDraft.palette.indexOf(color); renderSpriteDesigner(); });
$('#sprite-animation').addEventListener('change', (event) => { spriteAnimationId = event.target.value; spriteFrameIndex = 0; renderSpriteDesigner(); });
$('#sprite-add-animation').addEventListener('click', () => {
  const base = ($('#sprite-animation-name').value || 'animation').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'animation'; let id = base; let suffix = 2;
  while (spriteDraft.animations.some((animation) => animation.id === id)) { id = `${base}-${suffix}`; suffix += 1; }
  spriteDraft.animations.push({ id, fps: 6, loop: true, frames: [{ pixels: [...currentSpriteRows()] }] }); spriteAnimationId = id; spriteFrameIndex = 0; renderSpriteDesigner();
});
$('#sprite-delete-animation').addEventListener('click', () => { if (spriteAnimationId === 'base') return; spriteDraft.animations = spriteDraft.animations.filter((animation) => animation.id !== spriteAnimationId); spriteAnimationId = 'base'; spriteFrameIndex = 0; renderSpriteDesigner(); });
$('#sprite-prev-frame').addEventListener('click', () => { const count = selectedSpriteAnimation()?.frames.length ?? 1; spriteFrameIndex = (spriteFrameIndex - 1 + count) % count; renderSpriteDesigner(); });
$('#sprite-next-frame').addEventListener('click', () => { const count = selectedSpriteAnimation()?.frames.length ?? 1; spriteFrameIndex = (spriteFrameIndex + 1) % count; renderSpriteDesigner(); });
$('#sprite-add-frame').addEventListener('click', () => { const animation = selectedSpriteAnimation(); if (!animation || animation.frames.length >= 64) return; animation.frames.splice(spriteFrameIndex + 1, 0, { pixels: [...currentSpriteRows()] }); spriteFrameIndex += 1; renderSpriteDesigner(); });
$('#sprite-delete-frame').addEventListener('click', () => { const animation = selectedSpriteAnimation(); if (!animation || animation.frames.length <= 1) return; animation.frames.splice(spriteFrameIndex, 1); spriteFrameIndex = Math.max(0, spriteFrameIndex - 1); renderSpriteDesigner(); });
$('#sprite-fps').addEventListener('change', (event) => { const animation = selectedSpriteAnimation(); if (animation) animation.fps = Number(event.target.value); renderSpriteDesigner(); });
$('#sprite-loop').addEventListener('change', (event) => { const animation = selectedSpriteAnimation(); if (animation) animation.loop = event.target.checked; renderSpriteDesigner(); });
$('#sprite-clear').addEventListener('click', () => { updateCurrentSpriteRows(Array.from({ length: spriteDraft.height }, () => '0'.repeat(spriteDraft.width))); renderSpriteDesigner(); });
$('#sprite-mirror').addEventListener('click', () => { updateCurrentSpriteRows(currentSpriteRows().map((row) => [...row].reverse().join(''))); renderSpriteDesigner(); }); $('#sprite-save').addEventListener('click', saveSprite);
$('#sprite-grid').addEventListener('contextmenu', (event) => event.preventDefault());
$('#sprite-grid').addEventListener('pointerdown', (event) => { const pixel = event.target.closest('button[data-x]'); if (!pixel) return; event.preventDefault(); spritePainting = true; paintSpritePixel(Number(pixel.dataset.x), Number(pixel.dataset.y), event.button === 2 ? 0 : spritePaletteIndex); });
$('#sprite-grid').addEventListener('pointermove', (event) => { if (!spritePainting || event.buttons === 0) return; const pixel = event.target.closest('button[data-x]'); if (pixel) paintSpritePixel(Number(pixel.dataset.x), Number(pixel.dataset.y), (event.buttons & 2) ? 0 : spritePaletteIndex); });
window.addEventListener('pointerup', () => { spritePainting = false; });
$('#sprite-dialog').addEventListener('close', () => { cancelAnimationFrame(spritePreviewFrame); spritePreviewFrame = null; });
$('#playtest-button').addEventListener('click', startPlaytest); $('#playtest-reset').addEventListener('click', () => resetPlaytest());
$('#playtest-pause').addEventListener('click', () => { playtestPaused = !playtestPaused; $('#playtest-pause').textContent = playtestPaused ? '▶ Weiter' : 'Ⅱ Pause'; renderPlaytest(playtestLoop?.interpolationAlpha ?? 1); });
$('#playtest-camera').addEventListener('click', () => { playtestCameraEnabled = !playtestCameraEnabled; $('#playtest-camera').setAttribute('aria-pressed', String(playtestCameraEnabled)); $('#playtest-camera').textContent = playtestCameraEnabled ? '◎ Kamera' : '▣ Ganzes Level'; renderPlaytest(playtestLoop?.interpolationAlpha ?? 1); });
$('#playtest-fullscreen').addEventListener('click', togglePlaytestFullscreen);
$$('[data-play-direction]').forEach((button) => button.addEventListener('pointerdown', (event) => { event.preventDefault(); playDirection(button.dataset.playDirection); }));
$('#playtest-dialog').addEventListener('close', stopPlaytest);
document.addEventListener('fullscreenchange', () => { $('#playtest-fullscreen').textContent = document.fullscreenElement ? '▣ Fenster' : '⛶ Vollbild'; playtestRenderer?.resize(); renderPlaytest(playtestLoop?.interpolationAlpha ?? 1); });
$('#playtest-stage').addEventListener('pointerdown', (event) => { if (event.target.closest('button')) return; playtestGesture = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }; });
$('#playtest-stage').addEventListener('pointerup', (event) => { if (!playtestGesture || playtestGesture.pointerId !== event.pointerId) return; const dx = event.clientX - playtestGesture.x; const dy = event.clientY - playtestGesture.y; playtestGesture = null; if (Math.hypot(dx, dy) < 18) return; playDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); });
$('#restore-template').addEventListener('click', () => { const original = catalogLevel(state.document.id); if (!original) return; drafts.remove(original.id); loadLevel(original, 'Originalvorlage wiederhergestellt'); });
$('#export-level').addEventListener('click', () => { const level = state.toDocument(); const result = validateLevelDocument(level); if (!result.ok) { switchInspector('check'); showToast('Export blockiert: Level enthält Fehler'); return; } downloadJson(level, `${level.id}.level.json`); showToast('Level-JSON exportiert'); });
$('#export-catalog').addEventListener('click', () => { downloadJson(catalogDocument(), 'passau-original-levels.catalog.json'); showToast('Originalkatalog exportiert'); });
$('#import-level').addEventListener('change', async (event) => { const file = event.target.files[0]; if (!file) return; const result = parseLevelDocument(await file.text()); event.target.value = ''; if (!result.ok) { showToast(`Import fehlgeschlagen: ${result.errors[0]}`); switchInspector('check'); return; } loadLevel(result.value, `„${file.name}“ importiert`, { save: true }); });
$('#focus-first-problem').addEventListener('click', () => { switchInspector('check'); showToast('Fehler sind in der Liste beschrieben und werden beim Bearbeiten live neu geprüft.'); });

document.addEventListener('keydown', (event) => {
  if ($('#playtest-dialog').open) {
    const direction = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' }[event.code];
    if (direction) { event.preventDefault(); playDirection(direction); } return;
  }
  if (event.target.matches('input, textarea, select') || $('.modal[open]')) return;
  if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') { event.preventDefault(); if (event.shiftKey ? state.redo() : state.undo()) { syncFields(); render(); scheduleSave(); } return; }
  if ((event.ctrlKey || event.metaKey) && event.code === 'KeyY') { event.preventDefault(); if (state.redo()) { syncFields(); render(); scheduleSave(); } return; }
  if ((event.ctrlKey || event.metaKey) && event.code === 'KeyS') { event.preventDefault(); $('#export-level').click(); return; }
  if ((event.ctrlKey || event.metaKey) && event.code === 'KeyN') { event.preventDefault(); $('#new-level').click(); return; }
  const shortcut = { KeyV: 'select', KeyB: 'wall', KeyL: 'line', KeyR: 'rectangle', KeyF: 'fill', KeyE: 'erase', KeyP: 'player', KeyK: 'cat', KeyG: 'power', KeyD: 'decoration' }[event.code];
  if (shortcut) { event.preventDefault(); setTool(shortcut); }
  if ((event.code === 'Delete' || event.code === 'Backspace') && state.selected) { state.mutate('Objekt entfernen', (draft) => draft.deleteSelected()); render(); scheduleSave(); }
});

window.addEventListener('resize', () => { renderer.resize(); render(); });
syncFields(); renderCatalog(); renderDraftList(); render(); requestAnimationFrame(animateEditorCanvas);
