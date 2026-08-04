import test from 'node:test';
import assert from 'node:assert/strict';
import { PublisherClient, normalizePublisherUrl } from '../src/publisher-client.js';

test('publisher URLs require HTTPS except on local development', () => {
  assert.equal(normalizePublisherUrl('https://publisher.example/'), 'https://publisher.example');
  assert.equal(normalizePublisherUrl('http://publisher.example'), '');
  assert.equal(normalizePublisherUrl('javascript:alert(1)'), '');
  assert.equal(normalizePublisherUrl('http://localhost:8787/'), 'http://localhost:8787');
});

test('OAuth session is consumed from the fragment and removed immediately', async () => {
  let cleanedUrl = '';
  const requests = [];
  const client = new PublisherClient({
    baseUrl: 'https://publisher.example',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({ login: 'freundin', name: 'Freundin' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });
  assert.equal(client.consumeSessionFromLocation(
    { hash: '#publisher_session=abc.def-123&tab=level', pathname: '/editor/', search: '?level=hals' },
    { replaceState: (_state, _title, url) => { cleanedUrl = url; } },
  ), true);
  assert.equal(cleanedUrl, '/editor/?level=hals#tab=level');
  assert.deepEqual(await client.me(), { login: 'freundin', name: 'Freundin' });
  assert.equal(requests[0].options.headers.Authorization, 'Bearer abc.def-123');
});

test('session stays in memory and is cleared after unauthorized responses', async () => {
  const client = new PublisherClient({
    baseUrl: 'https://publisher.example',
    fetchImpl: async () => new Response(JSON.stringify({ error: 'Bitte erneut anmelden.' }), { status: 401, headers: { 'Content-Type': 'application/json' } }),
  });
  client.consumeSessionFromLocation(
    { hash: '#publisher_session=temporary', pathname: '/', search: '' },
    { replaceState() {} },
  );
  await assert.rejects(client.me(), /erneut anmelden/);
  assert.equal(client.authenticated, false);
});

test('publishing sends all selected level documents in one request', async () => {
  let body;
  const client = new PublisherClient({
    baseUrl: 'https://publisher.example',
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return new Response(JSON.stringify({ publicationId: 7, state: 'testing' }), { status: 202, headers: { 'Content-Type': 'application/json' } });
    },
  });
  client.consumeSessionFromLocation({ hash: '#publisher_session=token', pathname: '/', search: '' }, { replaceState() {} });
  const selected = [{ id: 'hals', name: { standard: 'Hals' } }, { id: 'home', name: { standard: 'Bramerhof' } }];
  const result = await client.publish(selected);
  assert.deepEqual(body, { levels: selected });
  assert.equal(result.publicationId, 7);
});
