import { createPublication, exchangeGithubCode, listPublishedLevels, publicationStatus, readRepositoryFile } from './github.js';
import { preparePublishedBatch, preparePublishedLevel, publishLevelsFromBody, readPublishBody } from './level-publication.js';
import {
  bearerToken,
  corsHeaders,
  isAllowedLogin,
  requestOriginAllowed,
  safeReturnUrl,
  securityHeaders,
  signToken,
  verifyToken,
} from './security.js';

function response(body, { status = 200, headers = {}, request, env } = {}) {
  return new Response(body, {
    status,
    headers: {
      ...securityHeaders(),
      ...(request && env ? corsHeaders(request, env) : {}),
      ...headers,
    },
  });
}

function json(value, options = {}) {
  return response(JSON.stringify(value), { ...options, headers: { 'Content-Type': 'application/json; charset=utf-8', ...options.headers } });
}

function redirect(location, headers = {}) {
  return response(null, { status: 302, headers: { Location: location, ...headers } });
}

function cookieValue(request, name) {
  const cookies = request.headers.get('Cookie') ?? '';
  const match = cookies.split(';').map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

function oauthCookie(value, maxAge = 600) {
  return `publisher_oauth_state=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/auth/callback; HttpOnly; Secure; SameSite=Lax`;
}

async function authenticatedSession(request, env) {
  const payload = await verifyToken(bearerToken(request), env.SESSION_SECRET, 'publisher-session');
  if (!payload || !isAllowedLogin(payload.login, env)) return null;
  return payload;
}

async function login(request, env) {
  const url = new URL(request.url);
  const returnTo = safeReturnUrl(url.searchParams.get('return_to'), env);
  if (!returnTo) return response('Ungültige Rücksprungadresse.', { status: 400 });
  const state = await signToken({
    type: 'oauth-state',
    returnTo,
    nonce: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + 600,
  }, env.SESSION_SECRET);
  const callback = new URL('/auth/callback', url.origin).toString();
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', env.GITHUB_APP_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', callback);
  authorize.searchParams.set('state', state);
  return redirect(authorize.toString(), { 'Set-Cookie': oauthCookie(state) });
}

async function callback(request, env) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') ?? '';
  const stateCookie = cookieValue(request, 'publisher_oauth_state');
  const payload = state && state === stateCookie ? await verifyToken(state, env.SESSION_SECRET, 'oauth-state') : null;
  const returnTo = payload ? safeReturnUrl(payload.returnTo, env) : null;
  if (!payload || !returnTo) return response('Die Anmeldung ist abgelaufen oder ungültig.', { status: 400, headers: { 'Set-Cookie': oauthCookie('', 0) } });
  const code = url.searchParams.get('code');
  if (!code || code.length > 512) return response('GitHub hat keinen gültigen Anmeldecode geliefert.', { status: 400, headers: { 'Set-Cookie': oauthCookie('', 0) } });
  const user = await exchangeGithubCode(env, code, url.origin + url.pathname);
  if (!isAllowedLogin(user.login, env)) return response('Dieser GitHub-Account ist nicht als Redaktion freigeschaltet.', { status: 403, headers: { 'Set-Cookie': oauthCookie('', 0) } });
  const session = await signToken({
    type: 'publisher-session',
    login: user.login,
    name: user.name || user.login,
    nonce: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + 1800,
  }, env.SESSION_SECRET);
  const destination = new URL(returnTo);
  destination.hash = new URLSearchParams({ publisher_session: session }).toString();
  return redirect(destination.toString(), { 'Set-Cookie': oauthCookie('', 0) });
}

async function publish(request, env, session) {
  const body = await readPublishBody(request);
  const levels = publishLevelsFromBody(body);
  const publishedFiles = await listPublishedLevels(env);
  const initial = levels.map((level, index) => preparePublishedLevel(level, { existing: null, nextMapOrder: publishedFiles.length + index }));
  const existingFiles = await Promise.all(initial.map((entry) => readRepositoryFile(env, entry.path)));
  const existingByPath = new Map(initial.map((entry, index) => [entry.path, existingFiles[index]?.value ?? null]));
  const prepared = preparePublishedBatch(levels, { existingByPath, nextMapOrder: publishedFiles.length });
  const publication = await createPublication(env, {
    files: prepared.map((entry) => ({ path: entry.path, content: entry.value, level: entry.value, warnings: entry.warnings })),
    login: session.login,
  });
  const warnings = prepared.flatMap((entry) => entry.warnings.map((warning) => `${entry.value.name.standard}: ${warning}`));
  return json({
    publicationId: publication.number,
    state: 'testing',
    detail: `${prepared.length === 1 ? 'Das Level wurde' : `${prepared.length} Level wurden`} übertragen und werden automatisch geprüft.`,
    prUrl: publication.url,
    warnings,
    levelIds: prepared.map((entry) => entry.value.id),
  }, { status: 202, request, env });
}

async function api(request, env, path) {
  if (!requestOriginAllowed(request, env)) return json({ error: 'Nicht erlaubter Ursprung.' }, { status: 403, request, env });
  if (request.method === 'OPTIONS') return response(null, { status: 204, request, env });
  const session = await authenticatedSession(request, env);
  if (!session) return json({ error: 'Bitte erneut mit GitHub anmelden.' }, { status: 401, request, env });
  if (path === '/api/me' && request.method === 'GET') return json({ login: session.login, name: session.name, expiresAt: session.exp }, { request, env });
  if (path === '/api/publish' && request.method === 'POST') return publish(request, env, session);
  const publicationMatch = /^\/api\/publications\/(\d+)$/.exec(path);
  if (publicationMatch && request.method === 'GET') {
    return json(await publicationStatus(env, Number(publicationMatch[1])), { request, env });
  }
  return json({ error: 'API-Endpunkt nicht gefunden.' }, { status: 404, request, env });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/auth/login' && request.method === 'GET') return login(request, env);
      if (url.pathname === '/auth/callback' && request.method === 'GET') return callback(request, env);
      if (url.pathname.startsWith('/api/')) return api(request, env, url.pathname);
      if (url.pathname === '/health') return json({ ok: true, service: 'franz-lola-publisher' });
      return response('Nicht gefunden.', { status: 404 });
    } catch (error) {
      console.error(JSON.stringify({ message: 'publisher request failed', error: error instanceof Error ? error.message : 'Unbekannter Fehler', path: url.pathname }));
      const expected = error instanceof SyntaxError || /Level|Entwurf|JSON|Veröffentlich|GitHub|64 × 64|mehr als|nicht erlaubt|größer|höchstens|vorkommen/.test(error?.message ?? '');
      return json({ error: expected ? error.message : 'Die Veröffentlichung konnte nicht abgeschlossen werden.' }, {
        status: expected ? 400 : 500,
        request: url.pathname.startsWith('/api/') ? request : undefined,
        env: url.pathname.startsWith('/api/') ? env : undefined,
      });
    }
  },
};
