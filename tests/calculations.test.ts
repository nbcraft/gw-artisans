import assert from 'node:assert/strict';
import test from 'node:test';
import { materials, recipes, routesFor } from '../src/catalog.ts';
import { evaluateRecipe } from '../src/calculations.ts';
import { normalizeToolbox, validateSnapshot, unitPrice } from '../src/prices.ts';
import { fixtureRaw } from './fixture.ts';

test('normalize every material into a stable schema and preserve lot sizes and quote timestamps', () => {
  const raw = fixtureRaw();
  const snapshot = normalizeToolbox(raw);
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(Object.keys(snapshot.materials).length, 36);
  assert.equal(snapshot.materials.dust.sell.quantity, 10);
  assert.equal(snapshot.materials.glass.sell.quantity, 1);
  assert.equal(snapshot.materials.dust.sell.observedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(unitPrice(snapshot, 'dust', 'sell'), 28);
  assert.equal(validateSnapshot(snapshot), snapshot);
  assert.deepEqual(normalizeToolbox(raw), normalizeToolbox(raw), 'Conversion is deterministic');
});

test('reject malformed, partial, future-dated, or incorrectly identified upstream quotes', () => {
  const raw = fixtureRaw();
  delete raw.sell[materials[0].toolboxId];
  assert.throws(() => normalizeToolbox(raw));
  const badPrice = fixtureRaw();
  badPrice.sell['0b03a1'].p = 0;
  assert.throws(() => normalizeToolbox(badPrice), /price/);
  const badId = fixtureRaw();
  badId.sell['0b03a1'].m = 'wrong';
  assert.throws(() => normalizeToolbox(badId), /identifier/);
  assert.throws(() => normalizeToolbox({ ...fixtureRaw(), updated_at: 99_999_999_999 }), /future/);
});

test('page rejects unknown schema versions or incorrect normalized lot sizes', () => {
  const snapshot = normalizeToolbox(fixtureRaw());
  assert.throws(() => validateSnapshot({ ...snapshot, schemaVersion: 2 }), /schema/);
  snapshot.materials.dust.sell.quantity = 1;
  assert.throws(() => validateSnapshot(snapshot), /quote/);
});

test('all 13 recipes and 3 alternative routes have unique IDs', () => {
  const rows = recipes.flatMap(routesFor);
  assert.equal(recipes.length, 13);
  assert.equal(rows.length, 16);
  assert.equal(new Set(rows.map(row => row.id)).size, 16);
});

test('benefit subtracts sale opportunity cost, not ingredient buy prices', () => {
  const snapshot = normalizeToolbox(fixtureRaw());
  const recipe = recipes.find(r => r.output === 'damask')!;
  const result = evaluateRecipe(routesFor(recipe)[0], snapshot);
  assert.equal(result.ingredientValue, 590); // 5 fiber at 90 + 5 dust at 28
  assert.equal(result.salePrice, 950);
  assert.equal(result.fee, 200);
  assert.equal(result.benefit, 160);
  assert.notEqual(snapshot.materials.dust.buy.gold, snapshot.materials.dust.sell.gold);
});

test('glass-to-ink chain includes both fees and original dust/fiber opportunity costs', () => {
  const snapshot = normalizeToolbox(fixtureRaw());
  const ink = recipes.find(r => r.output === 'ink')!;
  const [direct, chained] = routesFor(ink).map(r => evaluateRecipe(r, snapshot));
  assert.equal(direct.benefit, 70);
  assert.equal(chained.fee, 40);
  assert.equal(chained.ingredientValue, 500);
  assert.equal(chained.benefit, 110);
  assert.deepEqual(chained.ingredients.map(i => [i.material, i.quantity]), [['plant-fiber', 4], ['dust', 5]]);
});

test('charcoal expansion includes its wood and fee; break-even is exactly zero', () => {
  const snapshot = normalizeToolbox(fixtureRaw());
  const deldrimor = recipes.find(r => r.output === 'deldrimor-steel')!;
  const rows = routesFor(deldrimor).map(r => evaluateRecipe(r, snapshot));
  assert.equal(rows[1].fee, 400);
  assert.equal(rows[1].ingredientValue, 350);
  assert.equal(rows[0].benefit, 350);
  assert.equal(rows[1].benefit, 350);
  const charcoal = recipes.find(r => r.output === 'charcoal')!;
  assert.equal(evaluateRecipe(routesFor(charcoal)[0], snapshot).benefit, 0);
});

test('recipe inputs all refer to known materials, including rare inputs', () => {
  const ids = new Set(materials.map(m => m.id));
  for (const recipe of recipes) {
    assert.ok(ids.has(recipe.output));
    for (const input of recipe.ingredients) assert.ok(ids.has(input.material));
  }
});
