import { materials } from '../src/catalog.ts';

// Fixed prices, independent of mutable live data, with deliberately different
// buy/sell values to catch accidental use of buy prices in opportunity costs.
export function fixtureRaw() {
  const raw = { buy: {} as Record<string, { t: number; p: number; m: string }>, sell: {} as Record<string, { t: number; p: number; m: string; s: number }>, updated_at: 1767225600 };
  const sell: Record<string, number> = { dust: 280, 'plant-fiber': 900, glass: 200, ink: 650, damask: 950, wood: 40, charcoal: 240, iron: 170, 'deldrimor-steel': 1100 };
  for (const material of materials) {
    const price = sell[material.id] ?? 100;
    raw.buy[material.toolboxId] = { t: raw.updated_at, p: price + 100, m: material.toolboxId };
    raw.sell[material.toolboxId] = { t: raw.updated_at, p: price, m: material.toolboxId, s: 1 };
  }
  return raw;
}
