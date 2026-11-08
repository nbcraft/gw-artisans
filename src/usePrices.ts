import { useEffect, useRef, useState } from 'react';
import { cachedPriceState, watchPrices } from './prices.ts';
import type { PriceState } from './prices.ts';

export function usePrices() {
  const [state, setState] = useState<PriceState>(cachedPriceState);
  const latest = useRef(state);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => watchPrices(next => {
    latest.current = next;
    setState(next);
  }, latest.current), [attempt]);

  return { ...state, retry: () => setAttempt(n => n + 1) };
}
