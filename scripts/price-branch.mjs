import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { validateSnapshot, normalizeToolbox } from '../src/prices.ts';

const branch = 'price-data';
const files = ['prices.json', 'toolbox-raw.json'];
const git = (args, input) => execFileSync('git', args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const action = process.argv[2];
const output = (key, value) => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  console.log(`${key}=${value}`);
};

if (action === 'restore') {
  // Distinguish a missing branch (first deployment) from a failed fetch.
  const exists = git(['ls-remote', '--heads', 'origin', `refs/heads/${branch}`]);
  if (!exists) {
    output('has_saved_snapshot', 'false');
    console.log('First run: using the bundled snapshot as a fallback.');
  } else {
    git(['fetch', '--no-tags', 'origin', `refs/heads/${branch}:refs/remotes/origin/${branch}`, '--depth=1']);
    const data = files.map(file => git(['show', `refs/remotes/origin/${branch}:${file}`]));
    const normalized = validateSnapshot(JSON.parse(data[0]));
    if (JSON.stringify(normalizeToolbox(JSON.parse(data[1]))) !== JSON.stringify(normalized)) {
      throw new Error('Saved raw and normalized snapshots do not match');
    }
    files.forEach((file, i) => writeFileSync(`public/data/${file}`, `${data[i]}\n`));
    output('has_saved_snapshot', 'true');
    console.log('Restored the last valid price snapshot.');
  }
} else if (action === 'compare') {
  let previous;
  try { previous = git(['show', `refs/remotes/origin/${branch}:prices.json`]); } catch { /* New data branch. */ }
  const current = readFileSync('public/data/prices.json', 'utf8').trim();
  output('changed', current !== previous ? 'true' : 'false');
} else if (action === 'publish') {
  // Create a commit containing only the two data files, without switching the
  // source checkout or mixing frequent data updates into source history.
  const entries = files.map(file => {
    const blob = git(['hash-object', '-w', '--stdin'], readFileSync(`public/data/${file}`));
    return `100644 blob ${blob}\t${file}\n`;
  }).join('');
  const tree = git(['mktree'], entries);
  let parent;
  try { parent = git(['rev-parse', '--verify', `refs/remotes/origin/${branch}`]); } catch { /* First data commit. */ }
  if (parent && git(['rev-parse', `${parent}^{tree}`]) === tree) {
    console.log('Snapshot unchanged; no data commit needed.');
    process.exit(0);
  }
  git(['config', 'user.name', 'github-actions[bot]']);
  git(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
  const args = ['commit-tree', tree];
  if (parent) args.push('-p', parent);
  const commit = git(args, 'Refresh trader price snapshot\n');
  git(['push', 'origin', `${commit}:refs/heads/${branch}`]);
  console.log('Saved the price snapshot on price-data.');
} else {
  throw new Error('Expected restore, compare, or publish');
}
