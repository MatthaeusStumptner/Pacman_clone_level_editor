<script>
  import LevelCanvas from './LevelCanvas.svelte';
  import MobileFocusTabs from './MobileFocusTabs.svelte';
  import SceneTree from './SceneTree.svelte';
  import SelectionSummary from './SelectionSummary.svelte';

  let { studio } = $props();
  let sidebarMode = $state('tools');
  let mobilePanel = $state('canvas');
  const tools = [
    ['select', '↖', 'Auswahl', 'V'], ['transform', '↔', 'Bewegen', 'M'], ['wall', '▦', 'Stift', 'B'], ['line', '╱', 'Linie', 'L'], ['rectangle', '▰', 'Rechteck', 'R'], ['fill', '◩', 'Füllen', 'F'], ['erase', '◇', 'Radierer', 'E'],
    ['player', '●', 'Start', 'P'], ['cat', '◆', 'Katze', 'K'], ['power', '✦', 'Power', 'G'],
  ];
  const themes = [
    ['dog-park', 'Nachbarschaft'], ['brahmahof-home', 'Franz & Lolas Haus'], ['bschuett', 'Bschüttpark'], ['tabakfabrik', 'Tabakfabrik'], ['zauberberg', 'Zauberberg'],
  ];

  function number(event) { return Number(event.currentTarget.value); }
  function tunnels(event) { return event.currentTarget.value.split(',').map((value) => Number.parseInt(value.trim(), 10)).filter(Number.isFinite); }
</script>

<section class="workspace level-workspace" aria-labelledby="level-workspace-title">
  <header class="workspace-header">
    <div><span class="eyebrow">LEVELBAU</span><h2 id="level-workspace-title">Wege, Regeln und Ort</h2><p>Hier entsteht nur das Spielfeld. Figuren, Objekte und Ereignisse haben eigene Arbeitsbereiche.</p></div>
    <div class="history-actions"><button onclick={() => studio.undo()} disabled={!studio.canUndo} aria-label="Rückgängig">↶</button><button onclick={() => studio.redo()} disabled={!studio.canRedo} aria-label="Wiederholen">↷</button></div>
  </header>

  <div class="workspace-grid canvas-workspace-grid focus-layout">
    <aside class:mobile-active={mobilePanel === 'scene'} class="level-sidebar" data-focus-panel="scene" aria-label="Werkzeuge und Szenenbaum">
      <div class="sidebar-mode-tabs"><button class:active={sidebarMode === 'tools'} onclick={() => sidebarMode = 'tools'}>▦ Werkzeuge</button><button class:active={sidebarMode === 'scene'} onclick={() => sidebarMode = 'scene'}>☷ Szene</button></div>
      {#if sidebarMode === 'tools'}
        <div class="tool-list">
          {#each tools as [id, icon, label, key]}
            <button class:active={studio.tool === id} data-tool={id} onclick={() => { studio.setTool(id); mobilePanel = 'canvas'; }} title={`${label} (${key})`}><span>{icon}</span><b>{label}</b><kbd>{key}</kbd></button>
          {/each}
          <hr />
          <button data-tool="object" onclick={() => studio.workspace = 'objects'}><span>♣</span><b>Objektwerkstatt</b><kbd>O</kbd></button>
          <button data-tool="event-visual" onclick={() => studio.workspace = 'events'}><span>!</span><b>Ereignisregie</b><kbd>I</kbd></button>
        </div>
      {:else}
        <SceneTree {studio} onselect={() => mobilePanel = 'inspector'} />
      {/if}
    </aside>

    <div class="canvas-column mobile-active" data-focus-panel="canvas">
      <div class="canvas-toolbar">
        <label>Vorschau<select bind:value={studio.difficulty}><option value="easy">Spaziergang · 70</option><option value="normal">Gassirunde · 110</option><option value="hard">Abenteuer · 160</option></select></label>
        <label class="switch"><input type="checkbox" bind:checked={studio.showGrid} /><span>Raster</span></label>
        <label class="switch"><input type="checkbox" bind:checked={studio.showGuttis} /><span>Guttis</span></label>
        <label class="switch"><input type="checkbox" bind:checked={studio.showEvents} /><span>Ereignisse</span></label>
      </div>
      <LevelCanvas {studio} />
      <footer class="canvas-status"><span>{studio.cursorCopy}</span><span>{studio.tool === 'select' ? studio.selection ? 'Ausgewählt · Doppelklick öffnet den Fachbereich · Alt wählt dahinter' : 'Element anklicken zum Auswählen' : studio.tool === 'transform' ? 'Objekt ziehen · Eckgriff ziehen zum Skalieren' : 'Ziehen oder klicken, um zu bearbeiten'}</span><strong>{studio.saveStatus}</strong></footer>
    </div>

    <aside class:mobile-active={mobilePanel === 'inspector'} class="property-panel" data-focus-panel="inspector">
      <SelectionSummary {studio} />
      <div class="property-section"><span class="section-number">01</span><h3>Identität</h3></div>
      <label>ID<input id="level-id" value={studio.level.id} onchange={(event) => studio.update(['id'], event.currentTarget.value)} /></label>
      <label>Name<input id="level-name" value={studio.level.name.standard} onchange={(event) => studio.update(['name', 'standard'], event.currentTarget.value)} /></label>
      <label>Name im Dialekt<input value={studio.level.name.dialect} onchange={(event) => studio.update(['name', 'dialect'], event.currentTarget.value)} /></label>
      <div class="field-row"><label>Symbol<input value={studio.level.icon} maxlength="3" onchange={(event) => studio.update(['icon'], event.currentTarget.value)} /></label><label>Gebiet<input value={studio.level.location.area} onchange={(event) => studio.update(['location', 'area'], event.currentTarget.value)} /></label></div>
      <label>Mission<input value={studio.level.mission.standard} onchange={(event) => studio.update(['mission', 'standard'], event.currentTarget.value)} /></label>
      <label>Beschreibung<textarea rows="3" value={studio.level.description.standard} onchange={(event) => studio.update(['description', 'standard'], event.currentTarget.value)}></textarea></label>

      <div class="property-section"><span class="section-number">02</span><h3>Raster & Theme</h3></div>
      <div class="field-row"><label>Breite<input type="number" min="9" max="64" value={studio.level.board.columns} onchange={(event) => studio.update(['board', 'columns'], number(event))} /></label><label>Höhe<input type="number" min="9" max="64" value={studio.level.board.rows} onchange={(event) => studio.update(['board', 'rows'], number(event))} /></label></div>
      <label>Tunnelzeilen<input value={studio.level.board.tunnelRows.join(', ')} onchange={(event) => studio.update(['board', 'tunnelRows'], tunnels(event))} /></label>
      <label>Umgebung<select value={studio.level.theme.landmark} onchange={(event) => studio.update(['theme', 'landmark'], event.currentTarget.value)}>{#each themes as [id, name]}<option value={id}>{name}</option>{/each}</select></label>
      <div class="color-grid">
        <label>Straße<input type="color" value={studio.level.theme.palette.ground[0]} onchange={(event) => studio.update(['theme', 'palette', 'ground', 0], event.currentTarget.value)} /></label>
        <label>Mauer<input type="color" value={studio.level.theme.palette.walls[0]} onchange={(event) => studio.update(['theme', 'palette', 'walls', 0], event.currentTarget.value)} /></label>
        <label>Bordstein<input type="color" value={studio.level.theme.palette.curb} onchange={(event) => studio.update(['theme', 'palette', 'curb'], event.currentTarget.value)} /></label>
        <label>Wasser<input type="color" value={studio.level.theme.palette.water} onchange={(event) => studio.update(['theme', 'palette', 'water'], event.currentTarget.value)} /></label>
      </div>

      <div class="property-section"><span class="section-number">03</span><h3>Prüfung</h3></div>
      <div class:invalid={!studio.validation.ok} class="validation-card"><strong>{studio.validation.ok ? '✓ Level ist spielbar' : `⚠ ${studio.validation.errors.length} Fehler`}</strong><span>{studio.validation.warnings.length} Hinweise · {studio.pellets.size} Guttis</span></div>
      {#if studio.validation.errors.length}<ul class="issue-list">{#each studio.validation.errors as error}<li>{error}</li>{/each}</ul>{/if}
      {#if studio.validation.warnings.length}<details><summary>Hinweise ansehen</summary><ul class="issue-list warning">{#each studio.validation.warnings as warning}<li>{warning}</li>{/each}</ul></details>{/if}
    </aside>
    {#if mobilePanel !== 'canvas'}<button class="mobile-panel-scrim" aria-label="Mobile Seitenleiste schließen" onclick={() => mobilePanel = 'canvas'}></button>{/if}
    <MobileFocusTabs value={mobilePanel} options={[["scene", "☷", "Szene"], ["canvas", "▦", "Canvas"], ["inspector", "☰", "Details"]]} onchange={(value) => mobilePanel = value} />
  </div>
</section>
