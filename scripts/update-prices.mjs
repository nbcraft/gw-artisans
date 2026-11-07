import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { normalizeToolbox, validateSnapshot } from '../src/prices.ts';

const directory = resolve('public/data');
const destination = resolve(directory, 'prices.json');
const rawPath = resolve(directory, 'toolbox-raw.json');

try {
  // One request per run; timeout instead of hanging a scheduled workflow.
  const response = await fetch('https://kamadan.gwtoolbox.com/trader_quotes', {
    signal: AbortSignal.timeout(25_000),
    headers: { Accept: 'application/json', 'User-Agent': 'GuildWarsArtisanLedger/0.1 (GitHub Actions snapshot)' },
  });
  if (!response.ok) throw new Error(`Toolbox returned HTTP ${response.status}`);
  const body = await response.text();
  if (body.length > 5_000_000) throw new Error('Unexpectedly large response');
  const raw = JSON.parse(body);
  const snapshot = validateSnapshot(normalizeToolbox(raw));
  let previous;
  try { previous = validateSnapshot(JSON.parse(await readFile(destination, 'utf8'))); } catch { /* First valid snapshot. */ }
  if (previous && snapshot.source.updatedAt < previous.source.updatedAt) {
    throw new Error('Source returned an older snapshot; retaining the newer data');
  }
  await mkdir(directory, { recursive: true });
  // Validate everything before writing; normalized data is replaced atomically.
  await writeFile(`${rawPath}.tmp`, `${JSON.stringify(raw)}\n`);
  await writeFile(`${destination}.tmp`, `${JSON.stringify(snapshot, null, 2)}\n`);
  await rename(`${rawPath}.tmp`, rawPath);
  await rename(`${destination}.tmp`, destination);
  console.log(`Saved ${Object.keys(snapshot.materials).length} materials. Source updated ${snapshot.source.updatedAt}.`);
} catch (error) {
  console.error(`Price refresh failed: ${error.message}. Existing snapshot was preserved.`);
  process.exitCode = 1;
}
