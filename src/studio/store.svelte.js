import { createLevelDocument, tileKey, validateLevelDocument } from '@franz-lola/pixel-renderer';
import { catalogLevel, passauCatalog } from '../catalog.js';
import { DraftRepository } from '../draft-repository.js';
import { createStarterLevel, EditorState } from '../editor-state.js';
import { floodFillPoints, linePoints, moveRectangle, previewGuttis, rectangleContains, rectanglePoints, scaleRectangle, transformHandleAt } from '../editor-tools.js';
import { createFranzLolaAppearance } from '../character-template.js';
import { ObjectLibrary, createBlankObjectAsset, placementFromAsset } from '../object-library.js';
import { chooseSceneCandidate, sceneCandidatesAt, sceneEntity, sceneGroups as buildSceneGroups, sceneSelectionKey, workspaceForSelection } from '../scene-model.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const slug = (value, fallback = 'eintrag') => String(value || fallback)
  .normalize('NFKD').replace(/\p{Diacritic}/gu, '').replace(/ß/g, 'ss')
  .toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || fallback;

function getAt(root, path) {
  return path.reduce((value, key) => value?.[key], root);
}

function setAt(root, path, value) {
  const parent = path.slice(0, -1).reduce((entry, key) => entry[key], root);
  parent[path.at(-1)] = value;
}

export class StudioState {
  workspace = $state('level');
  level = $state.raw(null);
  selection = $state.raw(null);
  selections = $state.raw([]);
  hiddenSceneNodes = $state.raw(new Set());
  sceneRevision = $state(0);
  tool = $state('select');
  difficulty = $state('easy');
  showGrid = $state(true);
  showGuttis = $state(true);
  showEvents = $state(true);
  cursor = $state.raw(null);
  cursorCopy = $state('Feld —');
  saveStatus = $state('GESPEICHERT');
  toast = $state('');
  assets = $state.raw([]);
  selectedAssetId = $state('music-note');
  selectedEventId = $state('');
  selectedCutsceneId = $state('');
  selectedTrackId = $state('');
  selectedKeyframeId = $state('');
  language = $state('standard');
  revision = $state(0);

  validation = $derived.by(() => this.level ? validateLevelDocument(this.level) : { ok: false, errors: [], warnings: [], metrics: {} });
  pellets = $derived.by(() => this.level ? previewGuttis(this.level, this.difficulty) : new Set());
  canUndo = $derived(this.revision >= 0 && Boolean(this.engine?.history.length));
  canRedo = $derived(this.revision >= 0 && Boolean(this.engine?.future.length));
  selectedAsset = $derived.by(() => this.assets.find((asset) => asset.id === this.selectedAssetId) ?? this.assets[0] ?? null);
  selectedEvent = $derived.by(() => this.level?.events.find((event) => event.id === this.selectedEventId) ?? null);
  selectedCutscene = $derived.by(() => this.level?.cutscenes.find((cutscene) => cutscene.id === this.selectedCutsceneId) ?? null);
  selectionCount = $derived.by(() => this.selections.length);
  editorLevel = $derived.by(() => {
    this.sceneRevision;
    if (!this.level) return null;
    const visible = (kind, item, index) => !this.hiddenSceneNodes.has(sceneSelectionKey(this.level, { kind, index }));
    return {
      ...this.level,
      actors: { ...this.level.actors, cats: this.level.actors.cats.filter((item, index) => visible('cat', item, index)) },
      decorations: this.level.decorations.filter((item, index) => visible('decoration', item, index)),
      events: this.level.events.filter((item, index) => visible('event', item, index)),
    };
  });
  selectedTrack = $derived.by(() => this.selectedCutscene?.tracks.find((track) => track.id === this.selectedTrackId) ?? null);
  selectedKeyframe = $derived.by(() => this.selectedTrack?.keyframes.find((frame) => frame.id === this.selectedKeyframeId) ?? null);

  constructor({ storage = globalThis.localStorage } = {}) {
    this.drafts = new DraftRepository(storage);
    this.library = new ObjectLibrary(storage);
    this.assets = this.library.list();
    this.engine = new EditorState(this.drafts.active() ?? createStarterLevel());
    this.level = this.engine.toDocument();
    this.selectedEventId = this.level.events[0]?.id ?? '';
    this.selectedCutsceneId = this.level.cutscenes[0]?.id ?? '';
    this.saveTimer = null;
    this.toastTimer = null;
    this.gesture = null;
  }

  sync({ save = true, preserveSelection = true } = {}) {
    this.level = this.engine.toDocument();
    if (!preserveSelection || this.engine.selected) {
      this.selection = clone(this.engine.selected);
      this.selections = this.selection ? [clone(this.selection)] : [];
    }
    if (!this.level.events.some((event) => event.id === this.selectedEventId)) this.selectedEventId = this.level.events[0]?.id ?? '';
    if (!this.level.cutscenes.some((cutscene) => cutscene.id === this.selectedCutsceneId)) this.selectedCutsceneId = this.level.cutscenes[0]?.id ?? '';
    this.revision += 1;
    if (save) this.scheduleSave();
  }

  scheduleSave() {
    this.saveStatus = 'SPEICHERT …';
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.drafts.save(this.engine.toDocument());
      this.saveStatus = 'GESPEICHERT';
    }, 180);
  }

  notify(message) {
    this.toast = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toast = ''; }, 2800);
  }

  mutate(label, mutator, options) {
    this.engine.mutate(label, mutator);
    this.sync(options);
  }

  update(path, value, label = 'Eigenschaft ändern') {
    this.mutate(label, (draft) => setAt(draft.document, path, value), { preserveSelection: true });
  }

  value(path) { return getAt(this.level, path); }

  load(level, message = 'Level geladen') {
    this.engine = new EditorState(createLevelDocument(level));
    this.selection = null;
    this.selections = [];
    this.hiddenSceneNodes = new Set();
    this.sceneRevision += 1;
    this.selectedEventId = this.engine.document.events[0]?.id ?? '';
    this.selectedCutsceneId = this.engine.document.cutscenes[0]?.id ?? '';
    this.selectedTrackId = '';
    this.selectedKeyframeId = '';
    this.sync();
    this.notify(message);
  }

  newLevel() { this.load(createStarterLevel(), 'Neues Level angelegt'); }
  loadTemplate(id) { const level = catalogLevel(id); if (level) this.load(level, `${level.name.standard} geladen`); }
  loadDraft(id) { const level = this.drafts.load(id); if (level) this.load(level, 'Entwurf geladen'); }
  undo() { if (this.engine.undo()) this.sync(); }
  redo() { if (this.engine.redo()) this.sync(); }

  setTool(tool) {
    this.tool = tool;
  }

  specialElementBounds(id) {
    const middle = this.level.board.columns / 2;
    if (id === 'stage-note') return { x: middle - 1, y: 7, width: 2, height: 2 };
    if (id === 'stage-lights') return { x: middle - 5, y: 5, width: 10, height: 7 };
    return null;
  }

  sceneGroups() { return buildSceneGroups(this.level); }
  sceneKey(kind, index) { return sceneSelectionKey(this.level, { kind, index }); }
  isSceneHidden(kind, index) { return this.hiddenSceneNodes.has(this.sceneKey(kind, index)); }
  isSelected(kind, index) { const key = this.sceneKey(kind, index); return this.selections.some((selection) => sceneSelectionKey(this.level, selection) === key); }

  clearSelection() {
    this.selection = null;
    this.selections = [];
    this.engine.selected = null;
  }

  selectAt(point, { cycle = false, additive = false } = {}) {
    const candidates = sceneCandidatesAt(this.level, point, { hidden: this.hiddenSceneNodes, themeBounds: (id) => this.specialElementBounds(id) });
    const selected = chooseSceneCandidate(this.level, candidates, this.selection, cycle);
    if (selected) this.selectEntity(selected.kind, selected.index, { additive });
    else if (!additive) this.clearSelection();
    return selected;
  }

  selectedEntity(selection = this.selection) { return sceneEntity(this.level, selection); }

  selectEntity(kind, index, { additive = false } = {}) {
    const next = { kind, index };
    if (!this.selectedEntity(next)) return;
    const key = sceneSelectionKey(this.level, next);
    if (additive) {
      const existing = this.selections.findIndex((selection) => sceneSelectionKey(this.level, selection) === key);
      const selections = existing >= 0 ? this.selections.filter((_, selectionIndex) => selectionIndex !== existing) : [...this.selections, next];
      this.selections = selections.map(clone);
      this.selection = clone(selections.at(-1) ?? null);
    } else {
      this.selection = next;
      this.selections = [clone(next)];
    }
    this.engine.selected = this.selection && ['player', 'cat', 'decoration'].includes(this.selection.kind) ? clone(this.selection) : null;
    if (kind === 'event') this.selectedEventId = this.level.events[index]?.id ?? '';
  }

  openSelectionWorkspace() {
    if (!this.selection) return;
    this.workspace = workspaceForSelection(this.selection);
  }

  selectionLabel() {
    if (!this.selection) return '';
    const entity = this.selectedEntity();
    if (this.selection.kind === 'player') return 'Franz & Lola';
    if (this.selection.kind === 'cat') return `Katze ${this.selection.index + 1}`;
    if (this.selection.kind === 'event') return entity?.name?.standard ?? 'Ereignis';
    if (this.selection.kind === 'theme-element') return entity?.id === 'stage-note' ? 'Zauberberg-Note' : entity?.id === 'stage-lights' ? 'Bühnenlichter' : entity?.id ?? 'Theme-Element';
    return entity?.name || entity?.content?.standard || entity?.label || entity?.type || 'Objekt';
  }

  toggleSceneVisibility(kind, index) {
    if (kind === 'theme-element') return;
    const key = this.sceneKey(kind, index); const hidden = new Set(this.hiddenSceneNodes);
    if (hidden.has(key)) hidden.delete(key); else hidden.add(key);
    this.hiddenSceneNodes = hidden; this.sceneRevision += 1;
  }

  setSceneLocked(kind, index, locked) {
    if (kind !== 'decoration') return;
    const id = this.level.decorations[index]?.id; if (!id) return;
    this.mutate(locked ? 'Objekt sperren' : 'Objekt entsperren', (draft) => {
      const item = draft.document.decorations.find((entry) => entry.id === id); if (item) item.locked = locked;
    }, { preserveSelection: true });
  }

  moveSceneNode(kind, index, direction) {
    if (kind !== 'decoration') return;
    const item = this.level.decorations[index]; const target = Math.max(0, Math.min(this.level.decorations.length - 1, index + direction));
    if (!item || target === index) return;
    this.mutate(direction > 0 ? 'Objekt nach vorne' : 'Objekt nach hinten', (draft) => {
      const current = draft.document.decorations.findIndex((entry) => entry.id === item.id);
      const [moved] = draft.document.decorations.splice(current, 1); draft.document.decorations.splice(target, 0, moved);
    }, { preserveSelection: true });
    const nextIndex = this.level.decorations.findIndex((entry) => entry.id === item.id);
    this.selectEntity('decoration', nextIndex);
  }

  transformSelection() {
    if (this.selection?.kind !== 'decoration') return null;
    const item = this.level.decorations[this.selection.index];
    return item ? { x: item.x, y: item.y, width: item.width, height: item.height } : null;
  }

  decorationAt(point) {
    for (let index = this.level.decorations.length - 1; index >= 0; index -= 1) {
      if (rectangleContains(this.level.decorations[index], point)) return index;
    }
    return -1;
  }

  beginTransform(point, pointerId) {
    let index = this.selection?.kind === 'decoration' ? this.selection.index : -1;
    let item = index >= 0 ? this.level.decorations[index] : null;
    let handle = item ? transformHandleAt(item, point) : null;
    if (!handle && (!item || !rectangleContains(item, point))) {
      index = this.decorationAt(point); item = index >= 0 ? this.level.decorations[index] : null;
      if (item) this.selectEntity('decoration', index);
    }
    if (!item) { this.selection = null; return; }
    if (item.locked) { this.notify('Dieses Objekt ist gesperrt'); return; }
    handle ??= transformHandleAt(item, point);
    this.engine.beginTransaction(item.type === 'text' ? 'Textblock transformieren' : 'Objekt transformieren');
    this.gesture = { pointerId, start: point, last: point, mode: 'transform', action: handle ? 'scale' : 'move', handle, index, original: clone(item) };
    this.cursor = null;
  }

  pointerDown(point, pointerId, erase = false, precisePoint = point, modifiers = {}) {
    const mode = erase ? 'erase' : this.tool;
    if (mode === 'select') { this.selectAt(point, modifiers); return; }
    if (mode === 'transform') { this.beginTransform(precisePoint, pointerId); return; }
    if (mode === 'wall' || mode === 'erase') {
      this.engine.beginTransaction(mode === 'wall' ? 'Wände zeichnen' : 'Wände radieren');
      this.engine.setWall(point.x, point.y, mode === 'wall');
      this.gesture = { pointerId, start: point, last: point, mode };
    } else if (['line', 'rectangle', 'event-zone'].includes(mode)) {
      if (mode === 'event-zone' && !this.selectedEvent) { this.notify('Bitte zuerst ein Ereignis auswählen'); return; }
      this.gesture = { pointerId, start: point, last: point, mode };
    } else if (mode === 'fill') {
      this.engine.beginTransaction('Fläche füllen');
      const points = floodFillPoints(point, this.engine.wallCells, this.level.board.columns, this.level.board.rows);
      this.engine.applyWallPoints(points, !this.engine.wallCells.has(tileKey(point.x, point.y)));
      this.engine.endTransaction(); this.sync();
    } else if (mode === 'player') { this.mutate('Startpunkt setzen', (draft) => draft.setPlayer(point));
    } else if (mode === 'cat') { this.mutate('Katze setzen', (draft) => draft.addCat(point));
    } else if (mode === 'power') { this.mutate('Power-Up setzen', (draft) => draft.togglePowerUp(point));
    } else if (mode === 'object' && this.selectedAsset) {
      this.mutate('Objekt platzieren', (draft) => draft.addDecoration(point, placementFromAsset(this.selectedAsset, point, draft.document.decorations.length)));
    } else if (mode === 'event-visual' && this.selectedEvent) {
      this.mutate('Ereignissymbol setzen', (draft) => { const visual = draft.document.events.find((event) => event.id === this.selectedEventId).visual; visual.x = point.x + 0.5; visual.y = point.y + 0.5; });
    }
    this.cursor = this.cursorFor(point);
  }

  pointerMove(point, pointerId, precisePoint = point) {
    this.cursorCopy = this.tool === 'transform' ? `Position ${precisePoint.x.toFixed(2)}, ${precisePoint.y.toFixed(2)}` : `Feld ${point.x}, ${point.y}`;
    if (this.gesture?.pointerId === pointerId) {
      if (this.gesture.mode === 'transform') {
        const gesture = this.gesture; const target = this.engine.document.decorations[gesture.index];
        if (!target) return;
        if (gesture.action === 'move') {
          const rectangle = moveRectangle(gesture.original, gesture.start, precisePoint, this.level.board);
          target.x = rectangle.x; target.y = rectangle.y;
        }
        else {
          const originalFontSize = Number(gesture.original.textStyle?.fontSize) || 0.5;
          const maximumScale = target.type === 'text' ? 4 / originalFontSize : Infinity;
          const result = scaleRectangle(gesture.original, gesture.handle, precisePoint, this.level.board, { maximumScale });
          target.x = result.rectangle.x; target.y = result.rectangle.y; target.width = result.rectangle.width; target.height = result.rectangle.height;
          if (target.type === 'text') {
            target.textStyle.fontSize = Math.round(Math.max(0.15, Math.min(4, originalFontSize * result.scale)) * 1000) / 1000;
            target.textStyle.padding = Math.round(Math.max(0, Math.min(2, (Number(gesture.original.textStyle.padding) || 0) * result.scale)) * 1000) / 1000;
          }
        }
        this.engine.markChanged(); gesture.last = precisePoint;
        this.level = this.engine.toDocument(); this.revision += 1;
      } else if (['wall', 'erase'].includes(this.gesture.mode) && (point.x !== this.gesture.last.x || point.y !== this.gesture.last.y)) {
        this.engine.applyWallPoints(linePoints(this.gesture.last, point), this.gesture.mode === 'wall');
        this.gesture.last = point;
        this.level = this.engine.toDocument(); this.revision += 1;
      } else this.gesture.last = point;
    }
    this.cursor = this.cursorFor(point);
  }

  pointerUp(point, pointerId) {
    if (!this.gesture || this.gesture.pointerId !== pointerId) return;
    const gesture = this.gesture;
    if (gesture.mode === 'transform') this.engine.endTransaction();
    else if (gesture.mode === 'line') { this.engine.beginTransaction('Wandlinie'); this.engine.applyWallPoints(linePoints(gesture.start, point), true); this.engine.endTransaction(); }
    else if (gesture.mode === 'rectangle') { this.engine.beginTransaction('Wandrechteck'); this.engine.applyWallPoints(rectanglePoints(gesture.start, point), true); this.engine.endTransaction(); }
    else if (gesture.mode === 'event-zone') {
      const zone = { x: Math.min(gesture.start.x, point.x), y: Math.min(gesture.start.y, point.y), width: Math.abs(point.x - gesture.start.x) + 1, height: Math.abs(point.y - gesture.start.y) + 1 };
      this.engine.mutate('Triggerzone zeichnen', (draft) => { const event = draft.document.events.find((entry) => entry.id === this.selectedEventId); event.trigger.type = 'zone'; event.trigger.zones.push(zone); });
    } else this.engine.endTransaction();
    this.gesture = null; this.cursor = { ...point }; this.sync();
  }

  cursorFor(point) {
    if (!this.gesture || !['line', 'rectangle', 'event-zone'].includes(this.gesture.mode)) return { ...point };
    return { x: Math.min(this.gesture.start.x, point.x), y: Math.min(this.gesture.start.y, point.y), width: Math.abs(point.x - this.gesture.start.x) + 1, height: Math.abs(point.y - this.gesture.start.y) + 1, color: 'rgba(85,217,221,.34)' };
  }

  leaveCanvas() { if (!this.gesture) { this.cursor = null; this.cursorCopy = 'Feld —'; } }

  deleteSelection() {
    const selected = this.selections.length ? this.selections : this.selection ? [this.selection] : [];
    const cats = selected.filter((entry) => entry.kind === 'cat').map((entry) => entry.index).sort((a, b) => b - a);
    const decorations = selected.filter((entry) => entry.kind === 'decoration').map((entry) => entry.index).sort((a, b) => b - a);
    const events = selected.filter((entry) => entry.kind === 'event').map((entry) => entry.index).sort((a, b) => b - a);
    if (!cats.length && !decorations.length && !events.length) return;
    this.engine.selected = null;
    this.mutate(selected.length > 1 ? 'Elemente löschen' : 'Element löschen', (draft) => {
      cats.forEach((index) => draft.document.actors.cats.splice(index, 1));
      decorations.forEach((index) => draft.document.decorations.splice(index, 1));
      events.forEach((index) => draft.document.events.splice(index, 1));
    }, { preserveSelection: false });
    this.clearSelection();
  }

  updateSelected(path, value, label = 'Objekt bearbeiten') {
    const selection = clone(this.selection);
    if (!selection) return;
    this.mutate(label, (draft) => {
      let target = null;
      if (selection.kind === 'player') target = draft.document.actors.player;
      if (selection.kind === 'cat') target = draft.document.actors.cats[selection.index];
      if (selection.kind === 'decoration') target = draft.document.decorations[selection.index];
      if (selection.kind === 'theme-element') target = draft.document.theme.elements?.[selection.index];
      if (target) setAt(target, path, value);
    }, { preserveSelection: true });
    this.selection = selection;
  }

  saveAsset(asset) {
    const saved = this.library.save(asset);
    this.assets = this.library.list(); this.selectedAssetId = saved.id;
    this.notify('Objekt in der Bibliothek gespeichert');
  }

  createAsset() {
    const asset = createBlankObjectAsset(`Eigenes Objekt ${this.assets.length + 1}`);
    const saved = this.library.save(asset); this.assets = this.library.list(); this.selectedAssetId = saved.id;
    return saved;
  }

  setActorAppearance(kind, index, appearance) {
    this.mutate('Sprite-Sheet speichern', (draft) => {
      const actor = kind === 'player' ? draft.document.actors.player : draft.document.actors.cats[index];
      actor.appearance = clone(appearance); actor.renderer = 'pixel-art'; actor.animation = '';
    }, { preserveSelection: true });
    this.notify('Sprite-Sheet übernommen');
  }

  resetPlayerAppearance() {
    this.mutate('Franz und Lola zurücksetzen', (draft) => { draft.document.actors.player.appearance = createFranzLolaAppearance(); draft.document.actors.player.renderer = 'pixel-art'; }, { preserveSelection: true });
  }

  addEvent() {
    const id = slug(`ereignis-${this.level.events.length + 1}`);
    this.mutate('Ereignis anlegen', (draft) => draft.document.events.push({
      id, name: { standard: 'Neues Ereignis', dialect: 'Neis Ereignis' }, message: { standard: 'Etwas wurde entdeckt!', dialect: 'Do host wos gfundn!' }, reward: 100, scope: 'level',
      trigger: { type: 'zone', zones: [{ x: 1, y: 1, width: 1, height: 1 }], sequence: [], seconds: 10 },
      visual: { type: 'custom', x: 1.5, y: 1.5, color: '#55d9dd', accent: '#f5c451', label: '!', visibility: 'always' },
    }), { preserveSelection: true });
    this.selectedEventId = id;
  }

  updateEvent(path, value) {
    const id = this.selectedEventId;
    this.mutate('Ereignis bearbeiten', (draft) => { const event = draft.document.events.find((entry) => entry.id === id); if (event) setAt(event, path, value); }, { preserveSelection: true });
  }

  setEventVisualAsset(assetId) {
    const asset = this.assets.find((entry) => entry.id === assetId);
    if (!asset) return;
    const id = this.selectedEventId;
    this.mutate('Ereignisobjekt wählen', (draft) => {
      const event = draft.document.events.find((entry) => entry.id === id);
      if (!event) return;
      event.visual.type = 'custom'; event.visual.assetId = asset.id;
      event.visual.appearance = clone(asset.appearance); event.visual.spriteAnimation = asset.appearance?.animations?.[0]?.id ?? '';
      event.visual.animation = clone(asset.animation); event.visual.color = asset.color; event.visual.label = asset.label;
      event.visual.effects = clone(asset.effects ?? []);
    }, { preserveSelection: true });
  }

  deleteEvent() {
    const id = this.selectedEventId;
    this.mutate('Ereignis löschen', (draft) => { draft.document.events = draft.document.events.filter((event) => event.id !== id); }, { preserveSelection: true });
  }

  addCutscene() {
    const id = this.level.cutscenes.length ? `cutscene-${this.level.cutscenes.length + 1}` : 'intro';
    const player = this.level.actors.player;
    this.mutate('Cutscene anlegen', (draft) => draft.document.cutscenes.push({
      id, kind: this.level.cutscenes.length ? 'transition' : 'intro', name: { standard: 'Ankunft im Level', dialect: 'Oikemma im Level' }, duration: 4, skippable: true,
      tracks: [
        { id: 'camera', type: 'camera', target: 'camera', keyframes: [{ id: 'camera-start', time: 0, x: player.x, y: player.y, zoom: 1.35, easing: 'linear' }, { id: 'camera-end', time: 4, x: player.x, y: player.y, zoom: 1.12, easing: 'ease-in-out' }] },
        { id: 'franz-lola', type: 'actor', target: 'player', keyframes: [{ id: 'walk-in', time: 0, x: Math.max(0, player.x - 3), y: player.y, state: 'right', easing: 'linear' }, { id: 'ready', time: 4, x: player.x, y: player.y, state: 'idle', easing: 'ease-in-out' }] },
      ],
    }), { preserveSelection: true });
    this.selectedCutsceneId = id; this.selectedTrackId = 'camera'; this.selectedKeyframeId = 'camera-start';
  }

  updateCutscene(path, value) {
    const id = this.selectedCutsceneId;
    this.mutate('Cutscene bearbeiten', (draft) => { const cutscene = draft.document.cutscenes.find((entry) => entry.id === id); if (cutscene) setAt(cutscene, path, value); }, { preserveSelection: true });
  }

  deleteCutscene() {
    const id = this.selectedCutsceneId;
    this.mutate('Cutscene löschen', (draft) => { draft.document.cutscenes = draft.document.cutscenes.filter((entry) => entry.id !== id); }, { preserveSelection: true });
    this.selectedCutsceneId = this.level.cutscenes[0]?.id ?? ''; this.selectedTrackId = ''; this.selectedKeyframeId = '';
  }

  addTrack(type = 'actor') {
    const cutsceneId = this.selectedCutsceneId;
    const index = (this.selectedCutscene?.tracks.length ?? 0) + 1;
    const target = type === 'object' ? this.level.decorations[0]?.id ?? '' : type === 'camera' ? 'camera' : type === 'dialogue' ? 'dialogue' : 'player';
    const keyframe = type === 'dialogue'
      ? { id: `text-${index}`, time: 0, duration: 2.5, speaker: 'Franz', text: { standard: 'Servus Passau!', dialect: 'Hawedere Passau!' }, easing: 'step' }
      : { id: `start-${index}`, time: 0, x: this.level.actors.player.x, y: this.level.actors.player.y, zoom: 1.12, state: 'idle', visible: true, easing: 'linear' };
    const trackId = `${type}-${index}`;
    this.mutate('Cutscene-Track anlegen', (draft) => draft.document.cutscenes.find((entry) => entry.id === cutsceneId).tracks.push({ id: trackId, type, target, keyframes: [keyframe] }), { preserveSelection: true });
    this.selectedTrackId = trackId; this.selectedKeyframeId = keyframe.id;
  }

  updateTrack(path, value) {
    const cutsceneId = this.selectedCutsceneId; const trackId = this.selectedTrackId;
    this.mutate('Track bearbeiten', (draft) => { const track = draft.document.cutscenes.find((entry) => entry.id === cutsceneId)?.tracks.find((entry) => entry.id === trackId); if (track) setAt(track, path, value); }, { preserveSelection: true });
  }

  deleteTrack() {
    const cutsceneId = this.selectedCutsceneId; const trackId = this.selectedTrackId;
    this.mutate('Track löschen', (draft) => { const cutscene = draft.document.cutscenes.find((entry) => entry.id === cutsceneId); cutscene.tracks = cutscene.tracks.filter((entry) => entry.id !== trackId); }, { preserveSelection: true });
    this.selectedTrackId = this.selectedCutscene?.tracks[0]?.id ?? ''; this.selectedKeyframeId = this.selectedTrack?.keyframes[0]?.id ?? '';
  }

  addKeyframe() {
    const track = this.selectedTrack; if (!track || !this.selectedCutscene) return;
    const previous = track.keyframes.at(-1); const time = Math.min(this.selectedCutscene.duration, previous.time + 1);
    const frame = { ...clone(previous), id: `keyframe-${Date.now()}`, time };
    this.updateTrack(['keyframes'], [...track.keyframes, frame].sort((a, b) => a.time - b.time));
    this.selectedKeyframeId = frame.id;
  }

  updateKeyframe(path, value) {
    const frames = this.selectedTrack?.keyframes.map((frame) => frame.id === this.selectedKeyframeId ? { ...frame, [path]: value } : frame) ?? [];
    this.updateTrack(['keyframes'], frames.sort((a, b) => a.time - b.time));
  }

  deleteKeyframe() {
    if (!this.selectedTrack || this.selectedTrack.keyframes.length <= 1) return;
    const frames = this.selectedTrack.keyframes.filter((frame) => frame.id !== this.selectedKeyframeId);
    this.updateTrack(['keyframes'], frames); this.selectedKeyframeId = frames[0]?.id ?? '';
  }

  importLevel(source) {
    try { this.load(JSON.parse(source), 'Level importiert'); } catch (error) { this.notify(`Import fehlgeschlagen: ${error.message}`); }
  }

  download(value, filename) {
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  exportLevel() {
    if (!this.validation.ok) { this.workspace = 'level'; this.notify('Export blockiert: Level enthält Fehler'); return; }
    this.download(this.level, `${this.level.id}.level.json`);
  }

  templates() { return passauCatalog; }
  draftsList() { return this.drafts.list(); }

  publishCandidates() {
    const entries = this.drafts.list().map((entry) => ({ ...entry, level: this.drafts.load(entry.id), current: entry.id === this.level.id }));
    const current = { id: this.level.id, name: this.level.name.standard, savedAt: '', level: clone(this.level), current: true };
    const candidates = [current, ...entries.filter((entry) => entry.id !== current.id)];
    return candidates.map((entry) => ({ ...entry, validation: validateLevelDocument(entry.level) }));
  }

  deleteDraft(id) {
    if (id === this.level.id) clearTimeout(this.saveTimer);
    if (!this.drafts.remove(id)) return false;
    this.revision += 1;
    this.notify(id === this.level.id ? 'Entwurf gelöscht · das geöffnete Level bleibt erhalten' : 'Entwurf gelöscht');
    return true;
  }
}
