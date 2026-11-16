import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mobileBuildConfiguration } from './mobile-build-config.mjs';

test('local backend configuration persists across builds and environment can override it', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'palmera-v2-config-'));
  const file = path.join(root, 'mobile-v2.local.json');
  try {
    assert.deepEqual(mobileBuildConfiguration(root, {}), { backendUrl: '' });
    fs.writeFileSync(
      file,
      JSON.stringify({ backendUrl: 'https://staging.example.com/' }),
    );
    assert.deepEqual(mobileBuildConfiguration(root, {}), {
      backendUrl: 'https://staging.example.com',
    });
    assert.deepEqual(
      mobileBuildConfiguration(root, {
        PALMERA_BACKEND_URL: 'https://override.example.com',
      }),
      { backendUrl: 'https://override.example.com' },
    );
    assert.throws(() =>
      mobileBuildConfiguration(root, {
        PALMERA_BACKEND_URL: 'https://user:secret@example.com',
      }),
    );
    assert.throws(() =>
      mobileBuildConfiguration(root, {
        PALMERA_BACKEND_URL: 'https://example.com/api',
      }),
    );
  } finally {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(root);
  }
});
