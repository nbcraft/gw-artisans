import artisanData from './data/artisans.json' with { type: 'json' };

export const campaigns = ['Prophecies', 'Factions', 'Nightfall', 'Eye of the North'] as const;
export type Campaign = typeof campaigns[number];
export interface Artisan {
  id: string;
  name: string;
  campaign: Campaign;
  location: string;
  wikiUrl: string;
  mapUrl: string;
  mapPath: string;
  materials: string[];
}

export const artisans = artisanData.artisans as Artisan[];
export const artisanSource = artisanData.source;

// Lower values are more convenient. Unranked artisans follow in name order.
export const convenienceRanks: Record<string, number> = {
  'xue-yi': 1,
  shinichiro: 2,
  kainu: 3,
  'artisan-daved': 4,
  'artisan-kristan': 5,
  jakatu: 6,
  'dae-chung': 7,
  lormeh: 8,
  larmor: 9,
  enbe: 10,
  'etham-the-artisan': 11,
  'takara-taji': 12,
  'crafter-magnor': 13,
  matunbo: 14,
  pakasah: 15,
  itenda: 16,
  yunndae: 17,
  tsungfa: 18,
  'crafter-torgil': 19,
  'sennat-sen': 20,
  jormar: 21,
  lilita: 22,
  nerwar: 23,
  'artisan-orpah': 24,
  'shalgrim-stonehart': 25,
  'shanda-ginkit': 26,
  'artisan-rudger': 27,
  'hadasha-the-artisan': 28,
  'artisan-sivan': 29,
  'nido-shabra': 30,
  khendi: 31,
  'crafter-hagrem': 32,
};

export function artisansFor(material: string, ranks = convenienceRanks): Artisan[] {
  return artisans.filter(artisan => artisan.materials.includes(material)).sort((a, b) =>
    (ranks[a.id] ?? Infinity) - (ranks[b.id] ?? Infinity)
    || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
