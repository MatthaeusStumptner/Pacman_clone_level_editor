import './style.css';
import { PassauPixelRenderer, parseLevelDocument, tileKey, validateLevelDocument } from '@franz-lola/pixel-renderer';
import { createStarterLevel, EditorState } from './editor-state.js';

const DRAFT_KEY = 'franz-lola-level-editor-draft-v1';
const canvas = document.querySelector('#level-canvas');
const renderer = new PassauPixelRenderer(canvas, { zoom: 1 });
let state = new EditorState(loadDraft() ?? createStarterLevel());
let tool = 'wall';
let cursor = null;
let painting = false;
let lastPainted = '';

const fields = {
  id: document.querySelector('#level-id'), name: document.querySelector('#level-name'), dialect: document.querySelector('#level-name-dialect'),
  area: document.querySelector('#level-area'), columns: document.querySelector('#level-columns'), rows: document.querySelector('#level-rows'),
  theme: document.querySelector('#level-theme'), ground: document.querySelector('#ground-color'), wall: document.querySelector('#wall-color'), water: document.querySelector('#water-color'),
  cat: document.querySelector('#cat-color'), accent: document.querySelector('#cat-accent'),
};

function loadDraft() {
  try { const raw = localStorage.getItem(DRAFT_KEY); return raw ? parseLevelDocument(raw).value : null; } catch { return null; }
}

function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(state.toDocument())); document.querySelector('#draft-status').textContent = 'Entwurf lokal gespeichert'; }
  catch { document.querySelector('#draft-status').textContent = 'Lokales Speichern blockiert'; }
}

function syncFields() {
  const level = state.toDocument();
  fields.id.value = level.id; fields.name.value = level.name.standard; fields.dialect.value = level.name.dialect; fields.area.value = level.location.area;
  fields.columns.value = level.board.columns; fields.rows.value = level.board.rows; fields.theme.value = level.theme.landmark;
  fields.ground.value = level.theme.palette.ground[0]; fields.wall.value = level.theme.palette.walls[0]; fields.water.value = level.theme.palette.water;
}

function syncDocumentFromFields() {
  const current = state.toDocument();
  const columns = Number(fields.columns.value); const rows = Number(fields.rows.value);
  state.replace({
    ...current, id: fields.id.value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    name: { standard: fields.name.value, dialect: fields.dialect.value }, location: { ...current.location, area: fields.area.value },
    board: { ...current.board, columns, rows, tunnelRows: [Math.floor(rows / 2)], walls: current.board.walls.filter((wall) => wall.x < columns && wall.y < rows) },
    theme: { ...current.theme, id: fields.theme.value, landmark: fields.theme.value, palette: { ...current.theme.palette, ground: [fields.ground.value, fields.ground.value, shade(fields.ground.value, -8), shade(fields.ground.value, 8)], walls: [fields.wall.value, shade(fields.wall.value, 10), shade(fields.wall.value, -10), shade(fields.wall.value, 18)], water: fields.water.value } },
    actors: { ...current.actors, player: clampPoint(current.actors.player, columns, rows), cats: current.actors.cats.map((cat) => ({ ...cat, ...clampPoint(cat, columns, rows) })) },
  }, false);
  render(); saveDraft();
}

function shade(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16); const adjust = (shift) => Math.max(0, Math.min(255, (value >> shift & 255) + amount));
  return `#${[16, 8, 0].map((shift) => adjust(shift).toString(16).padStart(2, '0')).join('')}`;
}
const clampPoint = (point, columns, rows) => ({ x: Math.max(1, Math.min(columns - 2, point.x)), y: Math.max(1, Math.min(rows - 2, point.y)) });

function render() {
  const level = state.toDocument(); renderer.setLevel(level);
  const powerUps = new Set(level.collectibles.powerUps.map((point) => tileKey(point.x, point.y)));
  renderer.render({ level, player: level.actors.player, cats: level.actors.cats, pellets: new Set(), powerUps, elapsed: performance.now() / 1000 }, { cameraEnabled: false, editor: { showGrid: true, cursor } });
  const validation = validateLevelDocument(level); const status = document.querySelector('#validation-status'); const errors = document.querySelector('#validation-errors');
  status.className = validation.ok ? 'valid' : 'invalid'; status.textContent = validation.ok ? '✓ Level ist spielbar' : `⚠ ${validation.errors.length} Problem${validation.errors.length === 1 ? '' : 'e'}`;
  errors.replaceChildren(...validation.errors.map((message) => Object.assign(document.createElement('li'), { textContent: message })));
  document.querySelector('#undo').disabled = state.history.length === 0; document.querySelector('#redo').disabled = state.future.length === 0;
}

function pointFromEvent(event) {
  const rect = canvas.getBoundingClientRect(); const level = state.toDocument();
  return { x: Math.max(0, Math.min(level.board.columns - 1, Math.floor((event.clientX - rect.left) / rect.width * level.board.columns))), y: Math.max(0, Math.min(level.board.rows - 1, Math.floor((event.clientY - rect.top) / rect.height * level.board.rows))) };
}

function applyTool(point, eraseOverride = false) {
  const key = tileKey(point.x, point.y); if (key === lastPainted) return; lastPainted = key;
  const chosen = eraseOverride ? 'erase' : tool;
  state.commit((draft) => {
    if (chosen === 'wall' || chosen === 'erase') draft.setWall(point.x, point.y, chosen === 'wall');
    if (chosen === 'player') { draft.wallCells.delete(key); draft.document.actors.player = point; }
    if (chosen === 'cat') { draft.wallCells.delete(key); draft.document.actors.cats.push({ ...point, renderer: 'cat', color: fields.cat.value, accent: fields.accent.value }); }
    if (chosen === 'power') {
      draft.wallCells.delete(key); const exists = draft.document.collectibles.powerUps.some((item) => item.x === point.x && item.y === point.y);
      draft.document.collectibles.powerUps = exists ? draft.document.collectibles.powerUps.filter((item) => item.x !== point.x || item.y !== point.y) : [...draft.document.collectibles.powerUps, point];
    }
  });
  render(); saveDraft();
}

canvas.addEventListener('pointerdown', (event) => { event.preventDefault(); painting = true; lastPainted = ''; canvas.setPointerCapture(event.pointerId); applyTool(pointFromEvent(event), event.button === 2); });
canvas.addEventListener('pointermove', (event) => { cursor = pointFromEvent(event); document.querySelector('#cursor-position').textContent = `Feld ${cursor.x}, ${cursor.y}`; if (painting && ['wall', 'erase'].includes(tool)) applyTool(cursor, event.buttons === 2); else render(); });
canvas.addEventListener('pointerup', () => { painting = false; lastPainted = ''; });
canvas.addEventListener('pointerleave', () => { cursor = null; painting = false; render(); });
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

document.querySelectorAll('[data-tool]').forEach((button) => button.addEventListener('click', () => { tool = button.dataset.tool; document.querySelectorAll('[data-tool]').forEach((item) => item.classList.toggle('active', item === button)); }));
Object.values(fields).filter((field) => !['cat-color', 'cat-accent'].includes(field.id)).forEach((field) => field.addEventListener('change', syncDocumentFromFields));
document.querySelector('#clear-cats').addEventListener('click', () => { state.commit((draft) => { draft.document.actors.cats = []; }); render(); saveDraft(); });
document.querySelector('#undo').addEventListener('click', () => { if (state.undo()) { syncFields(); render(); saveDraft(); } });
document.querySelector('#redo').addEventListener('click', () => { if (state.redo()) { syncFields(); render(); saveDraft(); } });
document.querySelector('#new-level').addEventListener('click', () => { state = new EditorState(createStarterLevel()); syncFields(); render(); saveDraft(); });
document.querySelector('#import-level').addEventListener('change', async (event) => { const file = event.target.files[0]; if (!file) return; const result = parseLevelDocument(await file.text()); if (!result.ok) { alert(result.errors.join('\n')); return; } state.replace(result.value); syncFields(); render(); saveDraft(); event.target.value = ''; });
document.querySelector('#export-level').addEventListener('click', () => { const level = state.toDocument(); const result = validateLevelDocument(level); if (!result.ok && !confirm('Das Level hat noch Probleme. Trotzdem exportieren?')) return; const blob = new Blob([JSON.stringify(level, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${level.id}.level.json`; link.click(); URL.revokeObjectURL(link.href); });
window.addEventListener('resize', render);

syncFields(); render();
