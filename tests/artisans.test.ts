import assert from 'node:assert/strict';
import test from 'node:test';
import { stat } from 'node:fs/promises';
import { artisans, artisansFor, campaigns, convenienceRanks } from '../src/artisans.ts';
import { recipes } from '../src/catalog.ts';

test('all artisans have unique identities, valid campaign and recipe references, and bundled maps', async () => {
  assert.equal(artisans.length, 32);
  assert.equal(new Set(artisans.map(artisan => artisan.id)).size, artisans.length);
  const outputs = new Set(recipes.map(recipe => recipe.output));
  for (const artisan of artisans) {
    assert.ok(campaigns.includes(artisan.campaign), artisan.name);
    assert.ok(artisan.name && artisan.location, artisan.id);
    assert.equal(new URL(artisan.wikiUrl).origin, 'https://wiki.guildwars.com');
    assert.equal(new URL(artisan.mapUrl).origin, 'https://wiki.guildwars.com');
    assert.ok(artisan.materials.length > 0, artisan.name);
    assert.equal(new Set(artisan.materials).size, artisan.materials.length, artisan.name);
    for (const material of artisan.materials) assert.ok(outputs.has(material), `${artisan.name}: ${material}`);
    assert.match(artisan.mapPath ?? '', /^maps\/artisans\/[a-z-]+\.(?:jpg|png)$/);
    assert.ok((await stat(new URL(`../public/${artisan.mapPath}`, import.meta.url))).size > 1000);
  }
  for (const output of outputs) assert.ok(artisansFor(output).length > 0, output);
});

test('convenience ranks select only artisans offering the recipe and retain all matches', () => {
  const ranks = { 'shalgrim-stonehart': 1, 'crafter-magnor': 2, 'artisan-daved': 0 };
  const ranked = artisansFor('deldrimor-steel', ranks);
  assert.equal(ranked[0].id, 'shalgrim-stonehart');
  assert.equal(ranked[1].id, 'crafter-magnor');
  assert.equal(ranked.some(artisan => artisan.id === 'artisan-daved'), false);
  assert.deepEqual(new Set(ranked.map(artisan => artisan.id)), new Set(artisansFor('deldrimor-steel', {}).map(artisan => artisan.id)));
  assert.deepEqual(artisansFor('nonexistent-material'), []);
});

test('all 32 convenience ranks cover known artisans with unique positions', () => {
  assert.deepEqual(new Set(Object.keys(convenienceRanks)), new Set(artisans.map(artisan => artisan.id)));
  assert.deepEqual(Object.values(convenienceRanks).sort((a, b) => a - b), Array.from({ length: 32 }, (_, i) => i + 1));
});

test('all 13 featured choices follow the convenience order', () => {
  const featuredByMaterial: Record<string, string> = {
    damask: 'kainu', linen: 'artisan-daved', silk: 'kainu',
    'deldrimor-steel': 'crafter-magnor', 'elonian-leather': 'kainu',
    leather: 'xue-yi', charcoal: 'xue-yi', parchment: 'xue-yi',
    vellum: 'kainu', spiritwood: 'xue-yi', steel: 'xue-yi', glass: 'xue-yi', ink: 'xue-yi',
  };
  assert.deepEqual(Object.keys(featuredByMaterial).sort(), recipes.map(recipe => recipe.output).sort());
  for (const { output } of recipes) {
    const matching = artisansFor(output);
    assert.equal(matching[0].id, featuredByMaterial[output], output);
  }
});

test('Torgil and Orpah use the selected archived map references', () => {
  assert.equal(artisans.find(artisan => artisan.id === 'crafter-torgil')!.mapUrl,
    'https://wiki.guildwars.com/images/archive/d/db/20091207200351%21Nicholas_the_Traveler_Deldrimor_Bowl_map.jpg');
  assert.equal(artisans.find(artisan => artisan.id === 'artisan-orpah')!.mapUrl,
    'https://wiki.guildwars.com/images/archive/3/34/20090908185748%21Nicholas_the_Traveler_Tangle_Root_map.jpg');
});

test('recipe exceptions match the verified wiki and in-game evidence', () => {
  const shalgrim = artisans.find(artisan => artisan.id === 'shalgrim-stonehart')!;
  const shanda = artisans.find(artisan => artisan.id === 'shanda-ginkit')!;
  assert.ok(shalgrim.materials.includes('deldrimor-steel'));
  assert.equal(shalgrim.materials.includes('steel'), false);
  assert.ok(shanda.materials.includes('steel'));
  assert.equal(shanda.materials.includes('deldrimor-steel'), false);
  assert.equal(shanda.materials.includes('charcoal'), false);
  assert.deepEqual(artisans.find(artisan => artisan.id === 'pakasah')!.materials,
    ['damask', 'silk', 'elonian-leather', 'leather', 'steel']);
});
