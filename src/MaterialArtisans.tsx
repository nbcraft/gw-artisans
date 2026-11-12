import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Dispatch, MouseEvent, PointerEvent, ReactNode, SetStateAction } from 'react';
import { materialById, recipes, routesFor } from './catalog.ts';
import { artisansFor, artisanSource, campaigns, convenienceRanks } from './artisans.ts';
import type { Artisan, Campaign } from './artisans.ts';

const openArtisans = createContext<((id: string) => void) | undefined>(undefined);
const craftableMaterials = new Set(recipes.map(recipe => recipe.output));
const iconUrl = (id: string) => `${import.meta.env.BASE_URL}icons/materials/${id}.png`;
type CampaignExpansion = Record<Campaign, boolean>;
const campaignPreferenceKey = 'artisan-ledger:campaigns:v1';
const defaultCampaignExpansion = Object.fromEntries(campaigns.map(campaign => [campaign, true])) as CampaignExpansion;

function readCampaignExpansion(): CampaignExpansion {
  const expanded = { ...defaultCampaignExpansion };
  try {
    const saved = JSON.parse(localStorage.getItem(campaignPreferenceKey) ?? 'null');
    for (const campaign of campaigns) {
      if (typeof saved?.[campaign] === 'boolean') expanded[campaign] = saved[campaign];
    }
  } catch { /* Missing or unavailable storage keeps the initial expanded state. */ }
  return expanded;
}

export function MaterialName({ id, interactive = true }: { id: string; interactive?: boolean }) {
  const open = useContext(openArtisans);
  const material = materialById[id];
  const contents = <><img className="material-icon" src={iconUrl(id)} alt="" width={24} height={24} /><span>{material.shortName ?? material.name}</span></>;
  return interactive && craftableMaterials.has(id) && open
    ? <button type="button" className="material-label material-trigger" aria-haspopup="dialog" title={`View artisans for ${material.name}`} onClick={() => open(id)}>{contents}</button>
    : <span className="material-label">{contents}</span>;
}

const boundedAmount = (value: string) => Math.max(1, Math.min(250, Math.trunc(Number(value) || 1)));
const formatAmount = new Intl.NumberFormat();

function AmountInput({ value, onChange }: { value: string; onChange: Dispatch<SetStateAction<string>> }) {
  const timer = useRef<number | undefined>(undefined);
  const stop = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
  };
  const step = (delta: number) => onChange(previous => String(boundedAmount(String(boundedAmount(previous) + delta))));
  const start = (direction: number) => {
    stop();
    step(direction);
    const started = performance.now();
    const repeat = () => {
      const elapsed = performance.now() - started;
      // Keep single-unit steps; gently shorten the delay to at most 50 per second.
      const delay = Math.max(20, 100 * 2 ** (-Math.max(0, elapsed - 800) / 800));
      step(direction);
      timer.current = window.setTimeout(repeat, delay);
    };
    timer.current = window.setTimeout(repeat, 200);
  };
  useEffect(() => {
    const stopWhenHidden = () => { if (document.hidden) stop(); };
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stopWhenHidden);
    return () => {
      stop();
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', stopWhenHidden);
    };
  }, []);
  useEffect(() => {
    if (boundedAmount(value) === 1 || boundedAmount(value) === 250) stop();
  }, [value]);
  return <div className="craft-amount-control">
    <input id="craft-amount" type="number" min={1} max={250} step={1} inputMode="numeric" value={value}
      aria-describedby="craft-amount-help"
      onChange={event => onChange(event.target.value === '' ? '' : String(boundedAmount(event.target.value)))}
      onBlur={() => onChange(previous => String(boundedAmount(previous)))} />
    <span id="craft-amount-help" className="sr-only">Enter 1 to 250. Hold an adjustment arrow for 800 milliseconds to accelerate.</span>
    <div className="craft-amount-arrows">{([1, -1] as const).map(direction => <button key={direction} type="button"
      aria-label={direction === 1 ? 'Increase amount' : 'Decrease amount'}
      disabled={direction === 1 ? boundedAmount(value) === 250 : boundedAmount(value) === 1}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        start(direction);
      }}
      onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onBlur={stop}
      onKeyDown={event => {
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        if (!event.repeat) start(direction);
      }}
      onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); stop(); } }}
      onClick={event => { if (event.detail === 0) step(direction); }}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={direction === 1 ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} /></svg>
    </button>)}</div>
  </div>;
}

function CraftCalculator({ materialId }: { materialId: string }) {
  const [amount, setAmount] = useState('1');
  const [intermediate, setIntermediate] = useState(false);
  const routes = routesFor(recipes.find(recipe => recipe.output === materialId)!);
  const route = routes[intermediate && routes.length > 1 ? 1 : 0];
  const quantity = boundedAmount(amount);
  return <section className="craft-calculator" aria-label="Crafting calculator">
    <div className="craft-calculator-section craft-amount">
      <label className="craft-amount-label craft-section-label" htmlFor="craft-amount">Amount needed:</label>
      <AmountInput value={amount} onChange={setAmount} />
    </div>
    <div className="craft-requirements" aria-live="polite" aria-atomic="true">
      <div className="craft-calculator-section craft-fee">
        <span id="craft-fee-label" className="craft-section-label">Fees:</span>
        <output htmlFor="craft-amount" aria-labelledby="craft-fee-label" className="gold"><span className="craft-fee-number">{formatAmount.format(route.fee * quantity)}</span>{' '}<span className="gold-unit">g</span></output>
      </div>
      <div className="craft-calculator-section craft-ingredients">
        <span id="craft-ingredients-label" className="craft-section-label">Ingredients:</span>
        <div className="ingredient-list" aria-labelledby="craft-ingredients-label">{route.ingredients.map(ingredient => <span key={ingredient.material}>
          <span className="ingredient-quantity">{formatAmount.format(ingredient.quantity * quantity)}</span>{' '}<span className="ingredient-multiplier">×</span>{' '}<MaterialName id={ingredient.material} />
        </span>)}</div>
      </div>
    </div>
    <div className="craft-calculator-section craft-intermediate">
      <label className="chain-toggle intermediate-toggle" title={routes.length > 1 ? undefined : 'This recipe has no intermediate craft.'}>
        <input type="checkbox" checked={intermediate} disabled={routes.length === 1} onChange={event => setIntermediate(event.target.checked)} />Intermediate craft
      </label>
    </div>
  </section>;
}

function ArtisanRow({ artisan }: { artisan: Artisan }) {
  const [mapFailed, setMapFailed] = useState(false);
  const localMapUrl = `${import.meta.env.BASE_URL}${artisan.mapPath}`;
  return <li className="artisan-row">
    <div className="artisan-info">
      <a className="artisan-link" href={artisan.wikiUrl} target="_blank" rel="noreferrer">{artisan.name}<span aria-hidden="true">↗</span><span className="sr-only"> (opens Guild Wars Wiki in a new tab)</span></a>
      <span className="artisan-location">{artisan.location}</span>
    </div>
    <a className="artisan-map" href={localMapUrl} target="_blank" rel="noreferrer" aria-label={`Open location map for ${artisan.name} (new tab)`}>
      {mapFailed ? <span className="artisan-map-fallback">Map unavailable. Open location map ↗</span>
        : <img src={localMapUrl} alt={`Location map for ${artisan.name} in ${artisan.location}`} loading="lazy" onError={() => setMapFailed(true)} />}
    </a>
  </li>;
}

function ArtisanDialog({ materialId, onClose, expandedCampaigns, onCampaignToggle }: {
  materialId: string;
  onClose: () => void;
  expandedCampaigns: CampaignExpansion;
  onCampaignToggle: (campaign: Campaign, expanded: boolean) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const matching = artisansFor(materialId);
  const featured = matching.find(artisan => Number.isFinite(convenienceRanks[artisan.id]));
  const isBackdrop = (event: MouseEvent<HTMLDialogElement> | PointerEvent<HTMLDialogElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX >= bounds.right
      || event.clientY < bounds.top || event.clientY >= bounds.bottom);
  };
  useLayoutEffect(() => {
    const dialog = dialogRef.current!;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  return <dialog ref={dialogRef} className="artisan-dialog" aria-labelledby="artisan-dialog-title"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onPointerDown={event => { pressedBackdrop.current = isBackdrop(event); }}
    onPointerCancel={() => { pressedBackdrop.current = false; }}
    onClick={event => {
      if (pressedBackdrop.current && isBackdrop(event)) onClose();
      pressedBackdrop.current = false;
    }}>
    <div className="artisan-dialog-header">
      <h2 id="artisan-dialog-title"><MaterialName id={materialId} interactive={false} /></h2>
      <button className="dialog-close" type="button" aria-label="Close artisan locations" onClick={onClose} autoFocus><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
    </div>
    <div className="artisan-dialog-content">
      <CraftCalculator materialId={materialId} />
      {featured && <section className="featured-artisan" aria-labelledby="featured-artisan-title">
        <h3 id="featured-artisan-title">Most convenient Artisan</h3>
        <ul className="artisan-list"><ArtisanRow artisan={featured} /></ul>
      </section>}
      <div className="artisan-campaigns">{campaigns.map(campaign => {
        const group = matching.filter(artisan => artisan.campaign === campaign && artisan !== featured);
        return <details className="artisan-campaign" key={campaign} open={expandedCampaigns[campaign]}
          onToggle={event => onCampaignToggle(campaign, event.currentTarget.open)}>
          <summary><span>{campaign}{' '}<span className="artisan-count">{group.length}</span></span><svg className="campaign-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></summary>
          {group.length ? <ul className="artisan-list">{group.map(artisan => <ArtisanRow key={artisan.id} artisan={artisan} />)}</ul>
            : <p className="artisan-empty">No {featured ? 'other ' : ''}artisans offer this recipe in {campaign}.</p>}
        </details>;
      })}</div>
      <p className="artisan-credit">Locations and maps: <a href={artisanSource} target="_blank" rel="noreferrer">Guild Wars Wiki ↗</a></p>
    </div>
  </dialog>;
}

export function MaterialArtisans({ children }: { children: ReactNode }) {
  const [materialId, setMaterialId] = useState<string>();
  const returnFocus = useRef<HTMLElement | null>(null);
  const [expandedCampaigns, setExpandedCampaigns] = useState(readCampaignExpansion);
  useLayoutEffect(() => {
    if (!materialId) {
      returnFocus.current?.focus();
      returnFocus.current = null;
    }
  }, [materialId]);
  useEffect(() => {
    try { localStorage.setItem(campaignPreferenceKey, JSON.stringify(expandedCampaigns)); }
    catch { /* Campaign choices still persist across dialogs for this visit. */ }
  }, [expandedCampaigns]);
  const toggleCampaign = (campaign: Campaign, expanded: boolean) => setExpandedCampaigns(previous =>
    previous[campaign] === expanded ? previous : { ...previous, [campaign]: expanded });
  const openMaterial = (id: string) => {
    if (!materialId) returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMaterialId(id);
  };
  return <openArtisans.Provider value={openMaterial}>
    {children}
    {materialId && <ArtisanDialog key={materialId} materialId={materialId} onClose={() => setMaterialId(undefined)}
      expandedCampaigns={expandedCampaigns} onCampaignToggle={toggleCampaign} />}
  </openArtisans.Provider>;
}
