<script>
  import { onMount } from 'svelte';
  import { createPublisherClient } from '../publisher-client.js';

  let { studio } = $props();
  const publisher = createPublisherClient();
  let state = $state(publisher.configured ? 'login' : 'unavailable');
  let user = $state.raw(null);
  let publication = $state.raw(null);
  let error = $state('');
  let selectedIds = $state([]);
  let selectionInitialized = false;
  let polling = null;
  let candidates = $derived.by(() => { studio.revision; return studio.publishCandidates(); });
  let selectedCandidates = $derived(candidates.filter((entry) => selectedIds.includes(entry.id)));
  let selectionValid = $derived(selectedCandidates.length > 0 && selectedCandidates.every((entry) => entry.validation.ok));

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
    if (!selectionValid) { studio.notify('Bitte mindestens einen spielbaren Entwurf auswählen'); return; }
    state = 'progress'; error = ''; publication = { state: 'testing', detail: `${selectedCandidates.length === 1 ? 'Das Level wird' : `${selectedCandidates.length} Level werden`} an den sicheren Publisher übertragen.` };
    try {
      const result = await publisher.publish(selectedCandidates.map((entry) => entry.level));
      await poll(Number(result.publicationId));
    } catch (reason) { error = reason.message; state = 'failed'; }
  }

  function toggleLevel(id, checked) {
    selectedIds = checked ? [...new Set([...selectedIds, id])] : selectedIds.filter((entry) => entry !== id);
  }

  function selectAllValid() { selectedIds = candidates.filter((entry) => entry.validation.ok).map((entry) => entry.id); }
  function clearSelection() { selectedIds = []; }

  function logout() { publisher.clearSession(); user = null; publication = null; state = 'login'; }

  onMount(() => {
    publisher.consumeSessionFromLocation();
    if (publisher.authenticated) identify();
    return () => clearTimeout(polling);
  });

  $effect(() => {
    const available = new Set(candidates.map((entry) => entry.id));
    const retained = selectedIds.filter((id) => available.has(id));
    if (!selectionInitialized) {
      selectedIds = candidates.some((entry) => entry.id === studio.level.id && entry.validation.ok) ? [studio.level.id] : [];
      selectionInitialized = true;
    } else if (retained.length !== selectedIds.length) selectedIds = retained;
  });
</script>

<section class="workspace publish-workspace" aria-labelledby="publish-workspace-title">
  <header class="workspace-header">
    <div><span class="eyebrow">EIN KLICK · AUTOMATISCH GEPRÜFT</span><h2 id="publish-workspace-title">Veröffentlichen</h2><p>Hier wählst du deine Entwürfe aus. Sie werden gemeinsam geprüft, ins Spiel übertragen und anschließend auf GitHub Pages live gestellt.</p></div>
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
      <article class="publish-state review-state">
        <span class="state-symbol ok">✓</span><h3>Entwürfe auswählen</h3><p>Wähle ein oder mehrere Level. Alle ausgewählten Entwürfe landen gemeinsam in einer Veröffentlichung und werden zusammen geprüft.</p>
        <div class="publish-selection">
          <div class="publish-selection-toolbar"><strong>{selectedCandidates.length} von {candidates.length} ausgewählt</strong><div><button onclick={selectAllValid}>Alle spielbaren</button><button onclick={clearSelection}>Auswahl aufheben</button></div></div>
          {#each candidates as candidate}
            <label class="publish-candidate">
              <input type="checkbox" aria-label={`Level ${candidate.name} auswählen`} checked={selectedIds.includes(candidate.id)} onchange={(event) => toggleLevel(candidate.id, event.currentTarget.checked)} />
              <span>{candidate.level.icon}</span>
              <div><strong>{candidate.name}{candidate.current ? ' · geöffnet' : ''}</strong><small>{candidate.id} · {candidate.level.board.columns}×{candidate.level.board.rows} · {candidate.savedAt ? new Date(candidate.savedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : 'aktuelle Änderungen'}</small></div>
              <em class:invalid={!candidate.validation.ok}>{candidate.validation.ok ? '✓ spielbar' : `⚠ ${candidate.validation.errors.length}`}</em>
            </label>
          {/each}
        </div>
        {#if selectedCandidates.some((entry) => !entry.validation.ok)}<p class="error-copy">Mindestens ein ausgewählter Entwurf enthält Fehler. Entferne ihn aus der Auswahl oder korrigiere ihn zuerst.</p>{/if}
        <div class="review-facts"><span><b>{selectedCandidates.reduce((sum, entry) => sum + entry.level.events.length, 0)}</b>Ereignisse</span><span><b>{selectedCandidates.reduce((sum, entry) => sum + entry.level.decorations.length, 0)}</b>Objekte</span><span><b>{selectedCandidates.reduce((sum, entry) => sum + entry.level.cutscenes.length, 0)}</b>Cutscenes</span></div>
        <button class="primary large-action" id="publisher-confirm" disabled={!selectionValid} onclick={publish}>{selectedCandidates.length === 1 ? `${selectedCandidates[0]?.level.icon ?? ''} 1 Level veröffentlichen` : `${selectedCandidates.length} Level gemeinsam veröffentlichen`}</button>
      </article>
    {:else}
      <article class="publish-state progress-state" data-state={publication?.state || state}>
        <span class:failed={state === 'failed'} class:ok={state === 'published'} class="state-symbol">{state === 'published' ? '✓' : state === 'failed' ? '!' : '↻'}</span>
        <h3>{state === 'published' ? `${selectedCandidates.length === 1 ? 'Level ist' : 'Level sind'} live!` : state === 'failed' ? 'Veröffentlichung gestoppt' : 'Veröffentlichung läuft'}</h3>
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
