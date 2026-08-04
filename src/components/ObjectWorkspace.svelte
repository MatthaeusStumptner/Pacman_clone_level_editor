<script>
  import LevelCanvas from './LevelCanvas.svelte';
  import MotionTimelineEditor from './MotionTimelineEditor.svelte';
  import ObjectThumbnail from './ObjectThumbnail.svelte';
  import SpriteSheetEditor from './SpriteSheetEditor.svelte';

  let { studio } = $props();
  let editingAsset = $state(false);
  let editingPlacedSprite = $state(false);
  let editingMotion = $state(false);
  let motionSource = $state('selection');
  let selected = $derived.by(() => studio.selectedEntity());
  let asset = $derived(studio.selectedAsset);
  let motionTarget = $derived(motionSource === 'asset' ? asset : selected);
  let motionPreview = $derived(studio.selection?.kind === 'theme-element'
    ? studio.assets.find((entry) => entry.id === (selected?.id === 'stage-note' ? 'zauberberg-note' : 'stage-lights')) ?? selected
    : motionTarget);
  const animationTypes = [['none', 'Keine'], ['bob', 'Schweben'], ['pulse', 'Pulsieren'], ['blink', 'Blinken'], ['spin', 'Drehen'], ['keyframes', 'Eigene Keyframes']];

  function selectAsset(id) { studio.selectedAssetId = id; studio.setTool('object'); editingAsset = false; editingMotion = false; }
  function createAsset() { studio.createAsset(); editingAsset = true; }
  function number(event) { return Number(event.currentTarget.value); }
  function saveAssetAppearance(appearance) { studio.saveAsset({ ...asset, appearance }); editingAsset = false; }
  function savePlacedAppearance(appearance) { studio.updateSelected(['appearance'], appearance, 'Objekt-Sprite speichern'); editingPlacedSprite = false; }
  function openMotion(source = 'selection') { motionSource = source; editingMotion = true; }
  function saveMotion(animation) {
    if (motionSource === 'asset') studio.saveAsset({ ...asset, animation });
    else studio.updateSelected(['animation'], animation, 'Keyframe-Animation speichern');
    editingMotion = false;
  }
</script>

<section class="workspace object-workspace" aria-labelledby="object-workspace-title">
  <header class="workspace-header">
    <div><span class="eyebrow">OBJEKTWERKSTATT</span><h2 id="object-workspace-title">Spezialobjekte & Kulisse</h2><p>Alles außer Wänden ist auswählbar. Baue eigene Objekte einmal und verwende sie in jeder Passauer Karte.</p></div>
    <button class="primary" id="create-object" onclick={createAsset}>＋ Eigenes Objekt</button>
  </header>

  {#if editingAsset && asset}
    <SpriteSheetEditor appearance={asset.appearance} title={`Objekt gestalten · ${asset.name}`} showStates={false} onsave={saveAssetAppearance} oncancel={() => editingAsset = false} />
  {:else if editingPlacedSprite && selected?.appearance}
    <SpriteSheetEditor appearance={selected.appearance} title={`Objekt gestalten · ${selected.name}`} showStates={false} onsave={savePlacedAppearance} oncancel={() => editingPlacedSprite = false} />
  {:else if editingMotion && motionTarget}
    <MotionTimelineEditor animation={motionTarget.animation} previewAsset={motionPreview} title={`Bewegung · ${motionTarget.name || motionTarget.id || 'Objekt'}`} onsave={saveMotion} oncancel={() => editingMotion = false} />
  {:else}
    <div class="workspace-grid object-grid">
      <aside class="asset-library">
        <div class="panel-title"><strong>Objektbibliothek</strong><span>{studio.assets.length} Assets</span></div>
        <p class="hint">Ein Objekt auswählen und anschließend ins Level klicken.</p>
        <div class="asset-list">
          {#each studio.assets as entry}
            <button class:active={entry.id === studio.selectedAssetId} data-asset-id={entry.id} onclick={() => selectAsset(entry.id)}>
              <span class="asset-icon actual"><ObjectThumbnail asset={entry} language={studio.language} /></span><span><strong>{entry.name}</strong><small>{entry.category}</small></span><em>{entry.width}×{entry.height}</em>
            </button>
          {/each}
        </div>
        {#if asset}
          <div class="asset-summary"><span class="eyebrow">AKTIVES ASSET</span><strong>{asset.name}</strong><p>{asset.description}</p>{#if asset.appearance}<button onclick={() => editingAsset = true}>▦ Sprite-Keyframes bearbeiten</button>{/if}<button onclick={() => openMotion('asset')}>◆ Bewegung mit Keyframes</button></div>
        {/if}
      </aside>

      <div class="canvas-column">
        <div class="canvas-toolbar">
          <button class:active={studio.tool === 'select'} onclick={() => studio.setTool('select')}>↖ Auswählen</button>
          <button class:active={studio.tool === 'transform'} data-tool="transform" onclick={() => studio.setTool('transform')}>↔ Bewegen & skalieren</button>
          <button class:active={studio.tool === 'object'} onclick={() => studio.setTool('object')}>＋ {asset?.name ?? 'Objekt'} platzieren</button>
          <span class="toolbar-help">Objekt ziehen · Eckgriff ziehen skaliert proportional. Musiknote, Bühnenlicht und eigene Sprites funktionieren in jedem Theme.</span>
        </div>
        <LevelCanvas {studio} />
        <div class="placed-object-strip">
          <strong>Objekte im Level</strong>
          <div>{#each studio.level.decorations as item, index}<button class:active={studio.selection?.kind === 'decoration' && studio.selection.index === index} onclick={() => studio.selectEntity('decoration', index)}>{item.name || item.label || item.type}<small>{item.x},{item.y}</small></button>{/each}</div>
          {#if studio.level.theme.elements?.length}<strong>Theme-Elemente</strong><div>{#each studio.level.theme.elements as item, index}<button class:active={studio.selection?.kind === 'theme-element' && studio.selection.index === index} onclick={() => studio.selectEntity('theme-element', index)}>{item.id === 'stage-note' ? 'Zauberberg-Note' : item.id === 'stage-lights' ? 'Bühnenlichter' : item.id}</button>{/each}</div>{/if}
        </div>
      </div>

      <aside class="property-panel object-inspector">
        {#if selected && studio.selection?.kind === 'decoration'}
          <div class="property-section"><span class="section-number">OBJ</span><h3>{selected.name || selected.label || selected.type}</h3></div>
          <label>Name<input value={selected.name} onchange={(event) => studio.updateSelected(['name'], event.currentTarget.value)} /></label>
          <label>Beschriftung<input value={selected.label} maxlength="12" onchange={(event) => studio.updateSelected(['label'], event.currentTarget.value)} /></label>
          {#if selected.type === 'text'}
            <div class="transform-hint"><span>↔</span><p><strong>Direkt im Level anordnen</strong>Wähle „Bewegen & skalieren“. Ziehen verschiebt den Text frei, die vier Eckgriffe skalieren Block und Schrift gemeinsam.</p><button onclick={() => studio.setTool('transform')}>Werkzeug aktivieren</button></div>
            <label>Text<input value={selected.content.standard} onchange={(event) => studio.updateSelected(['content', 'standard'], event.currentTarget.value)} /></label>
            <label>Text im Dialekt<input value={selected.content.dialect} onchange={(event) => studio.updateSelected(['content', 'dialect'], event.currentTarget.value)} /></label>
            <div class="field-row"><label>Schriftgröße<input type="number" min="0.15" max="4" step="0.05" value={selected.textStyle.fontSize} onchange={(event) => studio.updateSelected(['textStyle', 'fontSize'], number(event))} /></label><label>Ausrichtung<select value={selected.textStyle.align} onchange={(event) => studio.updateSelected(['textStyle', 'align'], event.currentTarget.value)}><option value="left">Links</option><option value="center">Mitte</option><option value="right">Rechts</option></select></label></div>
            <div class="field-row"><label>Hintergrund<input type="color" value={selected.textStyle.background} onchange={(event) => studio.updateSelected(['textStyle', 'background'], event.currentTarget.value)} /></label><label>Rahmen<input type="color" value={selected.textStyle.borderColor} onchange={(event) => studio.updateSelected(['textStyle', 'borderColor'], event.currentTarget.value)} /></label></div>
            <label class="switch"><input type="checkbox" checked={selected.textStyle.uppercase} onchange={(event) => studio.updateSelected(['textStyle', 'uppercase'], event.currentTarget.checked)} /><span>Großbuchstaben</span></label>
          {/if}
          <div class="field-row"><label>X<input type="number" step="0.05" value={selected.x} onchange={(event) => studio.updateSelected(['x'], number(event))} /></label><label>Y<input type="number" step="0.05" value={selected.y} onchange={(event) => studio.updateSelected(['y'], number(event))} /></label></div>
          <div class="field-row"><label>Breite<input type="number" min="0.25" max="24" step="0.05" value={selected.width} onchange={(event) => studio.updateSelected(['width'], number(event))} /></label><label>Höhe<input type="number" min="0.25" max="24" step="0.05" value={selected.height} onchange={(event) => studio.updateSelected(['height'], number(event))} /></label></div>
          <label>Farbe<input type="color" value={selected.color} onchange={(event) => studio.updateSelected(['color'], event.currentTarget.value)} /></label>
          <label>Animation<select value={selected.animation.type} onchange={(event) => studio.updateSelected(['animation', 'type'], event.currentTarget.value)}>{#each animationTypes as [id, name]}<option value={id}>{name}</option>{/each}</select></label>
          <div class="field-row"><label>Tempo<input type="number" min="0.1" max="12" step="0.1" value={selected.animation.speed} onchange={(event) => studio.updateSelected(['animation', 'speed'], number(event))} /></label><label>Stärke<input type="number" min="0" max="1" step="0.025" value={selected.animation.amplitude} onchange={(event) => studio.updateSelected(['animation', 'amplitude'], number(event))} /></label></div>
          {#if selected.appearance?.animations?.length}<label>Sprite-Animation<select value={selected.spriteAnimation} onchange={(event) => studio.updateSelected(['spriteAnimation'], event.currentTarget.value)}>{#each selected.appearance.animations as animation}<option value={animation.id}>{animation.id}</option>{/each}</select></label>{/if}
          <button onclick={() => openMotion('selection')}>◆ Keyframe-Bewegung öffnen</button>
          {#if selected.appearance}<button onclick={() => editingPlacedSprite = true}>▦ Sprite-Keyframes öffnen</button>{/if}
          <label class="switch"><input type="checkbox" checked={selected.locked} onchange={(event) => studio.updateSelected(['locked'], event.currentTarget.checked)} /><span>Position sperren</span></label>
          <button class="danger" onclick={() => studio.deleteSelection()}>Objekt löschen</button>
        {:else if selected && studio.selection?.kind === 'theme-element'}
          <div class="property-section"><span class="section-number">SYS</span><h3>{selected.id === 'stage-note' ? 'Zauberberg-Note' : selected.id === 'stage-lights' ? 'Bühnenlichter' : selected.id}</h3></div>
          <p class="hint">Dieses originale Kulissenelement wurde direkt im Canvas ausgewählt. Du kannst seine Animation ändern oder das entsprechende Asset aus der Bibliothek in andere Karten setzen.</p>
          <label>Animation<select value={selected.animation.type} onchange={(event) => studio.updateSelected(['animation', 'type'], event.currentTarget.value)}>{#each animationTypes as [id, name]}<option value={id}>{name}</option>{/each}</select></label>
          <div class="field-row"><label>Tempo<input type="number" min="0.1" max="12" step="0.1" value={selected.animation.speed} onchange={(event) => studio.updateSelected(['animation', 'speed'], number(event))} /></label><label>Stärke<input type="number" min="0" max="1" step="0.025" value={selected.animation.amplitude} onchange={(event) => studio.updateSelected(['animation', 'amplitude'], number(event))} /></label></div>
          <button onclick={() => openMotion('selection')}>◆ Keyframe-Bewegung öffnen</button>
          <button onclick={() => { studio.selectedAssetId = selected.id === 'stage-note' ? 'zauberberg-note' : 'stage-lights'; studio.setTool('object'); }}>In dieser Karte frei platzieren</button>
        {:else}
          <div class="empty-inspector"><span>↖</span><strong>Objekt auswählen</strong><p>Wähle ein Element im Canvas oder in der Liste. Das gilt auch für Musiknote und Bühnenlicht.</p></div>
        {/if}
      </aside>
    </div>
  {/if}
</section>
