import { migrateLegacyLevel } from './level-migrations.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

export class DraftRepository {
  constructor(storage = globalThis.localStorage, key = 'franz-lola-level-editor-workspace-v2') {
    this.storage = storage;
    this.key = key;
  }

  readWorkspace() {
    try {
      const parsed = JSON.parse(this.storage.getItem(this.key));
      return parsed && typeof parsed === 'object' ? parsed : { activeId: null, drafts: {} };
    } catch {
      return { activeId: null, drafts: {} };
    }
  }

  save(level, { activate = true } = {}) {
    const workspace = this.readWorkspace();
    if (activate) workspace.activeId = level.id;
    workspace.drafts[level.id] = { savedAt: new Date().toISOString(), level: clone(level) };
    this.storage.setItem(this.key, JSON.stringify(workspace));
    return workspace.drafts[level.id];
  }

  load(id) {
    const entry = this.readWorkspace().drafts[id];
    return entry?.level ? migrateLegacyLevel(entry.level) : null;
  }

  active() {
    const workspace = this.readWorkspace();
    return workspace.activeId ? this.load(workspace.activeId) : null;
  }

  list() {
    const workspace = this.readWorkspace();
    return Object.entries(workspace.drafts).map(([id, entry]) => ({ id, savedAt: entry.savedAt, name: entry.level?.name?.standard ?? id }));
  }

  remove(id) {
    const workspace = this.readWorkspace();
    if (!workspace.drafts[id]) return false;
    delete workspace.drafts[id];
    if (workspace.activeId === id) workspace.activeId = null;
    this.storage.setItem(this.key, JSON.stringify(workspace));
    return true;
  }
}
