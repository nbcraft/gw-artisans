import { materials } from './catalog.ts';
import LZString from 'lz-string';

export const SCHEMA_VERSION = 1;
const REFRESH_MS = 2 * 60 * 1000;
const SOURCE_URL = 'https://kamadan.gwtoolbox.com/trader_quotes';
export const WEBSOCKET_URL = 'wss://kamadan.gwtoolbox.com';
const CACHE_KEY = 'artisan-ledger:prices:v1';
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
      url: SOURCE_URL,
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

/** Chat/status messages are unrelated to prices and do not reach the UI. */
export function decodeToolboxMessage(data: unknown): PriceSnapshot | undefined {
  if (typeof data !== 'string') throw new Error('Expected a Toolbox text message');
  const text = LZString.decompressFromUTF16(data);
  if (!text) throw new Error('Could not decompress Toolbox message');
  const message = record(JSON.parse(text));
  if (!('buy' in message || 'sell' in message)) return;
  return normalizeToolbox(message);
}

export interface PriceState { snapshot?: PriceSnapshot; lastReceivedAt?: string; error?: string }

export function cachedPriceState(): PriceState {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    if (cached) return {
      snapshot: validateSnapshot(cached.snapshot),
      lastReceivedAt: isoDate(cached.lastReceivedAt) ? cached.lastReceivedAt : undefined,
    };
  } catch { /* Storage may be disabled or contain an invalid/older schema. */ }
  return {};
}

/** Owns transport, validation, and last-valid-data preservation for one page. */
export function watchPrices(onChange: (state: PriceState) => void, previous: PriceState = {}): () => void {
  const cached = cachedPriceState();
  let snapshot = cached.snapshot;
  if (previous.snapshot && (!snapshot || previous.snapshot.source.updatedAt > snapshot.source.updatedAt)) snapshot = previous.snapshot;
  let lastReceivedAt = [cached.lastReceivedAt, previous.lastReceivedAt].filter((date): date is string => !!date).sort().at(-1);
  let stopped = false;
  let warned = false;
  let socket: WebSocket | undefined;
  let reconnectDelay = 5_000;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let responseTimer: ReturnType<typeof setTimeout> | undefined;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let refresh = () => {};
  onChange({ snapshot, lastReceivedAt });

  const accept = (next: PriceSnapshot) => {
    if (stopped) return;
    warned = false;
    // A valid response proves successful access even when the source data is unchanged.
    lastReceivedAt = new Date().toISOString();
    // Reconnecting must not roll prices backward.
    if (!snapshot || next.source.updatedAt >= snapshot.source.updatedAt) snapshot = next;
    onChange({ snapshot, lastReceivedAt });
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ snapshot, lastReceivedAt }));
    } catch { /* The current page still works when storage is unavailable. */ }
  };

  const closeSocket = () => {
    clearTimeout(responseTimer);
    clearTimeout(refreshTimer);
    refresh = () => {};
    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
      socket = undefined;
    }
  };

  const connect = () => {
    if (stopped) return;
    clearTimeout(reconnectTimer);
    closeSocket();
    let failedOnce = false;
    const failed = (reason: string) => {
      if (stopped || failedOnce) return;
      failedOnce = true;
      closeSocket();
      if (!warned) {
        console.warn(`[Toolbox prices] ${reason}. Retrying in ${reconnectDelay / 1000}s.`);
        warned = true;
      }
      onChange({ snapshot, lastReceivedAt, error: 'Could not reach Toolbox. Reconnecting… Any prices shown are from the last successful connection.' });
      reconnectTimer = setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 60_000);
    };
    try {
      const connection = new WebSocket(WEBSOCKET_URL);
      socket = connection;
      let lastRequestAt = -Infinity;
      responseTimer = setTimeout(() => failed('Connection timed out after 15s'), 15_000);
      const requestPrices = () => {
        if (stopped || socket !== connection) return;
        clearTimeout(refreshTimer);
        if (document.hidden) return;
        const remaining = REFRESH_MS - (Date.now() - lastRequestAt);
        if (remaining > 0) {
          refreshTimer = setTimeout(requestPrices, remaining);
          return;
        }
        lastRequestAt = Date.now();
        clearTimeout(responseTimer);
        responseTimer = setTimeout(() => failed('Price request timed out after 15s'), 15_000);
        try {
          connection.send(JSON.stringify({ compression: 'lz', send_prices: 1 }));
          refreshTimer = setTimeout(requestPrices, REFRESH_MS);
        }
        catch { failed('Could not send price request'); }
      };
      socket.onopen = () => {
        clearTimeout(responseTimer);
        refresh = requestPrices;
        if (document.hidden) {
          // Configure decoding without requesting prices in a background tab.
          try { socket?.send(JSON.stringify({ compression: 'lz' })); }
          catch { failed('Could not configure WebSocket'); }
        } else requestPrices();
      };
      socket.onmessage = event => {
        try {
          const next = decodeToolboxMessage(event.data);
          if (!next) return;
          clearTimeout(responseTimer);
          reconnectDelay = 5_000;
          accept(next);
        } catch { failed('Invalid price response'); }
      };
      socket.onerror = () => failed('WebSocket connection error');
      socket.onclose = event => failed(`WebSocket closed (code ${event.code})`);
    } catch { failed('Could not open WebSocket'); }
  };

  const onVisible = () => {
    if (document.hidden) clearTimeout(refreshTimer);
    else refresh();
  };
  document.addEventListener('visibilitychange', onVisible);
  // StrictMode immediately cleans up its first development effect. Defer the
  // handshake so that cleanup can cancel it before a socket is opened.
  reconnectTimer = setTimeout(connect, 0);
  return () => {
    stopped = true;
    closeSocket();
    clearTimeout(reconnectTimer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
