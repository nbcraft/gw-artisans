import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { normalizeToolbox } from '../src/prices.ts';
import { fixtureRaw } from './fixture.ts';

test('data branch round-trip preserves main, restores snapshots, and skips duplicate commits', () => {
  const directory = mkdtempSync(join(tmpdir(), 'artisan-git-test-'));
  const script = resolve('scripts/price-branch.mjs');
  const git = (args: string[], cwd = directory) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  try {
    git(['init', '--bare', 'remote.git']);
    git(['init', '-b', 'main', 'source']);
    const source = join(directory, 'source');
    const invoke = (action: string) => execFileSync(process.execPath, [script, action], { cwd: source, encoding: 'utf8' });
    git(['config', 'user.name', 'Test'], source);
    git(['config', 'user.email', 'test@example.invalid'], source);
    git(['remote', 'add', 'origin', join(directory, 'remote.git')], source);
    writeFileSync(join(source, 'README.md'), 'Source stays here.\n');
    git(['add', 'README.md'], source);
    git(['commit', '-m', 'Initial source'], source);
    git(['push', 'origin', 'main'], source);
    const originalHead = git(['rev-parse', 'HEAD'], source);
    mkdirSync(join(source, 'public/data'), { recursive: true });
    const raw = fixtureRaw();
    const normalized = normalizeToolbox(raw);
    writeFileSync(join(source, 'public/data/prices.json'), `${JSON.stringify(normalized, null, 2)}\n`);
    writeFileSync(join(source, 'public/data/toolbox-raw.json'), `${JSON.stringify(raw)}\n`);
    assert.match(invoke('restore'), /has_saved_snapshot=false/);
    assert.match(invoke('compare'), /changed=true/);
    invoke('publish');
    invoke('restore');
    assert.match(invoke('compare'), /changed=false/);
    const dataHead = git(['rev-parse', 'refs/remotes/origin/price-data'], source);
    invoke('publish');
    assert.equal(git(['rev-parse', 'refs/remotes/origin/price-data'], source), dataHead);
    assert.deepEqual(git(['ls-tree', '--name-only', dataHead], source).split('\n').sort(), ['prices.json', 'toolbox-raw.json']);
    writeFileSync(join(source, 'public/data/prices.json'), 'corrupted');
    invoke('restore');
    assert.deepEqual(JSON.parse(readFileSync(join(source, 'public/data/prices.json'), 'utf8')), normalized);
    assert.equal(git(['rev-parse', 'HEAD'], source), originalHead);
    assert.equal(git(['branch', '--show-current'], source), 'main');
    assert.equal(readFileSync(join(source, 'README.md'), 'utf8'), 'Source stays here.\n');
    // A second valid snapshot follows the existing data branch without force-push.
    raw.buy['0b03a1'].p += 10;
    writeFileSync(join(source, 'public/data/prices.json'), `${JSON.stringify(normalizeToolbox(raw), null, 2)}\n`);
    writeFileSync(join(source, 'public/data/toolbox-raw.json'), `${JSON.stringify(raw)}\n`);
    assert.match(invoke('compare'), /changed=true/);
    invoke('publish');
    invoke('restore');
    // Read the commit itself: a depth-one checkout deliberately hides ancestry.
    assert.ok(git(['cat-file', '-p', 'refs/remotes/origin/price-data'], source).includes(`parent ${dataHead}\n`));
    assert.match(invoke('compare'), /changed=false/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
