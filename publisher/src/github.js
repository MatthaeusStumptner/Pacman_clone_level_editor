import { base64UrlEncode } from './security.js';

const encoder = new TextEncoder();
let installationTokenCache = null;

function githubHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'franz-lola-publisher',
    'X-GitHub-Api-Version': '2026-03-10',
  };
}

async function responseJson(response, operation) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${operation} ist bei GitHub fehlgeschlagen (${response.status}): ${body.message ?? 'Unbekannter Fehler'}`);
  return body;
}

export async function importPrivateKey(pem) {
  const normalized = String(pem ?? '').replace(/\\n/g, '\n');
  const isPkcs1 = normalized.includes('-----BEGIN RSA PRIVATE KEY-----');
  const base64 = normalized.replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----|-----END (?:RSA )?PRIVATE KEY-----|\s/g, '');
  if (!base64) throw new Error('Der private GitHub-App-Schlüssel fehlt.');
  const binary = atob(base64);
  let bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (isPkcs1) {
    const der = (tag, content) => {
      const lengthBytes = content.length < 128
        ? [content.length]
        : (() => { const values = []; let length = content.length; while (length) { values.unshift(length & 255); length >>>= 8; } return [0x80 | values.length, ...values]; })();
      return Uint8Array.from([tag, ...lengthBytes, ...content]);
    };
    const version = Uint8Array.from([0x02, 0x01, 0x00]);
    const rsaAlgorithm = Uint8Array.from([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]);
    bytes = der(0x30, Uint8Array.from([...version, ...rsaAlgorithm, ...der(0x04, bytes)]));
  }
  return crypto.subtle.importKey('pkcs8', bytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

async function appJwt(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({ iat: now - 60, exp: now + 540, iss: String(env.GITHUB_APP_ID) }));
  const unsigned = `${header}.${payload}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await importPrivateKey(env.GITHUB_APP_PRIVATE_KEY), encoder.encode(unsigned));
  return `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function installationToken(env) {
  if (installationTokenCache?.expiresAt > Date.now() + 60_000) return installationTokenCache.token;
  const response = await fetch(`https://api.github.com/app/installations/${encodeURIComponent(env.GITHUB_INSTALLATION_ID)}/access_tokens`, {
    method: 'POST',
    headers: githubHeaders(await appJwt(env)),
    body: JSON.stringify({
      repositories: [env.GITHUB_REPO],
      permissions: { actions: 'read', contents: 'write', pull_requests: 'write' },
    }),
  });
  const result = await responseJson(response, 'GitHub-App-Anmeldung');
  installationTokenCache = { token: result.token, expiresAt: Date.parse(result.expires_at) };
  return result.token;
}

export async function githubRequest(env, path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: githubHeaders(token ?? await installationToken(env)),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return responseJson(response, path);
}

export async function exchangeGithubCode(env, code, redirectUri) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'franz-lola-publisher' },
    body: JSON.stringify({
      client_id: env.GITHUB_APP_CLIENT_ID,
      client_secret: env.GITHUB_APP_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const token = await responseJson(response, 'GitHub-Anmeldung');
  if (!token.access_token) throw new Error('GitHub hat kein Benutzer-Token geliefert.');
  return githubRequest(env, '/user', { token: token.access_token });
}

export function repositoryPath(env, suffix = '') {
  return `/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}${suffix}`;
}

function decodeContent(value) {
  const binary = atob(String(value ?? '').replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function encodeContent(value) {
  const bytes = encoder.encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

export async function readRepositoryFile(env, path, ref = env.GITHUB_BASE_BRANCH) {
  try {
    const file = await githubRequest(env, `${repositoryPath(env, `/contents/${path.split('/').map(encodeURIComponent).join('/')}`)}?ref=${encodeURIComponent(ref)}`);
    return { sha: file.sha, value: JSON.parse(decodeContent(file.content)) };
  } catch (error) {
    if (error.message.includes('(404)')) return null;
    throw error;
  }
}

export async function listPublishedLevels(env) {
  try {
    return await githubRequest(env, `${repositoryPath(env, '/contents/src/data/levels')}?ref=${encodeURIComponent(env.GITHUB_BASE_BRANCH)}`);
  } catch (error) {
    if (error.message.includes('(404)')) return [];
    throw error;
  }
}

export async function createPublication(env, { path, content, level, login, warnings }) {
  const baseBranch = env.GITHUB_BASE_BRANCH || 'main';
  const openPulls = await githubRequest(env, `${repositoryPath(env, '/pulls')}?state=open&base=${encodeURIComponent(baseBranch)}&per_page=100`);
  const pending = openPulls.find((pull) => pull.head?.ref?.startsWith(`publisher/${level.id}-`));
  if (pending) return { number: pending.number, url: pending.html_url, branch: pending.head.ref, reused: true };
  const base = await githubRequest(env, `${repositoryPath(env, `/git/ref/heads/${encodeURIComponent(baseBranch)}`)}`);
  const suffix = crypto.randomUUID().slice(0, 8);
  const branch = `publisher/${level.id}-${Date.now()}-${suffix}`;
  await githubRequest(env, repositoryPath(env, '/git/refs'), {
    method: 'POST',
    body: { ref: `refs/heads/${branch}`, sha: base.object.sha },
  });

  const existing = await readRepositoryFile(env, path, baseBranch);
  await githubRequest(env, repositoryPath(env, `/contents/${path.split('/').map(encodeURIComponent).join('/')}`), {
    method: 'PUT',
    body: {
      message: `content: ${level.name.standard} aus der Levelwerkstatt`,
      content: encodeContent(`${JSON.stringify(content, null, 2)}\n`),
      branch,
      ...(existing ? { sha: existing.sha } : {}),
    },
  });

  const pullRequest = await githubRequest(env, repositoryPath(env, '/pulls'), {
    method: 'POST',
    body: {
      title: `Level veröffentlichen: ${level.name.standard}`,
      head: branch,
      base: baseBranch,
      body: [
        `Automatisch aus der Franz-&-Lola-Levelwerkstatt veröffentlicht.`,
        ``,
        `Redaktion: @${login}`,
        `Level-ID: \`${level.id}\``,
        `Prüfhinweise: ${warnings.length ? warnings.join(' · ') : 'keine'}`,
      ].join('\n'),
    },
  });
  return { number: pullRequest.number, url: pullRequest.html_url, branch };
}

export async function publicationStatus(env, number) {
  const pull = await githubRequest(env, repositoryPath(env, `/pulls/${number}`));
  if (pull.state === 'closed' && !pull.merged_at) return { state: 'failed', detail: 'Die Veröffentlichung wurde geschlossen.' };
  const sha = pull.merged_at ? pull.merge_commit_sha : pull.head.sha;
  const runs = await githubRequest(env, `${repositoryPath(env, '/actions/runs')}?head_sha=${encodeURIComponent(sha)}&per_page=20`);
  const relevant = runs.workflow_runs?.find((run) => pull.merged_at
    ? run.name === 'Deploy to GitHub Pages'
    : run.name === 'Validate and publish editor content');
  if (!pull.merged_at) {
    if (relevant?.status === 'completed' && relevant.conclusion !== 'success') return { state: 'failed', detail: 'Die automatischen Prüfungen sind fehlgeschlagen.', actionsUrl: relevant.html_url };
    return { state: 'testing', detail: 'GitHub prüft das Level.', actionsUrl: relevant?.html_url };
  }
  if (!relevant || relevant.status !== 'completed') return { state: 'deploying', detail: 'Das Spiel wird auf GitHub Pages veröffentlicht.', actionsUrl: relevant?.html_url };
  if (relevant.conclusion !== 'success') return { state: 'failed', detail: 'Der GitHub-Pages-Deploy ist fehlgeschlagen.', actionsUrl: relevant.html_url };
  return { state: 'published', detail: 'Das Level ist live.', actionsUrl: relevant.html_url, gameUrl: env.GAME_URL, commit: sha };
}
