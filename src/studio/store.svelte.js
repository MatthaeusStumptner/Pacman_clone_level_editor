import { createLevelDocument, tileKey, validateLevelDocument } from '@franz-lola/pixel-renderer';
import { catalogLevel, passauCatalog } from '../catalog.js';
import { DraftRepository } from '../draft-repository.js';
import { createStarterLevel, EditorState } from '../editor-state.js';
import { floodFillPoints, linePoints, previewGuttis, rectanglePoints } from '../editor-tools.js';
import { createFranzLolaAppearance } from '../character-template.js';
import { ObjectLibrary, createBlankObjectAsset, placementFromAsset } from '../object-library.js';

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
    if (!preserveSelection || this.engine.selected) this.selection = clone(this.engine.selected);
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
    if (tool === 'object') this.workspace = 'objects';
    if (tool.startsWith('event')) this.workspace = 'events';
  }

  specialElementBounds(id) {
    const middle = this.level.board.columns / 2;
    if (id === 'stage-note') return { x: middle - 1, y: 7, width: 2, height: 2 };
    if (id === 'stage-lights') return { x: middle - 5, y: 5, width: 10, height: 7 };
    return null;
  }

  selectAt(point) {
    const selected = this.engine.selectAt(point);
    if (selected) {
      this.selection = clone(selected);
      this.workspace = selected.kind === 'player' || selected.kind === 'cat' ? 'characters' : 'objects';
      return selected;
    }
    const eventIndex = this.level.events.findIndex((event) => Math.abs(event.visual.x - (point.x + 0.5)) <= 0.75 && Math.abs(event.visual.y - (point.y + 0.5)) <= 0.75);
    if (eventIndex >= 0) {
      this.selection = { kind: 'event', index: eventIndex };
      this.selectedEventId = this.level.events[eventIndex].id;
      this.workspace = 'events';
      return this.selection;
    }
    const themeIndex = (this.level.theme.elements ?? []).findIndex((element) => {
      const bounds = this.specialElementBounds(element.id);
      return bounds && point.x >= bounds.x && point.x < bounds.x + bounds.width && point.y >= bounds.y && point.y < bounds.y + bounds.height;
    });
    this.selection = themeIndex >= 0 ? { kind: 'theme-element', index: themeIndex } : null;
    if (themeIndex >= 0) this.workspace = 'objects';
    return this.selection;
  }

  selectedEntity() {
    if (!this.selection) return null;
    if (this.selection.kind === 'player') return this.level.actors.player;
    if (this.selection.kind === 'cat') return this.level.actors.cats[this.selection.index] ?? null;
    if (this.selection.kind === 'decoration') return this.level.decorations[this.selection.index] ?? null;
    if (this.selection.kind === 'theme-element') return this.level.theme.elements?.[this.selection.index] ?? null;
    if (this.selection.kind === 'event') return this.level.events[this.selection.index] ?? null;
    return null;
  }

  selectEntity(kind, index) {
    this.selection = { kind, index };
    this.engine.selected = ['player', 'cat', 'decoration'].includes(kind) ? { kind, index } : null;
    if (kind === 'event') this.selectedEventId = this.level.events[index]?.id ?? '';
  }

  pointerDown(point, pointerId, erase = false) {
    const mode = erase ? 'erase' : this.tool;
    if (mode === 'select') { this.selectAt(point); return; }
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

  pointerMove(point, pointerId) {
    this.cursorCopy = `Feld ${point.x}, ${point.y}`;
    if (this.gesture?.pointerId === pointerId) {
      if (['wall', 'erase'].includes(this.gesture.mode) && (point.x !== this.gesture.last.x || point.y !== this.gesture.last.y)) {
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
    if (gesture.mode === 'line') { this.engine.beginTransaction('Wandlinie'); this.engine.applyWallPoints(linePoints(gesture.start, point), true); this.engine.endTransaction(); }
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
    if (!this.selection) return;
    if (['cat', 'decoration'].includes(this.selection.kind)) {
      this.engine.selected = clone(this.selection);
      this.engine.beginTransaction('Element löschen'); this.engine.deleteSelected(); this.engine.endTransaction();
      this.selection = null; this.sync({ preserveSelection: false });
    }
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
}
