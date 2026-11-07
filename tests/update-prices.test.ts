import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { normalizeToolbox } from '../src/prices.ts';
import { fixtureRaw } from './fixture.ts';

test('updater preserves both files on HTTP errors, partial data, or older snapshots; valid data replaces both', () => {
  const directory = mkdtempSync(join(tmpdir(), 'artisan-update-test-'));
  const script = resolve('scripts/update-prices.mjs');
  const raw = fixtureRaw();
  const priceFile = join(directory, 'public/data/prices.json');
  const rawFile = join(directory, 'public/data/toolbox-raw.json');
  const mockFile = join(directory, 'mock-fetch.mjs');
  try {
    mkdirSync(join(directory, 'public/data'), { recursive: true });
    writeFileSync(priceFile, JSON.stringify(normalizeToolbox(raw)));
    writeFileSync(rawFile, JSON.stringify(raw));
    const before = [readFileSync(priceFile, 'utf8'), readFileSync(rawFile, 'utf8')];
    const mockResponse = (payload: unknown, ok = true) => writeFileSync(mockFile,
      `globalThis.fetch = async () => ({ ok: ${ok}, status: ${ok ? 200 : 502}, text: async () => ${JSON.stringify(JSON.stringify(payload))} });\n`);
    const execute = () => spawnSync(process.execPath, ['--import', pathToFileURL(mockFile).href, script], { cwd: directory, encoding: 'utf8' });
    mockResponse({}, false);
    assert.equal(execute().status, 1);
    mockResponse({ ...raw, sell: {} });
    assert.equal(execute().status, 1);
    mockResponse({ ...raw, updated_at: raw.updated_at - 1 });
    assert.equal(execute().status, 1);
    assert.deepEqual([readFileSync(priceFile, 'utf8'), readFileSync(rawFile, 'utf8')], before);
    raw.updated_at += 100;
    raw.buy['0b03a1'].p += 20;
    mockResponse(raw);
    const result = execute();
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(readFileSync(priceFile, 'utf8')), normalizeToolbox(raw));
    assert.deepEqual(JSON.parse(readFileSync(rawFile, 'utf8')), raw);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
