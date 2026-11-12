import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { materialById, materials, recipes, recipeSource, routesFor } from './catalog.ts';
import { evaluateRecipe } from './calculations.ts';
import type { PriceSnapshot } from './prices.ts';
import { usePrices } from './usePrices';
import { MaterialArtisans, MaterialName } from './MaterialArtisans.tsx';

const gold = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
function Gold({ value, signed = false }: { value: number; signed?: boolean }) {
  const sign = signed ? value > 0 ? '+' : value < 0 ? '−' : '' : value < 0 ? '−' : '';
  return <span className="gold">{sign}{gold.format(Math.abs(value))}{' '}<span className="gold-unit">g</span></span>;
}
function ageText(timestamp: string, now: number) {
  const minutes = Math.max(1, Math.floor((now - Date.parse(timestamp)) / 60_000));
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}
function freshnessStatus(timestamp: string, now: number) {
  const age = Math.max(0, now - Date.parse(timestamp));
  return age < 5 * 60_000 ? 'fresh' : age <= 15 * 60_000 ? 'aging' : 'stale';
}
const fullDate = (timestamp: string) => new Date(timestamp).toLocaleString(undefined, {
  year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
});

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark');
  useLayoutEffect(() => {
    const theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#141d19' : '#f3f1e9');
  }, [dark]);
  const toggle = () => {
    const next = !dark;
    const apply = () => {
      // Finish React's update and palette effect before the browser captures the new page.
      flushSync(() => setDark(next));
      try { localStorage.setItem('artisan-ledger:theme', next ? 'dark' : 'light'); }
      catch { /* The current page can still change theme without storage. */ }
    };
    if (typeof document.startViewTransition === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // One page-wide fade keeps all text, backgrounds, and borders in sync.
      document.startViewTransition(apply);
    } else apply();
  };
  return <div className="theme-toggle">
    <svg className={`theme-icon ${dark ? '' : 'active'}`} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>
    <button className="theme-switch" type="button" role="switch" aria-label="Dark mode" aria-checked={dark} onClick={toggle} title={dark ? 'Switch to light mode' : 'Switch to dark mode'}><span className="theme-thumb" /></button>
    <svg className={`theme-icon ${dark ? 'active' : ''}`} viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 15.5A9 9 0 0 1 8.5 3.6a9 9 0 1 0 11.9 11.9Z" /></svg>
  </div>;
}

function SourceTime({ snapshot, lastReceivedAt }: { snapshot: PriceSnapshot; lastReceivedAt?: string }) {
  const [now, setNow] = useState(Date.now());
  const [helpDismissed, setHelpDismissed] = useState(false);
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHelpDismissed(true);
    };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const timestamp = snapshot.source.updatedAt;
  const status = freshnessStatus(timestamp, now);
  return <div className="source-time">
    <div className="source-label"><span>Prices last refreshed</span><span className="source-help" data-dismissed={helpDismissed} onMouseEnter={() => setHelpDismissed(false)} onFocus={() => setHelpDismissed(false)}>
      <button type="button" className="help-button" aria-label="About price refresh times" aria-describedby="price-refresh-help">?</button>
      <span className="source-tooltip" role="tooltip" id="price-refresh-help">
        Toolbox may take time to refresh material prices.<br />The age shown reflects Toolbox’s data, not when we received it.<br /><br />
        Last successful connection to Toolbox:<br />
        {lastReceivedAt ? <span className="connection-age"><span className={`status-dot ${freshnessStatus(lastReceivedAt, now)}`} aria-hidden="true" /><span>{ageText(lastReceivedAt, now)} ({fullDate(lastReceivedAt)})</span></span> : 'Not yet recorded.'}
      </span>
    </span></div>
    <time className="source-age" dateTime={timestamp} title={fullDate(timestamp)} tabIndex={0} aria-label={`Updated ${ageText(timestamp, now)}. ${fullDate(timestamp)}`}>
      <span className={`status-dot ${status}`} aria-hidden="true" />{ageText(timestamp, now)}
    </time>
  </div>;
}

const sortKeys = ['name', 'fee', 'ingredientValue', 'salePrice', 'benefit'] as const;
type SortKey = typeof sortKeys[number];
interface Preferences {
  commonPriceSide: 'buy' | 'sell';
  showChains: boolean;
  craftableOnly: boolean;
  sort: { key: SortKey; direction: 'asc' | 'desc' };
}
const defaultPreferences: Preferences = {
  commonPriceSide: 'sell', showChains: true, craftableOnly: false, sort: { key: 'name', direction: 'asc' },
};
const preferenceKey = 'artisan-ledger:preferences:v1';
function readPreferences(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey) ?? 'null');
    return {
      commonPriceSide: saved?.commonPriceSide === 'buy' ? 'buy' : 'sell',
      showChains: typeof saved?.showChains === 'boolean' ? saved.showChains : true,
      craftableOnly: typeof saved?.craftableOnly === 'boolean' ? saved.craftableOnly : false,
      sort: sortKeys.includes(saved?.sort?.key) && ['asc', 'desc'].includes(saved?.sort?.direction)
        ? { key: saved.sort.key, direction: saved.sort.direction } : defaultPreferences.sort,
    };
  } catch { return defaultPreferences; }
}
function usePreferences() {
  const [preferences, setPreferences] = useState(readPreferences);
  useEffect(() => {
    try { localStorage.setItem(preferenceKey, JSON.stringify(preferences)); }
    catch { /* Selections still work for this visit when storage is unavailable. */ }
  }, [preferences]);
  const updatePreferences = (patch: Partial<Preferences>) => setPreferences(previous => ({ ...previous, ...patch }));
  return [preferences, updatePreferences] as const;
}
type TableProps = { snapshot: PriceSnapshot; preferences: Preferences; onPreferencesChange: (patch: Partial<Preferences>) => void };
const craftableMaterials = new Set(recipes.map(recipe => recipe.output));
function CraftingTable({ snapshot, preferences, onPreferencesChange }: TableProps) {
  const [search, setSearch] = useState('');
  const { commonPriceSide, showChains, sort } = preferences;
  const groups = useMemo(() => {
    const query = search.toLowerCase().trim();
    const groups = recipes.map(recipe => routesFor(recipe).map(route => evaluateRecipe(route, snapshot, commonPriceSide)))
      .filter(group => !query || materialById[group[0].output].name.toLowerCase().includes(query)
        || group.some(row => row.ingredients.some(i => materialById[i.material].name.toLowerCase().includes(query))));
    return groups.sort((a, b) => {
      const result = sort.key === 'name'
        ? materialById[a[0].output].name.localeCompare(materialById[b[0].output].name)
        : a[0][sort.key] - b[0][sort.key];
      return (sort.direction === 'asc' ? result : -result)
        || materialById[a[0].output].name.localeCompare(materialById[b[0].output].name);
    });
  }, [snapshot, search, sort, commonPriceSide]);
  const changeSort = (key: SortKey) => onPreferencesChange({ sort: {
    key, direction: sort.key === key && sort.direction === 'asc' ? 'desc' : 'asc',
  } });
  const header = (key: SortKey, label: string) => <th scope="col"
    className={key === 'name' ? '' : 'numeric'}
    aria-sort={sort.key === key ? sort.direction === 'asc' ? 'ascending' : 'descending' : undefined}>
    <button onClick={() => changeSort(key)}>{label}<span className={`sort-arrow ${sort.key === key ? 'active' : ''}`} aria-hidden="true">{sort.key === key ? sort.direction === 'asc' ? '↑' : '↓' : '↕'}</span></button>
  </th>;
  return <section className="crafting-panel" aria-labelledby="crafting-heading">
    <div className="crafting-header">
      <div className="panel-copy">
        <div className="panel-title"><h2 className="eyebrow" id="crafting-heading">THE ARTISAN’S BENCH</h2></div>
        <p className="panel-description">Compare crafting costs with the output’s trader sale price.</p>
      </div>
      <div className="table-tools">
        <label className="search-box"><svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg><input type="search" placeholder="Find a material…" aria-label="Search recipes by material or ingredient" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <label className="chain-toggle"><input type="checkbox" checked={showChains} onChange={e => onPreferencesChange({ showChains: e.target.checked })} />Include intermediate crafts</label>
      </div>
      <fieldset className="valuation-toggle"><legend className="sr-only">Use ingredients</legend><span className="valuation-label" aria-hidden="true">Use ingredients</span><div className="valuation-options">
          {(['buy', 'sell'] as const).map(side => <label key={side} className="valuation-choice"><input className="sr-only" type="radio" name="common-price-side" value={side} checked={commonPriceSide === side} onChange={() => onPreferencesChange({ commonPriceSide: side })} />{side === 'sell' ? 'Sell price' : 'Buy price'}</label>)}
        </div></fieldset>
    </div>
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Artisan recipes; scroll horizontally on smaller screens">
      <table className="crafting-table">
        <caption className="sr-only">All artisan recipes. Common ingredients use trader {commonPriceSide} prices; rare ingredients and the output use sell prices. Sort buttons keep alternative routes with their main recipe.</caption>
        <colgroup>
          <col className="recipe-material-column" />
          <col className="recipe-fee-column" />
          <col className="recipe-ingredients-column" />
          <col className="recipe-value-column" />
          <col className="recipe-value-column" />
          <col className="recipe-benefit-column" />
        </colgroup>
        <thead><tr>{header('name', 'Rare material')}{header('fee', 'Fee')}<th scope="col">Ingredients <span className="th-note">({commonPriceSide} value)</span></th>{header('ingredientValue', 'Inputs')}{header('salePrice', 'Sells for')}{header('benefit', 'Benefit')}</tr></thead>
        <tbody>{groups.map(group => group.filter(row => showChains || !row.via).map(row => <tr key={row.id} className={row.via ? 'chain-row' : ''}>
          <th scope="row"><span className="material-name">{row.via && <span className="route-mark" aria-hidden="true">↳</span>}<MaterialName id={row.output} /></span>
            {row.via && <span className="route-note">Craft <MaterialName id={row.via} /> first</span>}</th>
          <td className="numeric"><Gold value={row.fee} /></td>
          <td className="ingredient-list">{row.ingredients.map(i => <span key={i.material}><span className="ingredient-quantity">{i.quantity}</span>{' '}<span className="ingredient-multiplier">×</span>{' '}<MaterialName id={i.material} /> <span className="ingredient-value">(<Gold value={i.value} />)</span></span>)}</td>
          <td className="numeric input-total"><Gold value={row.ingredientValue} /></td>
          <td className="numeric"><Gold value={row.salePrice} /></td>
          <td className={`numeric benefit ${row.benefit > 0 ? 'positive' : row.benefit < 0 ? 'negative' : 'neutral'}`}><Gold value={row.benefit} signed /></td>
        </tr>))}</tbody>
      </table>
      {groups.length === 0 && <div className="empty-state">No recipes match “{search}”. <button onClick={() => setSearch('')}>Clear search</button></div>}
    </div>
    <div className="calculation-note"><span className="formula-symbol" aria-hidden="true">=</span><div><strong>Benefit = output sale price − crafting fees − ingredient value</strong><p>{commonPriceSide === 'sell' ? 'Values owned common materials at their trader sell price.' : 'Values common materials at their trader buy price.'} Rare ingredients use sell prices. Positive values mean crafting earns more than the valued inputs and fees. Alternative routes include every crafting fee.</p></div></div>
    <p className="lot-note">Common materials trade in lots of 10. Ingredient values are prorated; small quantities may need to be combined into a full lot. Quotes can change as you trade.</p>
  </section>;
}

function PricePanel({ snapshot, preferences, onPreferencesChange }: TableProps) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const visible = materials.filter(m => m.name.toLowerCase().includes(query)
    && (m.group === 'common' || !preferences.craftableOnly || craftableMaterials.has(m.id)));
  return <aside className="prices-panel" aria-labelledby="prices-heading">
    <div className="prices-heading"><span className="eyebrow">THE TRADER’S COUNTER</span><h2 id="prices-heading">Material prices</h2></div>
    <label className="price-search"><input type="search" aria-label="Search trader prices" placeholder="Find a material…" value={search} onChange={e => setSearch(e.target.value)} /></label>
    <table className="prices-table"><caption className="sr-only">Trader quotes per lot. Hover or focus a price to see its observation time.</caption>
      <colgroup><col /><col className="price-quote-column" /><col className="price-quote-column" /></colgroup>
      <thead><tr><th scope="col">Material</th><th scope="col" className="numeric">Buy</th><th scope="col" className="numeric">Sell</th></tr></thead>
      <tbody>{(['common', 'rare'] as const).map(group => {
        const list = visible.filter(m => m.group === group).sort((a, b) => (a.shortName ?? a.name).localeCompare(b.shortName ?? b.name));
        if (!list.length && group === 'common') return null;
        return [<tr key={group} className="price-group"><th colSpan={3} scope="colgroup"><div className="price-group-heading"><span>{group === 'common' ? 'Common · per 10 units' : 'Rare · per 1 unit'}</span>{group === 'rare' && <label className="craftable-toggle"><input type="checkbox" checked={preferences.craftableOnly} onChange={e => onPreferencesChange({ craftableOnly: e.target.checked })} />Craftable only</label>}</div></th></tr>,
          ...list.map(material => <tr key={material.id}>
            <th scope="row"><MaterialName id={material.id} /></th>
            {(['buy', 'sell'] as const).map(side => <td key={side} className="numeric"><span tabIndex={0} title={`Observed ${fullDate(snapshot.materials[material.id][side].observedAt)}`}><Gold value={snapshot.materials[material.id][side].gold} /></span></td>)}
          </tr>)];
      })}</tbody>
    </table>
    {!visible.length && <p className="empty-state">No materials found.</p>}
    <p className="prices-footnote">Prices are per trader lot, not per stack.<br />Hover a quote for its observation time.</p>
    <a className="source-link" href="https://kamadan.gwtoolbox.com/" target="_blank" rel="noreferrer">View on Kamadan Trade Chat ↗</a>
  </aside>;
}

export default function App() {
  const { snapshot, lastReceivedAt, error, retry } = usePrices();
  const [preferences, updatePreferences] = usePreferences();
  return <MaterialArtisans>
    <main>
      <div className="page-intro">
        <div className="intro-copy"><h1>KNOW WHAT YOUR MATERIALS ARE WORTH</h1><p>Artisan recipes, trader quotes, and the difference in your pocket.</p></div>
        <div className="intro-controls">{snapshot && <SourceTime snapshot={snapshot} lastReceivedAt={lastReceivedAt} />}<ThemeToggle /></div>
      </div>
      {error && <div className="notice" role="alert">{error} <button onClick={retry}>Try again</button></div>}
      {!snapshot ? <div className="loading-panel" role="status">{error ? 'No valid price data is available yet.' : 'Opening the ledger…'}</div>
        : <div className="workspace"><CraftingTable snapshot={snapshot} preferences={preferences} onPreferencesChange={updatePreferences} /><PricePanel snapshot={snapshot} preferences={preferences} onPreferencesChange={updatePreferences} /></div>}
      <footer><span>Independent fan tool. Guild Wars belongs to ArenaNet / NCSoft.</span><span><a href={recipeSource} target="_blank" rel="noreferrer">Recipes: Guild Wars Wiki ↗</a><a href="https://kamadan.gwtoolbox.com/" target="_blank" rel="noreferrer">Prices: GWToolbox ↗</a></span></footer>
    </main>
  </MaterialArtisans>;
}
