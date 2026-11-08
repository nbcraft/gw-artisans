import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestContext } from 'node:test';
import LZString from 'lz-string';
import { cachedPriceState, decodeToolboxMessage, normalizeToolbox, watchPrices, WEBSOCKET_URL } from '../src/prices.ts';
import type { PriceState } from '../src/prices.ts';
import { fixtureRaw } from './fixture.ts';

const encode = (value: unknown) => LZString.compressToUTF16(JSON.stringify(value));

function browser(t: TestContext) {
  const warnings = t.mock.method(console, 'warn', () => {});
  const states: PriceState[] = [];
  const sockets: Socket[] = [];
  const document = Object.assign(new EventTarget(), { hidden: false });
  const storage = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
  };
  class Socket {
    url: string;
    sent: string[] = [];
    opened = false;
    closed = false;
    onopen?: () => void;
    onmessage?: (event: { data: string }) => void;
    onerror?: () => void;
    onclose?: () => void;
    constructor(url: string) { this.url = url; sockets.push(this); }
    open() { this.opened = true; this.onopen?.(); }
    send(data: string) {
      assert.ok(this.opened && !this.closed, 'Messages are sent only over open sockets');
      this.sent.push(data);
    }
    close() { this.closed = true; }
    receive(data: unknown) {
      assert.ok(this.opened && !this.closed, 'Messages arrive only over open sockets');
      this.onmessage?.({ data: encode(data) });
    }
    fail() { this.onerror?.(); }
  }
  const globals = { document, localStorage, WebSocket: Socket };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() });
  let stop: (() => void) | undefined;
  t.after(() => {
    stop?.();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  return {
    states, sockets, document, storage, localStorage, warnings,
    start: (flush = true) => {
      stop?.();
      stop = watchPrices(state => states.push(state), states.at(-1));
      if (flush) t.mock.timers.tick(0);
    },
    stop: () => stop?.(),
    latest: () => states.at(-1)!,
  };
}

test('decode Toolbox UTF-16 price frames; ignore chat/status and reject corrupt or partial data', () => {
  const raw = fixtureRaw();
  assert.deepEqual(decodeToolboxMessage(encode(raw)), normalizeToolbox(raw));
  assert.equal(decodeToolboxMessage(encode({ code: 200, message: '' })), undefined);
  assert.equal(decodeToolboxMessage(encode({ t: 123, s: 'Trader', m: 'WTS', r: '456' })), undefined);
  assert.throws(() => decodeToolboxMessage(encode({ buy: raw.buy })), /object/);
  assert.throws(() => decodeToolboxMessage('invalid compression'));
  assert.throws(() => decodeToolboxMessage(new ArrayBuffer(2)), /text/);
});

test('development setup, cleanup, and setup opens only the retained connection', t => {
  const env = browser(t);
  env.start(false);
  env.stop();
  assert.equal(env.sockets.length, 0);
  env.start();
  assert.equal(env.sockets.length, 1);
  assert.equal(env.sockets[0].closed, false);
});

test('request prices directly, preserve newer snapshots, and retain memory on retry without storage', t => {
  const env = browser(t);
  env.localStorage.setItem = () => { throw new Error('Storage unavailable'); };
  env.start();
  const socket = env.sockets[0];
  assert.equal(socket.url, WEBSOCKET_URL);
  socket.open();
  assert.deepEqual(JSON.parse(socket.sent[0]), { compression: 'lz', send_prices: 1 });
  const raw = fixtureRaw();
  socket.receive(raw);
  assert.deepEqual(env.latest().snapshot, normalizeToolbox(raw));
  socket.receive({ ...raw, updated_at: raw.updated_at - 1 });
  assert.equal(env.latest().snapshot?.source.updatedAt, normalizeToolbox(raw).source.updatedAt);
  assert.equal(env.latest().error, undefined);
  env.start();
  assert.equal(socket.closed, true);
  assert.equal(env.sockets.length, 2);
  assert.deepEqual(env.latest().snapshot, normalizeToolbox(raw));
});

test('periodic price requests detect a silent connection without replacing the source timestamp', t => {
  const env = browser(t);
  env.start();
  const socket = env.sockets[0];
  socket.open();
  socket.receive(fixtureRaw());
  t.mock.timers.tick(120_000);
  assert.equal(socket.sent.length, 2);
  assert.equal(env.latest().snapshot?.source.updatedAt, '2026-01-01T00:00:00.000Z');
  t.mock.timers.tick(15_000);
  assert.equal(socket.closed, true);
  assert.match(env.latest().error!, /Reconnecting/);
  assert.ok(env.latest().snapshot);
});

test('reconnect with exponential backoff and reset it after a valid price frame', t => {
  const env = browser(t);
  env.start();
  const duplicateFailure = env.sockets[0].onerror!;
  env.sockets[0].fail();
  duplicateFailure();
  assert.equal(env.warnings.mock.callCount(), 1);
  t.mock.timers.tick(4_999);
  assert.equal(env.sockets.length, 1);
  t.mock.timers.tick(1);
  assert.equal(env.sockets.length, 2);
  env.sockets[1].fail();
  assert.equal(env.warnings.mock.callCount(), 1, 'Do not repeat warnings during the same outage');
  t.mock.timers.tick(9_999);
  assert.equal(env.sockets.length, 2);
  t.mock.timers.tick(1);
  assert.equal(env.sockets.length, 3);
  env.sockets[2].open();
  env.sockets[2].receive(fixtureRaw());
  assert.equal(env.latest().error, undefined);
  env.sockets[2].fail();
  assert.equal(env.warnings.mock.callCount(), 2, 'A new outage after recovery gets a warning');
  t.mock.timers.tick(5_000);
  assert.equal(env.sockets.length, 4);
});

test('an unopened connection times out after fifteen seconds', t => {
  const env = browser(t);
  env.start();
  t.mock.timers.tick(14_999);
  assert.equal(env.sockets[0].closed, false);
  t.mock.timers.tick(1);
  assert.equal(env.sockets[0].closed, true);
  assert.equal(env.latest().snapshot, undefined);
  assert.match(String(env.warnings.mock.calls[0].arguments[0]), /Connection timed out after 15s/);
  assert.match(env.latest().error!, /Reconnecting/);
});

test('opening cancels the handshake deadline but chat/status frames do not prevent the price-response timeout', t => {
  const env = browser(t);
  env.start();
  const socket = env.sockets[0];
  t.mock.timers.tick(5_000);
  socket.open();
  socket.receive({ code: 200, message: '' });
  t.mock.timers.tick(10_000); // The original handshake deadline must have been canceled.
  assert.equal(socket.closed, false);
  socket.receive({ t: Date.now(), s: 'Trader', m: 'WTS', r: '456' });
  t.mock.timers.tick(4_999);
  assert.equal(socket.closed, false);
  t.mock.timers.tick(1);
  assert.equal(socket.closed, true);
  assert.equal(env.latest().snapshot, undefined);
  assert.match(String(env.warnings.mock.calls[0].arguments[0]), /Price request timed out after 15s/);
  assert.match(env.latest().error!, /Reconnecting/);
});

test('preserve cached prices on invalid data and clear the error after recovery', t => {
  const env = browser(t);
  const snapshot = normalizeToolbox(fixtureRaw());
  env.storage.set('artisan-ledger:prices:v1', JSON.stringify({ savedAt: Date.now(), snapshot }));
  env.start();
  assert.deepEqual(env.latest().snapshot, snapshot);
  env.sockets[0].open();
  env.sockets[0].receive({ ...fixtureRaw(), sell: {} });
  assert.deepEqual(env.latest().snapshot, snapshot);
  assert.match(env.latest().error!, /Could not reach Toolbox/);
  t.mock.timers.tick(5_000);
  env.sockets[1].open();
  env.sockets[1].receive(fixtureRaw());
  assert.equal(env.latest().error, undefined);
});

test('pause hidden-tab requests, refresh overdue returns over the same socket, and release timers on cleanup', t => {
  const env = browser(t);
  env.start();
  const socket = env.sockets[0];
  socket.open();
  socket.receive(fixtureRaw());
  for (const away of [5 * 60_000, 10 * 60_000]) {
    t.mock.timers.tick(5_000);
    env.document.hidden = true;
    env.document.dispatchEvent(new Event('visibilitychange'));
    const before = socket.sent.length;
    t.mock.timers.tick(away);
    assert.equal(socket.sent.length, before);
    assert.equal(socket.closed, false);
    env.document.hidden = false;
    env.document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(socket.sent.length, before + 1);
    socket.receive(fixtureRaw());
    assert.equal(env.sockets.length, 1);
    assert.equal(socket.closed, false);
  }
  env.stop();
  const count = env.states.length;
  t.mock.timers.tick(10 * 60_000);
  env.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(env.states.length, count);
  assert.equal(env.sockets.length, 1);
  assert.equal(socket.closed, true);
});

test('an initially hidden page configures compression but requests prices only after becoming visible', t => {
  const env = browser(t);
  env.document.hidden = true;
  env.start();
  const socket = env.sockets[0];
  socket.open();
  assert.deepEqual(socket.sent.map(message => JSON.parse(message)), [{ compression: 'lz' }]);
  t.mock.timers.tick(120_000);
  assert.equal(socket.sent.length, 1);
  assert.equal(socket.closed, false);
  assert.equal(env.warnings.mock.callCount(), 0);
  env.document.hidden = false;
  env.document.dispatchEvent(new Event('visibilitychange'));
  assert.deepEqual(JSON.parse(socket.sent[1]), { compression: 'lz', send_prices: 1 });
  assert.equal(env.sockets.length, 1);
});

test('returning within two minutes waits only the remaining time and avoids duplicate requests', t => {
  const env = browser(t);
  env.start();
  const socket = env.sockets[0];
  socket.open();
  socket.receive(fixtureRaw());
  t.mock.timers.tick(30_000);
  env.document.hidden = true;
  env.document.dispatchEvent(new Event('visibilitychange'));
  t.mock.timers.tick(20_000);
  env.document.hidden = false;
  env.document.dispatchEvent(new Event('visibilitychange'));
  env.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(socket.sent.length, 1);
  t.mock.timers.tick(69_999);
  assert.equal(socket.sent.length, 1);
  t.mock.timers.tick(1);
  assert.equal(socket.sent.length, 2);
  socket.receive(fixtureRaw());
  t.mock.timers.tick(119_999);
  assert.equal(socket.sent.length, 2);
  t.mock.timers.tick(1);
  assert.equal(socket.sent.length, 3);
});

test('ignore corrupt browser caches', t => {
  const env = browser(t);
  env.storage.set('artisan-ledger:prices:v1', JSON.stringify({ snapshot: { schemaVersion: 2 } }));
  assert.deepEqual(cachedPriceState(), {});
  env.storage.set('artisan-ledger:prices:v1', 'not json');
  assert.deepEqual(cachedPriceState(), {});
});

test('track successful price responses separately from source age, across cache, failure, and retry', t => {
  const env = browser(t);
  env.start();
  const socket = env.sockets[0];
  socket.open();
  assert.equal(env.latest().lastReceivedAt, undefined, 'Opening a socket alone is not a successful price refresh');
  const raw = fixtureRaw();
  socket.receive(raw);
  const first = new Date().toISOString();
  assert.equal(env.latest().lastReceivedAt, first);
  assert.equal(cachedPriceState().lastReceivedAt, first);
  t.mock.timers.tick(10_000);
  socket.receive({ code: 200, message: '' });
  socket.receive({ t: Date.now(), s: 'Trader', m: 'WTS', r: '456' });
  assert.equal(env.latest().lastReceivedAt, first, 'Chat and acknowledgements are not price refreshes');
  socket.receive({ ...raw, updated_at: raw.updated_at - 1 });
  const second = new Date().toISOString();
  assert.notEqual(first, second);
  assert.equal(env.latest().lastReceivedAt, second, 'Even an unchanged or older valid response proves successful access');
  assert.equal(env.latest().snapshot?.source.updatedAt, normalizeToolbox(raw).source.updatedAt);
  assert.equal(cachedPriceState().lastReceivedAt, second);
  t.mock.timers.tick(10_000);
  socket.receive({ ...raw, sell: {} });
  assert.equal(env.latest().lastReceivedAt, second, 'Invalid data must not count as success');
  env.localStorage.setItem = () => { throw new Error('Storage unavailable'); };
  env.storage.clear();
  env.start();
  assert.equal(env.latest().lastReceivedAt, second, 'Retry preserves the in-memory receipt time');
});

test('legacy caches have no invented receipt time; invalid receipt metadata does not discard valid prices', t => {
  const env = browser(t);
  const snapshot = normalizeToolbox(fixtureRaw());
  for (const extra of [{ savedAt: Date.now() }, { lastReceivedAt: 'not a date' }, { lastReceivedAt: '2999-01-01T00:00:00.000Z' }]) {
    env.storage.set('artisan-ledger:prices:v1', JSON.stringify({ snapshot, ...extra }));
    assert.deepEqual(cachedPriceState().snapshot, snapshot);
    assert.equal(cachedPriceState().lastReceivedAt, undefined);
  }
});
