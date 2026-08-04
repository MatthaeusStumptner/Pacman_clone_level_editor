<script>
  import { onMount } from 'svelte';
  import { createPublisherClient } from '../publisher-client.js';

  let { studio } = $props();
  const publisher = createPublisherClient();
  let state = $state(publisher.configured ? 'login' : 'unavailable');
  let user = $state.raw(null);
  let publication = $state.raw(null);
  let error = $state('');
  let polling = null;

  const steps = [
    ['testing', 'Automatisch prüfen'],
    ['deploying', 'Ins Spiel übernehmen'],
    ['published', 'GitHub Pages aktualisieren'],
  ];

  function login() {
    const url = publisher.loginUrl(window.location.href);
    if (url) window.location.assign(url);
  }

  async function identify() {
    if (!publisher.authenticated) return;
    state = 'loading'; error = '';
    try { user = await publisher.me(); state = 'review'; }
    catch (reason) { error = reason.message; state = 'login'; }
  }

  async function poll(id) {
    clearTimeout(polling);
    try {
      publication = await publisher.publication(id);
      state = publication.state === 'published' ? 'published' : publication.state === 'failed' ? 'failed' : 'progress';
      if (state === 'progress') polling = setTimeout(() => poll(id), 2000);
    } catch (reason) { error = reason.message; state = 'failed'; }
  }

  async function publish() {
    if (!studio.validation.ok) { studio.workspace = 'level'; studio.notify('Bitte zuerst die Level-Fehler beheben'); return; }
    state = 'progress'; error = ''; publication = { state: 'testing', detail: 'Das Level wird an den sicheren Publisher übertragen.' };
    try {
      const result = await publisher.publish(studio.level);
      await poll(Number(result.publicationId));
    } catch (reason) { error = reason.message; state = 'failed'; }
  }

  function logout() { publisher.clearSession(); user = null; publication = null; state = 'login'; }

  onMount(() => {
    publisher.consumeSessionFromLocation();
    if (publisher.authenticated) identify();
    return () => clearTimeout(polling);
  });
</script>

<section class="workspace publish-workspace" aria-labelledby="publish-workspace-title">
  <header class="workspace-header">
    <div><span class="eyebrow">EIN KLICK · AUTOMATISCH GEPRÜFT</span><h2 id="publish-workspace-title">Veröffentlichen</h2><p>Hier wird das aktuelle Level geprüft, ins Spiel übertragen und anschließend auf GitHub Pages live gestellt.</p></div>
    {#if user}<div class="publisher-user"><span>{user.avatarUrl ? '●' : 'GH'}</span><div><strong>{user.name || user.login}</strong><small>GitHub verbunden</small></div><button onclick={logout}>Abmelden</button></div>{/if}
  </header>

  <div class="publish-layout">
    <div class="publication-card">
      <div class="publication-level-icon">{studio.level.icon}</div>
      <div><span class="eyebrow">AKTUELLES LEVEL</span><h3>{studio.level.name.standard}</h3><p>{studio.level.id} · {studio.level.board.columns} × {studio.level.board.rows} Felder · {studio.pellets.size} Guttis</p></div>
      <div class:invalid={!studio.validation.ok} class="validation-pill">{studio.validation.ok ? '✓ Spielbar' : `⚠ ${studio.validation.errors.length} Fehler`}</div>
    </div>

    {#if state === 'unavailable'}
      <article class="publish-state warning-state"><span class="state-symbol">⚙</span><h3>Einmalige Einrichtung fehlt</h3><p>Die Editor-Version kennt noch keine Publisher-Adresse. Trage in GitHub unter <b>Settings → Secrets and variables → Actions → Variables</b> die Variable <code>PUBLISHER_URL</code> mit deiner <code>workers.dev</code>-Adresse ein und starte den Pages-Workflow erneut.</p><a href="https://github.com/MatthaeusStumptner/Pacman_clone_level_editor/settings/variables/actions" target="_blank" rel="noreferrer">GitHub-Variable öffnen →</a></article>
    {:else if state === 'login'}
      <article class="publish-state"><span class="state-symbol">GH</span><h3>Mit GitHub anmelden</h3><p>Die Anmeldung prüft, ob du veröffentlichen darfst. Private Schlüssel bleiben ausschließlich im Cloudflare Worker.</p>{#if error}<p class="error-copy">{error}</p>{/if}<button class="primary large-action" id="publisher-login" onclick={login}>Sicher mit GitHub verbinden</button></article>
    {:else if state === 'loading'}
      <article class="publish-state"><span class="loader"></span><h3>Berechtigung wird geprüft</h3><p>Einen kleinen Moment …</p></article>
    {:else if state === 'review'}
      <article class="publish-state review-state"><span class="state-symbol ok">✓</span><h3>Bereit zur Veröffentlichung</h3><p>Nur dieses Level wird übertragen. Der Publisher erstellt die Spieldatei, führt die Tests aus und aktualisiert GitHub Pages.</p><div class="review-facts"><span><b>{studio.level.events.length}</b>Ereignisse</span><span><b>{studio.level.decorations.length}</b>Objekte</span><span><b>{studio.level.cutscenes.length}</b>Cutscenes</span></div>{#if !studio.validation.ok}<ul class="issue-list">{#each studio.validation.errors as issue}<li>{issue}</li>{/each}</ul>{/if}<button class="primary large-action" id="publisher-confirm" disabled={!studio.validation.ok} onclick={publish}>{studio.level.icon} „{studio.level.name.standard}“ veröffentlichen</button></article>
    {:else}
      <article class="publish-state progress-state" data-state={publication?.state || state}>
        <span class:failed={state === 'failed'} class:ok={state === 'published'} class="state-symbol">{state === 'published' ? '✓' : state === 'failed' ? '!' : '↻'}</span>
        <h3>{state === 'published' ? 'Level ist live!' : state === 'failed' ? 'Veröffentlichung gestoppt' : 'Veröffentlichung läuft'}</h3>
        <p>{error || publication?.detail || 'Die automatischen Schritte laufen im Hintergrund.'}</p>
        <div class="publication-steps">
          {#each steps as [id, label], index}
            {@const activeIndex = steps.findIndex(([entry]) => entry === publication?.state)}
            <div class:done={state === 'published' || index < activeIndex} class:active={index === activeIndex && state !== 'failed'}><i>{state === 'published' || index < activeIndex ? '✓' : index + 1}</i><span>{label}</span></div>
          {/each}
        </div>
        <div class="publish-actions">
          {#if state === 'failed'}<button onclick={() => { state = 'review'; publication = null; error = ''; }}>Noch einmal prüfen</button>{/if}
          {#if publication?.actionsUrl || publication?.prUrl}<a href={publication.actionsUrl || publication.prUrl} target="_blank" rel="noreferrer">Technische Details</a>{/if}
          {#if state === 'published' && publication?.gameUrl}<a class="primary button-link" href={publication.gameUrl} target="_blank" rel="noreferrer">Im Spiel öffnen →</a>{/if}
        </div>
      </article>
    {/if}
  </div>
</section>
