import { useEffect, useState } from 'react';
import { CACHE_MS, validateSnapshot } from './prices.ts';
import type { PriceSnapshot } from './prices.ts';

const CACHE_KEY = 'artisan-ledger:prices:v1';
interface Cached { savedAt: number; snapshot: PriceSnapshot }
function readCache(): Cached | undefined {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as Cached | null;
    if (cached && Number.isFinite(cached.savedAt) && cached.savedAt <= Date.now()) {
      return { savedAt: cached.savedAt, snapshot: validateSnapshot(cached.snapshot) };
    }
  } catch { /* Storage can be unavailable or contain an old schema. */ }
}

export function usePrices() {
  const [snapshot, setSnapshot] = useState<PriceSnapshot | undefined>(() => readCache()?.snapshot);
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let lastFetch = readCache()?.savedAt ?? 0;
    let loading = false;
    const refresh = async () => {
      if (loading || Date.now() - lastFetch < CACHE_MS) return;
      loading = true;
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/prices.json`, {
          cache: 'no-cache', signal: controller.signal,
        });
        if (!response.ok) throw new Error('Snapshot unavailable');
        const next = validateSnapshot(await response.json());
        // Do not replace a newer cached snapshot with an older deployment.
        const cached = readCache()?.snapshot;
        const chosen = cached && cached.source.updatedAt > next.source.updatedAt ? cached : next;
        if (controller.signal.aborted) return;
        lastFetch = Date.now();
        setSnapshot(chosen);
        setError(undefined);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: lastFetch, snapshot: chosen }));
        } catch { /* In-memory state is enough if browser storage is full or disabled. */ }
      } catch {
        if (!controller.signal.aborted) {
          setError('Could not load the latest snapshot. Any prices shown are from the last successful load.');
        }
      } finally { loading = false; }
    };
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 30_000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [retry]);

  return { snapshot, error, retry: () => setRetry(n => n + 1) };
}
