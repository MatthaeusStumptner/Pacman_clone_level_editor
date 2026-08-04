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

  const studio = new StudioState();
  let projectOpen = $state(false);
  let importInput;
  let search = $state('');
  let templates = $derived.by(() => studio.templates().filter((level) => `${level.name.standard} ${level.location.area} ${level.id}`.toLowerCase().includes(search.trim().toLowerCase())));
  let drafts = $derived.by(() => { studio.revision; return studio.draftsList(); });

  const workspaces = [
    ['level', '▦', 'Level', 'Wege & Regeln'],
    ['objects', '◆', 'Objekte', 'Assets & Kulisse'],
    ['characters', 'FL', 'Figuren', 'Sprites & States'],
    ['cutscenes', '▶', 'Cutscenes', 'Kamera & Timeline'],
    ['events', '!', 'Ereignisse', 'Trigger & Texte'],
    ['playtest', '●', 'Testspiel', 'Echte Simulation'],
    ['publish', '↑', 'Live', 'Veröffentlichen'],
  ];

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

  function keyboard(event) {
    const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName) || event.target?.isContentEditable;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? studio.redo() : studio.undo(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); studio.redo(); return; }
    if (editing || event.ctrlKey || event.metaKey || event.altKey) return;
    const tools = { v: 'select', m: 'transform', b: 'wall', l: 'line', r: 'rectangle', f: 'fill', e: 'erase', p: 'player', k: 'cat', g: 'power', o: 'object', i: 'event-visual' };
    const tool = tools[event.key.toLowerCase()];
    if (tool) { event.preventDefault(); studio.setTool(tool); }
    if (event.key === 'Delete' || event.key === 'Backspace') studio.deleteSelection();
  }

  onMount(() => {
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  });
</script>

<svelte:head><meta name="description" content="Level, Objekte, Figuren und Cutscenes für Franz & Lola ohne Programmierkenntnisse gestalten." /></svelte:head>

<div class="studio-shell" class:project-open={projectOpen}>
  <header class="studio-topbar">
    <button class="brand" onclick={() => projectOpen = !projectOpen} aria-expanded={projectOpen} aria-controls="project-drawer"><span class="brand-mark">FL</span><span><b>Franz & Lola</b><small>GAME STUDIO</small></span><i>⌄</i></button>
    <div class="document-identity" data-level-id={studio.level.id}><span>{studio.level.icon}</span><div><strong>{studio.level.name.standard}</strong><small>{studio.level.location.area} · {studio.level.board.columns}×{studio.level.board.rows}</small></div></div>
    <div class="topbar-status"><span class:invalid={!studio.validation.ok}>{studio.validation.ok ? '✓ SPIELBAR' : `⚠ ${studio.validation.errors.length} FEHLER`}</span><span>{studio.saveStatus}</span><button onclick={() => studio.undo()} disabled={!studio.canUndo} title="Rückgängig (Strg+Z)">↶</button><button onclick={() => studio.redo()} disabled={!studio.canRedo} title="Wiederholen (Strg+Y)">↷</button></div>
    <button class="mobile-project-button" onclick={() => projectOpen = !projectOpen}>☰ Projekt</button>
  </header>

  <aside class="project-drawer" id="project-drawer" aria-label="Projekt und Vorlagen">
    <header><span class="eyebrow">PROJEKT</span><button onclick={() => projectOpen = false} aria-label="Projektleiste schließen">×</button></header>
    <div class="project-actions"><button class="primary" onclick={() => { studio.newLevel(); projectOpen = false; }}>＋ Neues Level</button><button onclick={() => importInput.click()}>↓ JSON importieren</button><input class="visually-hidden" bind:this={importInput} type="file" accept="application/json,.json" aria-label="Leveldatei auswählen" onchange={importFile} /></div>
    <label class="search-field"><span>⌕</span><input bind:value={search} placeholder="Passauer Orte suchen" /></label>
    <div class="project-section template-section"><div class="panel-title"><strong>Passau-Vorlagen</strong><span>{templates.length}</span></div><div class="template-list">{#each templates as level}<button class:active={studio.level.id === level.id} data-template-id={level.id} onclick={() => loadTemplate(level.id)}><span>{level.icon}</span><div><strong>{level.name.standard}</strong><small>{level.location.area} · {level.board.columns}×{level.board.rows}</small></div></button>{/each}</div></div>
    <div class="project-section draft-section"><div class="panel-title"><strong>Meine Entwürfe</strong><span>{drafts.length}</span></div>{#if drafts.length}<div class="draft-list">{#each drafts as draft}<button class:active={studio.level.id === draft.id} onclick={() => loadDraft(draft.id)}><span>◫</span><div><strong>{draft.name}</strong><small>{new Date(draft.savedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</small></div></button>{/each}</div>{:else}<p class="hint">Änderungen erscheinen nach dem ersten Speichern automatisch hier.</p>{/if}</div>
    <footer><button onclick={() => studio.exportLevel()}>↑ Leveldatei exportieren</button><small>Alles wird zusätzlich lokal in diesem Browser gespeichert.</small></footer>
  </aside>
  {#if projectOpen}<button class="drawer-scrim" aria-label="Projektleiste schließen" onclick={() => projectOpen = false}></button>{/if}

  <nav class="discipline-nav" aria-label="Arbeitsbereiche">
    {#each workspaces as [id, icon, label, description]}
      <button class:active={studio.workspace === id} data-workspace={id} onclick={() => switchWorkspace(id)}><span>{icon}</span><div><strong>{label}</strong><small>{description}</small></div>{#if id === 'events' && studio.level.events.length}<em>{studio.level.events.length}</em>{/if}{#if id === 'cutscenes' && studio.level.cutscenes.length}<em>{studio.level.cutscenes.length}</em>{/if}</button>
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
