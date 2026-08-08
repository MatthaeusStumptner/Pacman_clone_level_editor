<script>
  import { onMount } from 'svelte';
  import CharacterWorkspace from './components/CharacterWorkspace.svelte';
  import CutsceneWorkspace from './components/CutsceneWorkspace.svelte';
  import EventWorkspace from './components/EventWorkspace.svelte';
  import LevelWorkspace from './components/LevelWorkspace.svelte';
  import ObjectWorkspace from './components/ObjectWorkspace.svelte';
  import PlaytestWorkspace from './components/PlaytestWorkspace.svelte';
  import PublishWorkspace from './components/PublishWorkspace.svelte';
  import { StudioState } from './studio/store.svelte.js';
  import { StudioRouter } from './studio-router.js';
  import { applyStudioRoute, routeFromStudio } from './studio-navigation.js';
  import { getPublisherClient } from './publisher-client.js';

  const studio = new StudioState();
  const publisher = getPublisherClient();
  let projectOpen = $state(false);
  let importInput;
  let search = $state('');
  let templates = $derived.by(() => studio.templates().filter((level) => `${level.name.standard} ${level.location.area} ${level.id}`.toLowerCase().includes(search.trim().toLowerCase())));
  let drafts = $derived.by(() => { studio.revision; return studio.draftsList(); });
  let sharedDrafts = $derived.by(() => { studio.revision; return studio.cloudDraftsList(); });

  const workspaces = [
    ['level', '▦', 'Level', 'Wege & Regeln'],
    ['objects', '◆', 'Objekte', 'Assets & Kulisse'],
    ['characters', 'FL', 'Figuren', 'Sprites & States'],
    ['cutscenes', '▶', 'Cutscenes', 'Kamera & Timeline'],
    ['events', '!', 'Ereignisse', 'Trigger & Texte'],
    ['playtest', '●', 'Testspiel', 'Echte Simulation'],
    ['publish', '↑', 'Live', 'Veröffentlichen'],
  ];

  let activeWorkspace = $derived(workspaces.find(([id]) => id === studio.workspace) ?? workspaces[0]);
  let routerReady = $state(false);
  let applyingRoute = false;
  let router;

  $effect(() => {
    const route = routeFromStudio(studio);
    if (routerReady && !applyingRoute) router.sync(route);
  });

  async function importFile(event) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    studio.importLevel(await file.text());
    event.currentTarget.value = '';
    projectOpen = false;
  }

  function switchWorkspace(id) { studio.workspace = id; projectOpen = false; }
  function loadTemplate(id) { studio.loadTemplate(id); projectOpen = false; }
  function loadDraft(id) { studio.loadDraft(id); projectOpen = false; }
  function deleteDraft(draft) {
    if (window.confirm(`Entwurf „${draft.name}“ wirklich löschen?`)) studio.deleteDraft(draft.id);
  }
  async function loadSharedDraft(id) {
    try { await studio.loadCloudDraft(id); projectOpen = false; }
    catch (error) { studio.notify(`Cloud-Entwurf konnte nicht geladen werden: ${error.message}`); }
  }
  async function deleteSharedDraft(draft) {
    if (!window.confirm(`Gemeinsamen Entwurf „${draft.name}“ wirklich für alle Geräte löschen?`)) return;
    try { await studio.deleteCloudDraft(draft.id); }
    catch (error) { studio.notify(`Löschen fehlgeschlagen: ${error.message}`); }
  }

  function keyboard(event) {
    const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName) || event.target?.isContentEditable;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? studio.redo() : studio.undo(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); studio.redo(); return; }
    if (editing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') { event.preventDefault(); studio.clearSelection(); return; }
    const tools = { v: 'select', m: 'transform', b: 'wall', l: 'line', r: 'rectangle', f: 'fill', e: 'erase', p: 'player', k: 'cat', g: 'power', o: 'object', i: 'event-visual' };
    const tool = tools[event.key.toLowerCase()];
    if (tool) {
      event.preventDefault(); studio.setTool(tool);
      if (tool === 'object') studio.workspace = 'objects';
      if (tool === 'event-visual') studio.workspace = 'events';
    }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); studio.deleteSelection(); }
  }

  onMount(() => {
    publisher.consumeSessionFromLocation();
    if (publisher.authenticated) {
      publisher.me().then((user) => studio.enableCloudDrafts(publisher, user)).catch((error) => {
        studio.cloudError = error.message;
        studio.cloudStatus = 'offline';
      });
    }
    router = new StudioRouter();
    const stopRouter = router.start(routeFromStudio(studio), (route) => {
      applyingRoute = true;
      try {
        applyStudioRoute(studio, route);
      } finally {
        applyingRoute = false;
      }
    });
    routerReady = true;
    window.addEventListener('keydown', keyboard);
    return () => { stopRouter(); window.removeEventListener('keydown', keyboard); };
  });
</script>

<svelte:head>
  <title>{studio.level.name.standard} · {activeWorkspace[2]} · Franz & Lola Studio</title>
  <meta name="description" content="Level, Objekte, Figuren und Cutscenes für Franz & Lola ohne Programmierkenntnisse gestalten." />
</svelte:head>

<div class="studio-shell" class:project-open={projectOpen}>
  <header class="studio-topbar">
    <button class="brand" onclick={() => projectOpen = !projectOpen} aria-expanded={projectOpen} aria-controls="project-drawer"><span class="brand-mark">FL</span><span><b>Franz & Lola</b><small>GAME STUDIO</small></span><i>⌄</i></button>
    <div class="document-identity" data-level-id={studio.level.id}><span>{studio.level.icon}</span><div><strong>{studio.level.name.standard}</strong><small>{studio.level.location.area} · {activeWorkspace[2]} · {studio.level.board.columns}×{studio.level.board.rows}</small></div></div>
    <div class="topbar-status"><span class:invalid={!studio.validation.ok}>{studio.validation.ok ? '✓ SPIELBAR' : `⚠ ${studio.validation.errors.length} FEHLER`}</span>{#if studio.cloudStatus === 'conflict'}<button class="cloud-status cloud-warning conflict-link" title={studio.cloudError} onclick={() => studio.workspace = 'publish'}>⚠ CLOUD-KONFLIKT · LÖSEN</button>{:else}<span class:cloud-warning={studio.cloudStatus === 'offline'} class="cloud-status">{studio.cloudStatus === 'shared' ? '☁ GEMEINSAM' : studio.cloudStatus === 'syncing' ? '☁ SYNCHRONISIERT …' : studio.cloudStatus === 'offline' ? '○ NUR LOKAL' : studio.saveStatus}</span>{/if}<button onclick={() => studio.undo()} disabled={!studio.canUndo} title="Rückgängig (Strg+Z)">↶</button><button onclick={() => studio.redo()} disabled={!studio.canRedo} title="Wiederholen (Strg+Y)">↷</button></div>
    <button class="mobile-project-button" onclick={() => projectOpen = !projectOpen}>☰ Projekt</button>
  </header>

  <aside class="project-drawer" id="project-drawer" aria-label="Projekt und Vorlagen" aria-hidden={!projectOpen} inert={!projectOpen}>
    <header><span class="eyebrow">PROJEKT</span><button onclick={() => projectOpen = false} aria-label="Projektleiste schließen">×</button></header>
    <div class="project-actions"><button class="primary" onclick={() => { studio.newLevel(); projectOpen = false; }}>＋ Neues Level</button><button onclick={() => importInput.click()}>↓ JSON importieren</button><input class="visually-hidden" bind:this={importInput} type="file" accept="application/json,.json" aria-label="Leveldatei auswählen" onchange={importFile} /></div>
    <label class="search-field"><span>⌕</span><input bind:value={search} placeholder="Passauer Orte suchen" /></label>
    <div class="project-section template-section"><div class="panel-title"><strong>Passau-Vorlagen</strong><span>{templates.length}</span></div><div class="template-list">{#each templates as level}<button class:active={studio.level.id === level.id} data-template-id={level.id} onclick={() => loadTemplate(level.id)}><span>{level.icon}</span><div><strong>{level.name.standard}</strong><small>{level.location.area} · {level.board.columns}×{level.board.rows}</small></div></button>{/each}</div></div>
    {#if studio.cloudUser}<div class="project-section shared-draft-section"><div class="panel-title"><strong>☁ Gemeinsame Entwürfe</strong><span>{sharedDrafts.length}</span></div>{#if sharedDrafts.length}<div class="draft-list">{#each sharedDrafts as draft}<div class:active={studio.level.id === draft.id} class="draft-entry"><button class="draft-open" onclick={() => loadSharedDraft(draft.id)}><span>{draft.icon}</span><div><strong>{draft.name}</strong><small>Revision {draft.revision} · {draft.updatedBy}</small></div></button><button class="draft-delete" aria-label={`Gemeinsamen Entwurf ${draft.name} löschen`} title="Für alle Geräte löschen" onclick={() => deleteSharedDraft(draft)}>×</button></div>{/each}</div>{:else}<p class="hint">Noch keine gemeinsamen Entwürfe vorhanden.</p>{/if}</div>{/if}
    <div class="project-section draft-section"><div class="panel-title"><strong>Auf diesem Gerät</strong><span>{drafts.length}</span></div>{#if drafts.length}<div class="draft-list">{#each drafts as draft}<div class:active={studio.level.id === draft.id} class="draft-entry"><button class="draft-open" onclick={() => loadDraft(draft.id)}><span>◫</span><div><strong>{draft.name}</strong><small>{new Date(draft.savedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</small></div></button><button class="draft-delete" aria-label={`Entwurf ${draft.name} löschen`} title="Entwurf löschen" onclick={() => deleteDraft(draft)}>×</button></div>{/each}</div>{:else}<p class="hint">Änderungen erscheinen nach dem ersten Speichern automatisch hier.</p>{/if}</div>
    <footer><button onclick={() => studio.exportLevel()}>↑ Leveldatei exportieren</button><small>{studio.cloudUser ? `Angemeldet als ${studio.cloudUser.login} · Cloud mit lokalem Sicherheitsnetz.` : 'Lokales Sicherheitsnetz aktiv. GitHub-Verbindung unter „Live“ einschalten.'}</small></footer>
  </aside>
  {#if projectOpen}<button class="drawer-scrim" aria-label="Projektleiste schließen" onclick={() => projectOpen = false}></button>{/if}

  <nav class="discipline-nav" aria-label="Arbeitsbereiche">
    {#each workspaces as [id, icon, label, description]}
      <button class:active={studio.workspace === id} data-workspace={id} aria-current={studio.workspace === id ? 'page' : undefined} onclick={() => switchWorkspace(id)}><span>{icon}</span><div><strong>{label}</strong><small>{description}</small></div>{#if id === 'events' && studio.level.events.length}<em>{studio.level.events.length}</em>{/if}{#if id === 'cutscenes' && studio.level.cutscenes.length}<em>{studio.level.cutscenes.length}</em>{/if}</button>
    {/each}
  </nav>

  <main class="studio-main">
    {#if studio.workspace === 'level'}<LevelWorkspace {studio} />
    {:else if studio.workspace === 'objects'}<ObjectWorkspace {studio} />
    {:else if studio.workspace === 'characters'}<CharacterWorkspace {studio} />
    {:else if studio.workspace === 'cutscenes'}<CutsceneWorkspace {studio} />
    {:else if studio.workspace === 'events'}<EventWorkspace {studio} />
    {:else if studio.workspace === 'playtest'}<PlaytestWorkspace {studio} />
    {:else if studio.workspace === 'publish'}<PublishWorkspace {studio} />{/if}
  </main>

  {#if studio.toast}<div class="toast" role="status">{studio.toast}</div>{/if}
</div>
