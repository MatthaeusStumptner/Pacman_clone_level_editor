<script>
  import { PLAYER_STATES } from '../character-template.js';

  let { appearance, title = 'Sprite-Sheet', showStates = true, onsave = () => {}, oncancel = () => {} } = $props();
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const fallbackRows = Array.from({ length: 12 }, () => '0'.repeat(12));
  function initialAppearance() { return clone(appearance ?? { width: 12, height: 12, palette: ['transparent', '#55d9dd'], pixels: fallbackRows, animations: [], stateAnimations: {} }); }
  let draft = $state(initialAppearance());
  let selectedState = $state('idle');
  let selectedAnimationId = $state(draft.stateAnimations?.idle || draft.animations?.[0]?.id || 'base');
  let frameIndex = $state(0);
  let paletteIndex = $state(1);
  let newColor = $state('#55d9dd');
  let newAnimationName = $state('animation');
  let painting = $state(false);

  let selectedAnimation = $derived(draft.animations.find((animation) => animation.id === selectedAnimationId) ?? null);
  let rows = $derived(selectedAnimation?.frames[frameIndex]?.pixels ?? draft.pixels);

  function tokenColor(token) { return draft.palette[Number.parseInt(token, 36)] || 'transparent'; }
  function activateState(state) {
    selectedState = state;
    selectedAnimationId = draft.stateAnimations?.[state] || draft.animations.find((animation) => animation.id === state)?.id || draft.animations[0]?.id || 'base';
    frameIndex = 0;
  }
  function setRows(nextRows) {
    if (selectedAnimation) selectedAnimation.frames[frameIndex].pixels = nextRows;
    else draft.pixels = nextRows;
  }
  function paint(x, y, erase = false) {
    const next = [...rows]; const token = erase ? '0' : paletteIndex.toString(36);
    next[y] = `${next[y].slice(0, x)}${token}${next[y].slice(x + 1)}`; setRows(next);
  }
  function addAnimation() {
    const base = newAnimationName.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'animation';
    let id = base; let suffix = 2; while (draft.animations.some((entry) => entry.id === id)) { id = `${base}-${suffix}`; suffix += 1; }
    draft.animations.push({ id, fps: 6, loop: true, frames: [{ pixels: [...rows] }] });
    selectedAnimationId = id; frameIndex = 0;
    if (showStates) { draft.stateAnimations ??= {}; draft.stateAnimations[selectedState] = id; }
  }
  function deleteAnimation() {
    if (!selectedAnimation) return;
    draft.animations = draft.animations.filter((entry) => entry.id !== selectedAnimationId);
    Object.keys(draft.stateAnimations ?? {}).forEach((state) => { if (draft.stateAnimations[state] === selectedAnimationId) draft.stateAnimations[state] = ''; });
    selectedAnimationId = draft.animations[0]?.id ?? 'base'; frameIndex = 0;
  }
  function addFrame() { if (selectedAnimation && selectedAnimation.frames.length < 64) { selectedAnimation.frames.splice(frameIndex + 1, 0, { pixels: [...rows] }); frameIndex += 1; } }
  function deleteFrame() { if (selectedAnimation?.frames.length > 1) { selectedAnimation.frames.splice(frameIndex, 1); frameIndex = Math.max(0, frameIndex - 1); } }
  function addColor() { if (!draft.palette.includes(newColor) && draft.palette.length < 36) draft.palette.push(newColor); paletteIndex = draft.palette.indexOf(newColor); }
  function mapState(event) { draft.stateAnimations ??= {}; draft.stateAnimations[selectedState] = event.currentTarget.value; selectedAnimationId = event.currentTarget.value; frameIndex = 0; }
  function save() {
    if (!draft.animations.length) draft.animations.push({ id: 'idle', fps: 4, loop: true, frames: [{ pixels: [...draft.pixels] }] });
    if (showStates) { draft.stateAnimations ??= {}; PLAYER_STATES.forEach((state) => { if (!draft.stateAnimations[state]) draft.stateAnimations[state] = draft.animations[0].id; }); }
    onsave(clone(draft));
  }
</script>

<section class="sprite-studio" aria-label={title}>
  <header><div><span class="eyebrow">SPRITE-SHEET</span><h3>{title}</h3><p>Zustand → Animation → Frame → Pixel. Alles bleibt im Level-JSON editierbar.</p></div><div class="modal-actions"><button onclick={oncancel}>Abbrechen</button><button class="primary" onclick={save}>Sprite übernehmen</button></div></header>
  <div class="sprite-layout">
    <aside class="sprite-sheet-strip">
      {#if showStates}
        <strong>Player States</strong>
        <div class="state-tabs">
          {#each PLAYER_STATES as state}<button class:active={selectedState === state} onclick={() => activateState(state)}>{state === 'idle' ? '•' : state === 'up' ? '↑' : state === 'right' ? '→' : state === 'down' ? '↓' : '←'}<span>{state}</span></button>{/each}
        </div>
        <label>Verwendete Animation<select value={draft.stateAnimations?.[selectedState] || selectedAnimationId} onchange={mapState}>{#each draft.animations as animation}<option value={animation.id}>{animation.id}</option>{/each}</select></label>
      {/if}
      <strong>Animationen</strong>
      <div class="animation-list">
        <button class:active={selectedAnimationId === 'base'} onclick={() => { selectedAnimationId = 'base'; frameIndex = 0; }}>Basisbild</button>
        {#each draft.animations as animation}<button class:active={selectedAnimationId === animation.id} onclick={() => { selectedAnimationId = animation.id; frameIndex = 0; }}>{animation.id}<small>{animation.frames.length} Frames</small></button>{/each}
      </div>
      <div class="inline-create"><input bind:value={newAnimationName} aria-label="Name der neuen Animation" /><button onclick={addAnimation}>＋</button></div>
      <button class="danger-subtle" onclick={deleteAnimation} disabled={!selectedAnimation}>Animation löschen</button>
    </aside>

    <div class="pixel-editor-column">
      <div class="frame-toolbar"><strong>{selectedAnimation ? `${selectedAnimation.id} · Frame ${frameIndex + 1}/${selectedAnimation.frames.length}` : 'Basisbild'}</strong><span>{draft.width} × {draft.height} Pixel</span></div>
      <div class="pixel-grid" role="grid" tabindex="0" aria-label="Pixelraster" style={`--sprite-columns:${draft.width}; --sprite-rows:${draft.height}`} onpointerleave={() => painting = false}>
        {#each rows as row, y}{#each [...row] as token, x}
          <button
            data-x={x} data-y={y}
            aria-label={`Pixel ${x}, ${y}`}
            style:background={tokenColor(token) === 'transparent' ? 'transparent' : tokenColor(token)}
            onpointerdown={(event) => { event.preventDefault(); painting = true; paint(x, y, event.button === 2); }}
            onpointerenter={(event) => { if (painting && event.buttons) paint(x, y, (event.buttons & 2) > 0); }}
            onpointerup={() => painting = false}
            oncontextmenu={(event) => event.preventDefault()}
          ></button>
        {/each}{/each}
      </div>
      <div class="frame-actions"><button onclick={() => setRows(rows.map((row) => [...row].reverse().join('')))}>⇆ Spiegeln</button><button onclick={() => setRows(Array.from({ length: draft.height }, () => '0'.repeat(draft.width)))}>Leeren</button>{#if selectedAnimation}<button onclick={addFrame}>＋ Frame</button><button onclick={deleteFrame} disabled={selectedAnimation.frames.length <= 1}>− Frame</button>{/if}</div>
    </div>

    <aside class="sprite-properties">
      <strong>Sprite-Sheet</strong>
      <div class="sheet-grid">
        {#each selectedAnimation?.frames ?? [{ pixels: draft.pixels }] as frame, index}
          <button class:active={index === frameIndex} onclick={() => frameIndex = index} title={`Frame ${index + 1}`}>
            <span class="sprite-thumbnail" style={`--thumb-columns:${draft.width}`}>
              {#each frame.pixels as row}{#each [...row] as token}<i style:background={tokenColor(token) === 'transparent' ? 'transparent' : tokenColor(token)}></i>{/each}{/each}
            </span>
          </button>
        {/each}
      </div>
      {#if selectedAnimation}<div class="field-row"><label>FPS<input type="number" min="0.25" max="30" step="0.25" bind:value={selectedAnimation.fps} /></label><label class="switch"><input type="checkbox" bind:checked={selectedAnimation.loop} /><span>Loop</span></label></div>{/if}
      <strong>Palette</strong>
      <div class="palette-grid">{#each draft.palette as color, index}<button class:active={paletteIndex === index} style:background={color === 'transparent' ? 'transparent' : color} onclick={() => paletteIndex = index} title={color}></button>{/each}</div>
      <div class="inline-create"><input type="color" bind:value={newColor} aria-label="Neue Farbe" /><button onclick={addColor}>Farbe hinzufügen</button></div>
    </aside>
  </div>
</section>
