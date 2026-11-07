import { readFile } from 'node:fs/promises';
import { validateSnapshot, normalizeToolbox } from '../src/prices.ts';

const snapshot = validateSnapshot(JSON.parse(await readFile('public/data/prices.json', 'utf8')));
const raw = JSON.parse(await readFile('public/data/toolbox-raw.json', 'utf8'));
if (JSON.stringify(normalizeToolbox(raw)) !== JSON.stringify(snapshot)) {
  throw new Error('Normalized snapshot does not match the retained raw response');
}
console.log(`Price schema v${snapshot.schemaVersion} verified: ${Object.keys(snapshot.materials).length} materials.`);
