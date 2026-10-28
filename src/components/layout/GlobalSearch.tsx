import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTradingStore } from '@/store/tradingStore';
import { useClickOutside } from '@/hooks/useClickOutside';
import { Icon, type IconName } from '@/components/ui/Icon';
import { cn } from '@/utils/cn';

interface SearchResult {
  id: string;
  kind: 'pair' | 'strategy';
  title: string;
  subtitle: string;
  to: string;
  icon: IconName;
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const snapshot = useTradingStore((state) => state.snapshot);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useClickOutside(containerRef, () => setOpen(false), open);

  const results = useMemo<SearchResult[]>(() => {
    const term = query.trim().toLowerCase();
    if (!term || !snapshot) return [];

    const pairResults = snapshot.pairs
      .filter(
        (pair) =>
          pair.symbol.toLowerCase().includes(term) || pair.displayName.toLowerCase().includes(term)
      )
      .slice(0, 4)
      .map<SearchResult>((pair) => ({
        id: pair.id,
        kind: 'pair',
        title: pair.symbol,
        subtitle: `${pair.displayName} · ${pair.marketType} · ${pair.status}`,
        to: `/trading-pairs/${pair.id}`,
        icon: 'pairs',
      }));

    const strategyResults = snapshot.strategies
      .filter(
        (strategy) =>
          strategy.name.toLowerCase().includes(term) ||
          strategy.identifier.toLowerCase().includes(term) ||
          strategy.category.toLowerCase().includes(term)
      )
      .slice(0, 3)
      .map<SearchResult>((strategy) => ({
        id: strategy.id,
        kind: 'strategy',
        title: strategy.name,
        subtitle: `${strategy.category} · v${strategy.version} · ${strategy.enabled ? 'enabled' : 'disabled'}`,
        to: '/strategies',
        icon: 'strategies',
      }));

    return [...pairResults, ...strategyResults];
  }, [query, snapshot]);

  const openResult = (result: SearchResult) => {
    navigate(result.to);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Icon
          name="search"
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary-400"
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          role="searchbox"
          aria-label="Search pairs and strategies"
          aria-expanded={open && query.trim().length > 0}
          aria-controls="global-search-results"
          placeholder="Search pairs, strategies…"
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              inputRef.current?.blur();
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((current) => Math.max(current - 1, 0));
            } else if (event.key === 'Enter' && open && results[activeIndex]) {
              event.preventDefault();
              openResult(results[activeIndex]);
            }
          }}
          className="block h-8 w-full rounded-lg border border-secondary-200 bg-secondary-50 py-1.5 pl-8 pr-3 text-xs text-secondary-900 transition-colors placeholder:text-secondary-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-secondary-700 dark:bg-secondary-950/50 dark:text-secondary-100 dark:placeholder:text-secondary-500 dark:focus:bg-secondary-900"
        />
      </div>
      {open && query.trim() ? (
        <div
          id="global-search-results"
          className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-secondary-200 bg-white shadow-medium dark:border-secondary-700 dark:bg-secondary-900"
        >
          {results.length === 0 ? (
            <div className="px-3 py-5 text-center">
              <p className="text-xs font-medium text-secondary-700 dark:text-secondary-300">
                No matches for “{query.trim()}”
              </p>
              <p className="mt-1 text-[11px] text-secondary-500 dark:text-secondary-400">
                Try a pair symbol, strategy name, or category.
              </p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto p-1">
              {results.map((result, index) => (
                <li key={`${result.kind}-${result.id}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => openResult(result)}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
                      index === activeIndex
                        ? 'bg-secondary-100 dark:bg-secondary-800'
                        : 'hover:bg-secondary-50 dark:hover:bg-secondary-800/70'
                    )}
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-secondary-500 ring-1 ring-secondary-200 dark:bg-secondary-900 dark:text-secondary-400 dark:ring-secondary-700">
                      <Icon name={result.icon} size={13} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-secondary-900 dark:text-white">
                        {result.title}
                      </span>
                      <span className="block truncate text-[10px] text-secondary-500 dark:text-secondary-400">
                        {result.subtitle}
                      </span>
                    </span>
                    <Icon
                      name="chevronRight"
                      size={13}
                      className="mt-1 shrink-0 text-secondary-400"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-secondary-200 px-3 py-1.5 text-[10px] text-secondary-400 dark:border-secondary-800 dark:text-secondary-500">
            ↑ ↓ to navigate · Enter to open · Esc to close
          </div>
        </div>
      ) : null}
    </div>
  );
}
