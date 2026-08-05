<script>
  import { createFranzLolaAppearance, PLAYER_STATES } from '../character-template.js';
  import ActorThumbnail from './ActorThumbnail.svelte';
  import MobileFocusTabs from './MobileFocusTabs.svelte';
  import SpriteSheetEditor from './SpriteSheetEditor.svelte';

  let { studio } = $props();
  let editing = $state(false);
  let mobilePanel = $state('canvas');
  let targetKind = $derived(studio.selection?.kind === 'cat' ? 'cat' : 'player');
  let targetIndex = $derived(studio.selection?.kind === 'cat' ? studio.selection.index : 0);
  let actor = $derived(targetKind === 'player' ? studio.level.actors.player : studio.level.actors.cats[targetIndex]);
  let appearance = $derived(actor?.appearance ?? (targetKind === 'player' ? createFranzLolaAppearance() : null));
  let profile = $derived(studio.level.gameplay.difficulties[studio.difficulty]);

  function select(kind, index) { studio.selectEntity(kind, index); editing = false; mobilePanel = 'inspector'; }
  function number(event) { return Number(event.currentTarget.value); }
  function update(path, value) { studio.updateSelected(path, value, 'Figur bearbeiten'); }
</script>

<section class="workspace character-workspace" aria-labelledby="character-workspace-title">
  <header class="workspace-header">
    <div><span class="eyebrow">CHARAKTERATELIER</span><h2 id="character-workspace-title">Figuren & Sprite-Sheets</h2><p>Franz, Lola und Katzen erhalten hier ihre Pixel, Player States, Animationen und Verhaltensregeln.</p></div>
    <button class="primary" onclick={() => editing = !editing}>{editing ? '← Übersicht' : '▦ Sprite-Sheet öffnen'}</button>
  </header>

  {#if editing && actor}
    {#key `${targetKind}-${targetIndex}`}
      <SpriteSheetEditor
        appearance={appearance}
        title={targetKind === 'player' ? 'Franz & Lola' : `Katze ${targetIndex + 1}`}
        showStates={true}
        onsave={(next) => { studio.setActorAppearance(targetKind, targetIndex, next); editing = false; }}
        oncancel={() => editing = false}
      />
    {/key}
  {:else}
    <div class="character-layout focus-layout">
      <aside class:mobile-active={mobilePanel === 'scene'} class="actor-browser" data-focus-panel="scene">
        <strong>Figuren im Level</strong>
        <button class:active={targetKind === 'player'} onclick={() => select('player', 0)}><span class="actor-avatar actual"><ActorThumbnail actor={studio.level.actors.player} kind="player" state="idle" label="Franz und Lola" /></span><span><b>Franz & Lola</b><small>Spieler · gemeinsam</small></span></button>
        {#each studio.level.actors.cats as cat, index}
          <button class:active={targetKind === 'cat' && targetIndex === index} onclick={() => select('cat', index)}><span class="actor-avatar actual"><ActorThumbnail actor={cat} kind="cat" state="idle" label={`Katze ${index + 1}`} /></span><span><b>Katze {index + 1}</b><small>{cat.behavior.strategy}</small></span></button>
        {/each}
        <button onclick={() => { studio.setTool('cat'); studio.workspace = 'level'; }}>＋ Katze im Level setzen</button>
      </aside>

      <div class="character-stage mobile-active" data-focus-panel="canvas">
        {#if actor}
          <div class="character-hero">
            <ActorThumbnail actor={actor} {appearance} kind={targetKind} state="idle" class="actor-preview-large" label={targetKind === 'player' ? 'Franz und Lola in Originaldarstellung' : `Katze ${targetIndex + 1} in Spieldarstellung`} />
            <div><span class="eyebrow">AKTIVE FIGUR</span><h3>{targetKind === 'player' ? 'Franz & Lola' : `Katze ${targetIndex + 1}`}</h3><p>{appearance ? `${appearance.width} × ${appearance.height} Pixel · ${appearance.animations.length} Animationen` : 'Standard-Pixelrenderer'}</p><button class="primary" onclick={() => editing = true}>Sprite-Sheet bearbeiten</button>{#if targetKind === 'player'}<button onclick={() => studio.resetPlayerAppearance()}>Originalvorlage laden</button>{/if}</div>
          </div>
          <div class="state-matrix">
            <header><strong>Player States</strong><span>Jeder Zustand verweist eindeutig auf eine Animation.</span></header>
            {#each PLAYER_STATES as state}
              <div data-player-state={state}><ActorThumbnail actor={actor} {appearance} kind={targetKind} {state} class="actor-state-preview" label={`${state} Vorschau`} /><strong>{state}</strong><code>{appearance?.stateAnimations?.[state] || 'Standardrenderer'}</code></div>
            {/each}
          </div>
        {/if}
      </div>

      <aside class:mobile-active={mobilePanel === 'inspector'} class="property-panel" data-focus-panel="inspector">
        {#if actor}
          <div class="property-section"><span class="section-number">AI</span><h3>Verhalten</h3></div>
          <div class="field-row"><label>X<input type="number" value={actor.x} onchange={(event) => update(['x'], number(event))} /></label><label>Y<input type="number" value={actor.y} onchange={(event) => update(['y'], number(event))} /></label></div>
          {#if targetKind === 'player'}
            <label>Steuerung<select value={actor.behavior.controller} onchange={(event) => update(['behavior', 'controller'], event.currentTarget.value)}><option value="user">Spieler</option><option value="autopilot">Autopilot</option><option value="patrol">Patrouille</option><option value="stationary">Stehen</option></select></label>
          {:else}
            <label>Strategie<select value={actor.behavior.strategy} onchange={(event) => update(['behavior', 'strategy'], event.currentTarget.value)}><option value="chase">Verfolgen</option><option value="ambush">Auflauern</option><option value="scatter-chase">Wechseln</option><option value="guard">Ort bewachen</option><option value="random">Zufällig</option><option value="stationary">Stehen</option></select></label>
            <div class="field-row"><label>Vorausschau<input type="number" min="0" max="12" value={actor.behavior.lookAhead} onchange={(event) => update(['behavior', 'lookAhead'], number(event))} /></label><label>Zufall<input type="number" min="0" max="12" step="0.1" value={actor.behavior.wanderMultiplier} onchange={(event) => update(['behavior', 'wanderMultiplier'], number(event))} /></label></div>
            <div class="field-row"><label>Fell<input type="color" value={actor.color} onchange={(event) => update(['color'], event.currentTarget.value)} /></label><label>Akzent<input type="color" value={actor.accent} onchange={(event) => update(['accent'], event.currentTarget.value)} /></label></div>
          {/if}
          <label>Tempo-Multiplikator<input type="number" min="0.1" max="4" step="0.1" value={actor.behavior.speedMultiplier} onchange={(event) => update(['behavior', 'speedMultiplier'], number(event))} /></label>
          {#if targetKind === 'cat'}<button class="danger" onclick={() => studio.deleteSelection()}>Katze entfernen</button>{/if}
        {/if}
        <div class="property-section"><span class="section-number">PHYS</span><h3>Spielgefühl</h3></div>
        <label>Schwierigkeit<select bind:value={studio.difficulty}><option value="easy">Spaziergang</option><option value="normal">Gassirunde</option><option value="hard">Abenteuer</option></select></label>
        <div class="field-row"><label>Franz Tempo<input type="number" step="0.05" value={profile.playerSpeed} onchange={(event) => studio.update(['gameplay', 'difficulties', studio.difficulty, 'playerSpeed'], number(event))} /></label><label>Katze Tempo<input type="number" step="0.05" value={profile.catSpeed} onchange={(event) => studio.update(['gameplay', 'difficulties', studio.difficulty, 'catSpeed'], number(event))} /></label></div>
        <div class="field-row"><label>Leben<input type="number" min="1" value={profile.lives} onchange={(event) => studio.update(['gameplay', 'difficulties', studio.difficulty, 'lives'], number(event))} /></label><label>Katzen<input type="number" min="0" max="12" value={profile.catCount} onchange={(event) => studio.update(['gameplay', 'difficulties', studio.difficulty, 'catCount'], number(event))} /></label></div>
      </aside>
      {#if mobilePanel !== 'canvas'}<button class="mobile-panel-scrim" aria-label="Mobile Seitenleiste schließen" onclick={() => mobilePanel = 'canvas'}></button>{/if}
      <MobileFocusTabs value={mobilePanel} options={[["scene", "FL", "Figuren"], ["canvas", "▦", "Vorschau"], ["inspector", "☰", "Details"]]} onchange={(value) => mobilePanel = value} />
    </div>
  {/if}
</section>
