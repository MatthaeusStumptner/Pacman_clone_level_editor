import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { importPrivateKey } from '../src/github.js';

test('GitHub App keys work in both generated PKCS#1 and PKCS#8 PEM formats', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });
  for (const type of ['pkcs1', 'pkcs8']) {
    const pem = privateKey.export({ type, format: 'pem' }).toString();
    const imported = await importPrivateKey(pem);
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', imported, new TextEncoder().encode('franz-und-lola'));
    assert.ok(signature.byteLength > 0, `${type} key should sign a JWT payload`);
  }
});
