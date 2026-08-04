const SESSION_FRAGMENT_KEY = 'publisher_session';

function normalizePublisherUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    const isLocalDevelopment = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !isLocalDevelopment) return '';
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

async function errorMessage(response) {
  const body = await response.json().catch(() => ({}));
  return body.error || `Der Publisher antwortet mit Status ${response.status}.`;
}

export class PublisherClient {
  #baseUrl;
  #fetch;
  #sessionToken = '';

  constructor({ baseUrl = '', fetchImpl = globalThis.fetch } = {}) {
    this.#baseUrl = normalizePublisherUrl(baseUrl);
    this.#fetch = fetchImpl.bind(globalThis);
  }

  get configured() {
    return Boolean(this.#baseUrl);
  }

  get authenticated() {
    return Boolean(this.#sessionToken);
  }

  consumeSessionFromLocation(location = globalThis.location, history = globalThis.history) {
    if (!location?.hash) return false;
    const fragment = new URLSearchParams(location.hash.slice(1));
    const token = fragment.get(SESSION_FRAGMENT_KEY) ?? '';
    fragment.delete(SESSION_FRAGMENT_KEY);
    if (token && token.length <= 4096 && /^[A-Za-z0-9._~-]+$/.test(token)) this.#sessionToken = token;
    const remainingHash = fragment.toString();
    const cleanUrl = `${location.pathname ?? '/'}${location.search ?? ''}${remainingHash ? `#${remainingHash}` : ''}`;
    history?.replaceState?.(null, '', cleanUrl);
    return Boolean(this.#sessionToken);
  }

  clearSession() {
    this.#sessionToken = '';
  }

  loginUrl(returnTo = globalThis.location?.href ?? '') {
    if (!this.configured) return '';
    const url = new URL('/auth/login', `${this.#baseUrl}/`);
    const returnUrl = new URL(returnTo);
    returnUrl.hash = '';
    url.searchParams.set('return_to', returnUrl.toString());
    return url.toString();
  }

  async #request(path, options = {}) {
    if (!this.configured) throw new Error('Der Publisher ist noch nicht eingerichtet.');
    if (!this.#sessionToken) throw new Error('Bitte zuerst mit GitHub anmelden.');
    const response = await this.#fetch(`${this.#baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.#sessionToken}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
    if (response.status === 401) this.clearSession();
    if (!response.ok) throw new Error(await errorMessage(response));
    return response.json();
  }

  me() {
    return this.#request('/api/me');
  }

  publish(levels) {
    const selected = Array.isArray(levels) ? levels : [levels];
    if (!selected.length) throw new Error('Bitte mindestens einen Entwurf auswählen.');
    return this.#request('/api/publish', { method: 'POST', body: JSON.stringify({ levels: selected }) });
  }

  publication(publicationId) {
    if (!Number.isInteger(publicationId) || publicationId < 1) throw new Error('Ungültige Veröffentlichungsnummer.');
    return this.#request(`/api/publications/${publicationId}`);
  }
}

export function createPublisherClient(options = {}) {
  const configuredUrl = options.baseUrl ?? import.meta.env?.VITE_PUBLISHER_URL ?? '';
  return new PublisherClient({ ...options, baseUrl: configuredUrl });
}

export { normalizePublisherUrl };
