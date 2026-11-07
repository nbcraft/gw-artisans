import { useEffect, useMemo, useState } from 'react';
import { materialById, materials, recipes, recipeSource, routesFor } from './catalog.ts';
import { evaluateRecipe } from './calculations.ts';
import type { PriceSnapshot } from './prices.ts';
import { usePrices } from './usePrices';

const gold = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
function Gold({ value, signed = false }: { value: number; signed?: boolean }) {
  const sign = signed ? value > 0 ? '+' : value < 0 ? '−' : '' : value < 0 ? '−' : '';
  return <span className="gold">{sign}{gold.format(Math.abs(value))}<span className="gold-unit">g</span></span>;
}
function ageText(timestamp: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(timestamp)) / 60_000));
  if (minutes < 1) return 'less than a minute ago';
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}
const fullDate = (timestamp: string) => new Date(timestamp).toLocaleString(undefined, {
  year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
});

function SourceTime({ snapshot }: { snapshot: PriceSnapshot }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const timestamp = snapshot.source.updatedAt;
  const old = now - Date.parse(timestamp) > 5 * 60_000;
  return <div className="source-time">
    <div className="source-label"><span className={`status-dot ${old ? 'aged' : ''}`} />Toolbox last updated</div>
    <time dateTime={timestamp} title={fullDate(timestamp)}>{fullDate(timestamp)}</time>
    <span className="source-age">{ageText(timestamp, now)}{old ? ' · older than 5 minutes' : ''}</span>
  </div>;
}

type SortKey = 'name' | 'fee' | 'ingredientValue' | 'salePrice' | 'benefit';
function CraftingTable({ snapshot }: { snapshot: PriceSnapshot }) {
  const [search, setSearch] = useState('');
  const [showChains, setShowChains] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const groups = useMemo(() => {
    const query = search.toLowerCase().trim();
    const groups = recipes.map(recipe => routesFor(recipe).map(route => evaluateRecipe(route, snapshot)))
      .filter(group => !query || materialById[group[0].output].name.toLowerCase().includes(query)
        || group.some(row => row.ingredients.some(i => materialById[i.material].name.toLowerCase().includes(query))));
    return groups.sort((a, b) => {
      const result = sort.key === 'name'
        ? materialById[a[0].output].name.localeCompare(materialById[b[0].output].name)
        : a[0][sort.key] - b[0][sort.key];
      return (sort.direction === 'asc' ? result : -result)
        || materialById[a[0].output].name.localeCompare(materialById[b[0].output].name);
    });
  }, [snapshot, search, sort]);
  const changeSort = (key: SortKey) => setSort(previous => ({
    key, direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc',
  }));
  const header = (key: SortKey, label: string) => <th scope="col"
    className={key === 'name' ? '' : 'numeric'}
    aria-sort={sort.key === key ? sort.direction === 'asc' ? 'ascending' : 'descending' : undefined}>
    <button onClick={() => changeSort(key)}>{label}<span className={`sort-arrow ${sort.key === key ? 'active' : ''}`} aria-hidden="true">{sort.key === key ? sort.direction === 'asc' ? '↑' : '↓' : '↕'}</span></button>
  </th>;
  return <section className="crafting-panel" aria-labelledby="crafting-heading">
    <div className="panel-title">
      <div><span className="eyebrow">THE ARTISAN’S BENCH</span><h2 id="crafting-heading">Craft, or sell?</h2></div>
      <span className="recipe-count">{groups.length} of 13 recipes</span>
    </div>
    <p className="panel-description">Compare one craft with selling all its ingredients to a trader.</p>
    <div className="table-tools">
      <label className="search-box"><span aria-hidden="true">⌕</span><input type="search" placeholder="Find a material or ingredient…" aria-label="Search recipes by material or ingredient" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label className="chain-toggle"><input type="checkbox" checked={showChains} onChange={e => setShowChains(e.target.checked)} />Include intermediate crafts</label>
    </div>
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Artisan recipes; scroll horizontally on smaller screens">
      <table className="crafting-table">
        <caption className="sr-only">All artisan recipes. All ingredients are owned and valued at trader sale prices. Sort buttons keep alternative routes with their main recipe.</caption>
        <thead><tr>{header('name', 'Rare material')}{header('fee', 'Fee')}<th scope="col">Ingredients <span className="th-note">(sale value)</span></th>{header('ingredientValue', 'Inputs')}{header('salePrice', 'Sells for')}{header('benefit', 'Benefit')}</tr></thead>
        <tbody>{groups.map(group => group.filter(row => showChains || !row.via).map(row => <tr key={row.id} className={row.via ? 'chain-row' : ''}>
          <th scope="row"><span className="material-name">{row.via && <span className="route-mark" aria-hidden="true">↳</span>}{materialById[row.output].name}</span>
            {row.via ? <span className="route-note">Craft {materialById[row.via].name.toLowerCase()} first</span> : <span className="route-note direct-route">Direct recipe · 1 output</span>}</th>
          <td className="numeric"><Gold value={row.fee} /></td>
          <td className="ingredient-list">{row.ingredients.map(i => <span key={i.material}><span className="ingredient-quantity">{i.quantity} ×</span> {materialById[i.material].name} <span className="ingredient-value">(<Gold value={i.saleValue} />)</span></span>)}</td>
          <td className="numeric input-total"><Gold value={row.ingredientValue} /></td>
          <td className="numeric"><Gold value={row.salePrice} /></td>
          <td className={`numeric benefit ${row.benefit > 0 ? 'positive' : row.benefit < 0 ? 'negative' : 'neutral'}`}><Gold value={row.benefit} signed /></td>
        </tr>))}</tbody>
      </table>
      {groups.length === 0 && <div className="empty-state">No recipes match “{search}”. <button onClick={() => setSearch('')}>Clear search</button></div>}
    </div>
    <div className="calculation-note"><span className="formula-symbol" aria-hidden="true">=</span><div><strong>Benefit = output sale price − crafting fees − ingredient sale value</strong><p>Assumes you own all starting ingredients. Positive values mean crafting earns more. Alternative routes include every crafting fee.</p></div></div>
    <p className="lot-note">Common materials trade in lots of 10. Ingredient values are prorated; small quantities may need to be combined into a full lot. Quotes can change as you trade.</p>
  </section>;
}

function PricePanel({ snapshot }: { snapshot: PriceSnapshot }) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const visible = materials.filter(m => m.name.toLowerCase().includes(query));
  return <aside className="prices-panel" aria-labelledby="prices-heading">
    <div className="prices-heading"><span className="eyebrow">THE TRADER’S COUNTER</span><h2 id="prices-heading">Material prices</h2><p><strong>Buy</strong> = you pay · <strong>Sell</strong> = you receive</p></div>
    <label className="price-search"><input type="search" aria-label="Search trader prices" placeholder="Find a price…" value={search} onChange={e => setSearch(e.target.value)} /></label>
    <table className="prices-table"><caption className="sr-only">Trader quotes per lot. Hover or focus a price to see its observation time.</caption><thead><tr><th scope="col">Material</th><th scope="col" className="numeric">Buy</th><th scope="col" className="numeric">Sell</th></tr></thead>
      <tbody>{(['common', 'rare'] as const).map(group => {
        const list = visible.filter(m => m.group === group).sort((a, b) => a.name.localeCompare(b.name));
        if (!list.length) return null;
        return [<tr key={group} className="price-group"><th colSpan={3} scope="colgroup">{group === 'common' ? 'Common · per 10 units' : 'Rare · per 1 unit'}</th></tr>,
          ...list.map(material => <tr key={material.id}>
            <th scope="row">{material.name}</th>
            {(['buy', 'sell'] as const).map(side => <td key={side} className="numeric"><span tabIndex={0} title={`Observed ${fullDate(snapshot.materials[material.id][side].observedAt)}`}><Gold value={snapshot.materials[material.id][side].gold} /></span></td>)}
          </tr>)];
      })}</tbody>
    </table>
    {!visible.length && <p className="empty-state">No materials found.</p>}
    <p className="prices-footnote">Prices are per trader lot, not per stack.<br />Hover a quote for its observation time.</p>
    <a className="source-link" href="https://kamadan.gwtoolbox.com/" target="_blank" rel="noreferrer">View on Kamadan ↗</a>
  </aside>;
}

export default function App() {
  const { snapshot, error, retry } = usePrices();
  return <>
    <header className="site-header"><div className="header-inner">
      <a href="./" className="brand" aria-label="Artisan Ledger home"><span className="brand-seal" aria-hidden="true">A</span><span>ARTISAN LEDGER<span className="brand-subtitle">GUILD WARS · CRAFTING MATERIALS</span></span></a>
      <span className="header-tag">A little gold, better spent.</span>
    </div></header>
    <main>
      <div className="page-intro"><div><span className="eyebrow">KNOW WHAT YOUR MATERIALS ARE WORTH</span><h1>Make the most of your materials.</h1><p>Artisan recipes, trader quotes, and the difference in your pocket.</p></div>{snapshot && <SourceTime snapshot={snapshot} />}</div>
      {error && <div className="notice" role="alert">{error} <button onClick={retry}>Try again</button></div>}
      {!snapshot ? <div className="loading-panel" role="status">{error ? 'No valid price data is available yet.' : 'Opening the ledger…'}</div>
        : <div className="workspace"><CraftingTable snapshot={snapshot} /><PricePanel snapshot={snapshot} /></div>}
      <footer><span>Independent fan tool. Guild Wars belongs to ArenaNet / NCSoft.</span><span><a href={recipeSource} target="_blank" rel="noreferrer">Recipes: Guild Wars Wiki ↗</a><a href="https://kamadan.gwtoolbox.com/" target="_blank" rel="noreferrer">Prices: GWToolbox ↗</a></span></footer>
    </main>
  </>;
}
