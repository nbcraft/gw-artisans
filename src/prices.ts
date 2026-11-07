import { materials } from './catalog.ts';

export const SCHEMA_VERSION = 1;
export const CACHE_MS = 5 * 60 * 1000;
export interface PriceQuote { gold: number; quantity: number; observedAt: string }
export interface MaterialPrice { buy: PriceQuote; sell: PriceQuote }
export interface PriceSnapshot {
  schemaVersion: 1;
  source: { name: string; url: string; updatedAt: string };
  materials: Record<string, MaterialPrice>;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object');
  return value as Record<string, unknown>;
}
function positiveInt(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}
function timestamp(value: unknown, label: string): string {
  const seconds = positiveInt(value, label);
  if (seconds > Date.now() / 1000 + 300) throw new Error(`${label} is in the future`);
  return new Date(seconds * 1000).toISOString();
}
function isoDate(value: unknown): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value
    && Date.parse(value) <= Date.now() + 300_000;
}

/** The only Toolbox-specific parser. All consumers use PriceSnapshot instead. */
export function normalizeToolbox(input: unknown): PriceSnapshot {
  const raw = record(input);
  const buy = record(raw.buy);
  const sell = record(raw.sell);
  const output: PriceSnapshot = {
    schemaVersion: SCHEMA_VERSION,
    source: {
      name: 'Kamadan / GWToolbox',
      url: 'https://kamadan.gwtoolbox.com/trader_quotes',
      updatedAt: timestamp(raw.updated_at, 'source timestamp'),
    },
    materials: {},
  };
  for (const material of materials) {
    const read = (side: Record<string, unknown>): PriceQuote => {
      const quote = record(side[material.toolboxId]);
      if (quote.m !== material.toolboxId) throw new Error(`Unexpected identifier for ${material.id}`);
      return {
        gold: positiveInt(quote.p, `${material.id} price`),
        quantity: material.lotSize,
        observedAt: timestamp(quote.t, `${material.id} quote timestamp`),
      };
    };
    output.materials[material.id] = { buy: read(buy), sell: read(sell) };
  }
  return output;
}

export function validateSnapshot(input: unknown): PriceSnapshot {
  const data = record(input);
  if (data.schemaVersion !== SCHEMA_VERSION) throw new Error('Unsupported price schema');
  const source = record(data.source);
  if (typeof source.name !== 'string' || !source.name || typeof source.url !== 'string'
      || !source.url.startsWith('https://') || !isoDate(source.updatedAt)) {
    throw new Error('Invalid source metadata');
  }
  const prices = record(data.materials);
  for (const material of materials) {
    const price = record(prices[material.id]);
    for (const side of ['buy', 'sell']) {
      const quote = record(price[side]);
      positiveInt(quote.gold, `${material.id} ${side} price`);
      if (quote.quantity !== material.lotSize || !isoDate(quote.observedAt)) {
        throw new Error(`Invalid ${material.id} ${side} quote`);
      }
    }
  }
  return input as PriceSnapshot;
}

export function unitPrice(snapshot: PriceSnapshot, id: string, side: 'buy' | 'sell'): number {
  const quote = snapshot.materials[id]?.[side];
  if (!quote) throw new Error(`No ${side} quote for ${id}`);
  return quote.gold / quote.quantity;
}
