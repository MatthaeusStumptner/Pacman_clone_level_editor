<script>
  import { onMount } from 'svelte';
  import { PLAYER_STATES } from '../character-template.js';
  import { insertSpriteKeyframe, keyframeAtTime, prepareAppearanceForEditing } from '../animation-tools.js';
  import ActorThumbnail from './ActorThumbnail.svelte';

  let { appearance, title = 'Sprite-Sheet', showStates = true, onsave = () => {}, oncancel = () => {} } = $props();
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const fallbackRows = Array.from({ length: 12 }, () => '0'.repeat(12));
  function initialAppearance() { return prepareAppearanceForEditing(appearance ?? { width: 12, height: 12, palette: ['transparent', '#55d9dd'], pixels: fallbackRows, animations: [], stateAnimations: {} }); }
  let draft = $state(initialAppearance());
  let selectedState = $state('idle');
  let selectedAnimationId = $state(draft.stateAnimations?.idle || draft.animations?.[0]?.id || 'base');
  let selectedKeyframeId = $state(draft.animations?.find((entry) => entry.id === selectedAnimationId)?.keyframes?.[0]?.id || '');
  let paletteIndex = $state(1);
  let newColor = $state('#55d9dd');
  let newAnimationName = $state('animation');
  let painting = $state(false);
  let playhead = $state(0);
  let playing = $state(false);
  let lastTimestamp = 0;
  let animationFrame;

  let selectedAnimation = $derived(draft.animations.find((animation) => animation.id === selectedAnimationId) ?? null);
  let selectedKeyframe = $derived(selectedAnimation?.keyframes.find((frame) => frame.id === selectedKeyframeId) ?? selectedAnimation?.keyframes[0] ?? null);
  let rows = $derived(selectedKeyframe?.pixels ?? draft.pixels);
  let playbackFrame = $derived(selectedAnimation ? keyframeAtTime(selectedAnimation, playhead) : null);
  let previewRows = $derived(playbackFrame?.pixels ?? rows);

  function tick(timestamp) {
    if (playing && selectedAnimation) {
      if (lastTimestamp) playhead += (timestamp - lastTimestamp) / 1000;
      if (playhead >= selectedAnimation.duration) {
        if (selectedAnimation.loop) playhead %= selectedAnimation.duration;
        else { playhead = selectedAnimation.duration; playing = false; }
      }
    }
    lastTimestamp = timestamp; animationFrame = requestAnimationFrame(tick);
  }
  function tokenColor(token) { return draft.palette[Number.parseInt(token, 36)] || 'transparent'; }
  function selectAnimation(id) {
    selectedAnimationId = id; const animation = draft.animations.find((entry) => entry.id === id);
    selectedKeyframeId = animation?.keyframes[0]?.id ?? ''; playhead = animation?.keyframes[0]?.time ?? 0; playing = false;
  }
  function activateState(state) {
    selectedState = state;
    selectAnimation(draft.stateAnimations?.[state] || draft.animations.find((animation) => animation.id === state)?.id || draft.animations[0]?.id || 'base');
  }
  function setRows(nextRows) { if (selectedKeyframe) selectedKeyframe.pixels = nextRows; else draft.pixels = nextRows; }
  function paint(x, y, erase = false) {
    const next = [...rows]; const token = erase ? '0' : paletteIndex.toString(36);
    next[y] = `${next[y].slice(0, x)}${token}${next[y].slice(x + 1)}`; setRows(next);
  }
  function addAnimation() {
    const base = newAnimationName.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'animation';
    let id = base; let suffix = 2; while (draft.animations.some((entry) => entry.id === id)) { id = `${base}-${suffix}`; suffix += 1; }
    draft.animations.push({ id, fps: 6, duration: 1, loop: true, keyframes: [{ id: 'keyframe-1', time: 0, easing: 'step', pixels: [...rows] }] });
    selectAnimation(id); if (showStates) { draft.stateAnimations ??= {}; draft.stateAnimations[selectedState] = id; }
  }
  function deleteAnimation() {
    if (!selectedAnimation) return;
    draft.animations = draft.animations.filter((entry) => entry.id !== selectedAnimationId);
    Object.keys(draft.stateAnimations ?? {}).forEach((state) => { if (draft.stateAnimations[state] === selectedAnimationId) draft.stateAnimations[state] = ''; });
    selectAnimation(draft.animations[0]?.id ?? 'base');
  }
  function addKeyframe() {
    if (!selectedAnimation || selectedAnimation.keyframes.length >= 64) return;
    const frame = insertSpriteKeyframe(selectedAnimation, rows, playhead);
    selectedKeyframeId = frame.id; playhead = frame.time; playing = false;
  }
  function duplicateAfter() {
    if (!selectedAnimation) return;
    playhead = Math.min(selectedAnimation.duration, (selectedKeyframe?.time ?? 0) + Math.max(0.05, 1 / selectedAnimation.fps)); addKeyframe();
  }
  function deleteKeyframe() {
    if (selectedAnimation?.keyframes.length > 1) {
      selectedAnimation.keyframes = selectedAnimation.keyframes.filter((entry) => entry.id !== selectedKeyframeId);
      selectedKeyframeId = selectedAnimation.keyframes[0].id; playhead = selectedAnimation.keyframes[0].time;
    }
  }
  function moveKeyframeTime(event) {
    if (!selectedKeyframe || !selectedAnimation) return;
    selectedKeyframe.time = Number(event.currentTarget.value); selectedAnimation.keyframes.sort((left, right) => left.time - right.time); playhead = selectedKeyframe.time;
  }
  function addColor() { if (!draft.palette.includes(newColor) && draft.palette.length < 36) draft.palette.push(newColor); paletteIndex = draft.palette.indexOf(newColor); }
  function mapState(event) { draft.stateAnimations ??= {}; draft.stateAnimations[selectedState] = event.currentTarget.value; selectAnimation(event.currentTarget.value); }
  function save() {
    if (!draft.animations.length) draft.animations.push({ id: 'idle', fps: 4, duration: 0.25, loop: true, keyframes: [{ id: 'keyframe-1', time: 0, easing: 'step', pixels: [...draft.pixels] }] });
    if (showStates) { draft.stateAnimations ??= {}; PLAYER_STATES.forEach((state) => { if (!draft.stateAnimations[state]) draft.stateAnimations[state] = draft.animations[0].id; }); }
    draft.animations.forEach((animation) => { animation.frames = animation.keyframes.map((frame) => ({ pixels: frame.pixels })); });
    onsave(clone(draft));
  }
  onMount(() => { animationFrame = requestAnimationFrame(tick); return () => cancelAnimationFrame(animationFrame); });
</script>

<section class="sprite-studio" aria-label={title}>
  <header><div><span class="eyebrow">SPRITE-SHEET · KEYFRAMES</span><h3>{title}</h3><p>Zustand → Animation → Keyframe → Pixel. Mit Timeline, Scrubbing und echtem Playback.</p></div><div class="modal-actions"><button onclick={oncancel}>Abbrechen</button><button class="primary" onclick={save}>Sprite übernehmen</button></div></header>
  <div class="sprite-playback-stage">
    <ActorThumbnail appearance={draft} kind="player" state={selectedState} animationId={selectedAnimationId === 'base' ? '' : selectedAnimationId} elapsed={playhead} class="sprite-playback-preview" label={`${title} Playback-Vorschau`} />
    <div class="keyframe-transport"><button onclick={() => { playhead = 0; playing = false; }}>■</button><button class="primary" disabled={!selectedAnimation} onclick={() => { if (playhead >= selectedAnimation.duration) playhead = 0; playing = !playing; lastTimestamp = 0; }}>{playing ? 'Ⅱ Pause' : '▶ Playback'}</button><input type="range" min="0" max={selectedAnimation?.duration ?? 1} step="0.01" bind:value={playhead} disabled={!selectedAnimation} /><code>{playhead.toFixed(2)} / {(selectedAnimation?.duration ?? 0).toFixed(2)} s</code></div>
    {#if selectedAnimation}<div class="keyframe-ruler"><div class="timeline-playhead" style:left={`${playhead / selectedAnimation.duration * 100}%`}></div>{#each selectedAnimation.keyframes as frame}<button class:active={frame.id === selectedKeyframeId} style:left={`${frame.time / selectedAnimation.duration * 100}%`} onclick={() => { selectedKeyframeId = frame.id; playhead = frame.time; playing = false; }} title={`${frame.id} · ${frame.time.toFixed(2)} s`}></button>{/each}</div>{/if}
  </div>
  <div class="sprite-layout">
    <aside class="sprite-sheet-strip">
      {#if showStates}<strong>Player States</strong><div class="state-tabs">{#each PLAYER_STATES as state}<button class:active={selectedState === state} onclick={() => activateState(state)}>{state === 'idle' ? '•' : state === 'up' ? '↑' : state === 'right' ? '→' : state === 'down' ? '↓' : '←'}<span>{state}</span></button>{/each}</div><label>Verwendete Animation<select value={draft.stateAnimations?.[selectedState] || selectedAnimationId} onchange={mapState}>{#each draft.animations as animation}<option value={animation.id}>{animation.id}</option>{/each}</select></label>{/if}
      <strong>Animationen</strong><div class="animation-list"><button class:active={selectedAnimationId === 'base'} onclick={() => selectAnimation('base')}>Basisbild</button>{#each draft.animations as animation}<button class:active={selectedAnimationId === animation.id} onclick={() => selectAnimation(animation.id)}>{animation.id}<small>{animation.keyframes.length} Keyframes · {animation.duration.toFixed(2)} s</small></button>{/each}</div>
      <div class="inline-create"><input bind:value={newAnimationName} aria-label="Name der neuen Animation" /><button onclick={addAnimation}>＋</button></div><button class="danger-subtle" onclick={deleteAnimation} disabled={!selectedAnimation}>Animation löschen</button>
    </aside>
    <div class="pixel-editor-column">
      <div class="frame-toolbar"><strong>{selectedKeyframe ? `${selectedAnimation.id} · ${selectedKeyframe.id}` : 'Basisbild'}</strong><span>{draft.width} × {draft.height} Pixel</span></div>
      <div class="pixel-grid" role="grid" tabindex="0" aria-label="Pixelraster" style={`--sprite-columns:${draft.width}; --sprite-rows:${draft.height}`} onpointerleave={() => painting = false}>
        {#each rows as row, y}{#each [...row] as token, x}<button data-x={x} data-y={y} aria-label={`Pixel ${x}, ${y}`} style:background={tokenColor(token) === 'transparent' ? 'transparent' : tokenColor(token)} onpointerdown={(event) => { event.preventDefault(); painting = true; paint(x, y, event.button === 2); }} onpointerenter={(event) => { if (painting && event.buttons) paint(x, y, (event.buttons & 2) > 0); }} onpointerup={() => painting = false} oncontextmenu={(event) => event.preventDefault()}></button>{/each}{/each}
      </div>
      <div class="frame-actions"><button onclick={() => setRows(rows.map((row) => [...row].reverse().join('')))}>⇆ Spiegeln</button><button onclick={() => setRows(Array.from({ length: draft.height }, () => '0'.repeat(draft.width)))}>Leeren</button>{#if selectedAnimation}<button onclick={duplicateAfter}>＋ Keyframe duplizieren</button><button onclick={addKeyframe}>＋ Am Playhead</button><button onclick={deleteKeyframe} disabled={selectedAnimation.keyframes.length <= 1}>− Keyframe</button>{/if}</div>
    </div>
    <aside class="sprite-properties">
      <strong>Keyframes</strong><div class="sheet-grid">{#each selectedAnimation?.keyframes ?? [{ id: 'base', time: 0, pixels: draft.pixels }] as frame}<button class:active={frame.id === selectedKeyframeId} onclick={() => { selectedKeyframeId = frame.id; playhead = frame.time; playing = false; }} title={`${frame.time.toFixed(2)} s`}><span class="sprite-thumbnail" style={`--thumb-columns:${draft.width}`}>{#each frame.pixels as row}{#each [...row] as token}<i style:background={tokenColor(token) === 'transparent' ? 'transparent' : tokenColor(token)}></i>{/each}{/each}</span><small>{frame.time.toFixed(2)}s</small></button>{/each}</div>
      {#if selectedAnimation}<div class="field-row"><label>Dauer<input type="number" min="0.1" max="120" step="0.05" bind:value={selectedAnimation.duration} /></label><label class="switch"><input type="checkbox" bind:checked={selectedAnimation.loop} /><span>Loop</span></label></div>{/if}
      {#if selectedKeyframe}<label>Keyframe-Zeit<input type="number" min="0" max={selectedAnimation.duration} step="0.01" value={selectedKeyframe.time} onchange={moveKeyframeTime} /></label><label>Übergang<select bind:value={selectedKeyframe.easing}><option value="step">Harter Framewechsel</option><option value="linear">Linear</option><option value="ease-in-out">Weich</option></select></label>{/if}
      <strong>Palette</strong><div class="palette-grid">{#each draft.palette as color, index}<button class:active={paletteIndex === index} style:background={color === 'transparent' ? 'transparent' : color} onclick={() => paletteIndex = index} title={color}></button>{/each}</div><div class="inline-create"><input type="color" bind:value={newColor} aria-label="Neue Farbe" /><button onclick={addColor}>Farbe hinzufügen</button></div>
    </aside>
  </div>
</section>
