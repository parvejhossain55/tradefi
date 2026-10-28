import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/SearchInput';
import type { SignalEvent, SignalStatus, StrategyDefinition, TradingPair } from '@/types/trading';
import { SIGNAL_STATUS_LABELS, SIGNAL_TYPE_LABELS, type SignalType } from '@/types/trading';
import { formatDateTime, formatRelativeTime } from '@/utils/trading';

interface SignalHistoryTableProps {
  signals: SignalEvent[];
  pairs: TradingPair[];
  strategies: StrategyDefinition[];
  showPairFilter?: boolean;
  pageSize?: number;
}

const rangeCutoffs: Record<string, number> = {
  all: 0,
  '24h': 86_400_000,
  '7d': 604_800_000,
  '30d': 2_592_000_000,
};

const typeTone = (type: SignalType) => {
  if (type === 'buy') return 'success' as const;
  if (type === 'sell') return 'danger' as const;
  if (type === 'exit') return 'primary' as const;
  return 'neutral' as const;
};

const statusTone = (status: SignalStatus) => {
  if (status === 'simulated') return 'info' as const;
  if (status === 'filtered') return 'warning' as const;
  return 'neutral' as const;
};

export function SignalHistoryTable({
  signals,
  pairs,
  strategies,
  showPairFilter = false,
  pageSize = 10,
}: SignalHistoryTableProps) {
  const [query, setQuery] = useState('');
  const [pairFilter, setPairFilter] = useState('all');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rangeFilter, setRangeFilter] = useState('all');
  const [selected, setSelected] = useState<SignalEvent | null>(null);

  const filteredSignals = useMemo(() => {
    const term = query.trim().toLowerCase();
    const cutoff = rangeCutoffs[rangeFilter] ?? 0;
    const now = Date.now();
    return signals
      .filter((signal) => {
        if (pairFilter !== 'all' && signal.pairId !== pairFilter) return false;
        if (strategyFilter !== 'all' && signal.strategyId !== strategyFilter) return false;
        if (typeFilter !== 'all' && signal.type !== typeFilter) return false;
        if (statusFilter !== 'all' && signal.status !== statusFilter) return false;
        if (cutoff > 0 && now - new Date(signal.timestamp).getTime() > cutoff) return false;
        if (!term) return true;
        const pair = pairs.find((candidate) => candidate.id === signal.pairId);
        const strategy = strategies.find((candidate) => candidate.id === signal.strategyId);
        return (
          signal.detail.toLowerCase().includes(term) ||
          signal.id.toLowerCase().includes(term) ||
          (pair?.symbol ?? '').toLowerCase().includes(term) ||
          (strategy?.name ?? '').toLowerCase().includes(term)
        );
      })
      .sort(
        (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
      );
  }, [
    pairFilter,
    pairs,
    query,
    rangeFilter,
    signals,
    statusFilter,
    strategies,
    strategyFilter,
    typeFilter,
  ]);

  const columns: DataTableColumn<SignalEvent>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      sortValue: (signal) => signal.timestamp,
      render: (signal) => (
        <div className="min-w-[110px]">
          <p className="text-[11px] font-medium text-secondary-800 dark:text-secondary-200">
            {formatDateTime(signal.timestamp)}
          </p>
          <p className="text-[10px] text-secondary-400 dark:text-secondary-500">
            {formatRelativeTime(signal.timestamp)}
          </p>
        </div>
      ),
    },
    {
      key: 'pair',
      header: 'Pair',
      sortValue: (signal) => pairs.find((pair) => pair.id === signal.pairId)?.symbol ?? '',
      render: (signal) => {
        const pair = pairs.find((candidate) => candidate.id === signal.pairId);
        return (
          <span className="text-xs font-semibold tabular-nums text-secondary-900 dark:text-white">
            {pair?.symbol ?? 'Unknown'}
          </span>
        );
      },
    },
    {
      key: 'strategy',
      header: 'Strategy',
      sortValue: (signal) =>
        strategies.find((strategy) => strategy.id === signal.strategyId)?.name ?? '',
      className: 'hidden md:table-cell',
      headerClassName: 'hidden md:table-cell',
      render: (signal) => (
        <span className="whitespace-nowrap text-[11px] text-secondary-600 dark:text-secondary-300">
          {strategies.find((strategy) => strategy.id === signal.strategyId)?.name ?? 'Unknown'}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortValue: (signal) => signal.type,
      render: (signal) => (
        <Badge tone={typeTone(signal.type)}>{SIGNAL_TYPE_LABELS[signal.type]}</Badge>
      ),
    },
    {
      key: 'timeframe',
      header: 'TF',
      sortValue: (signal) => signal.timeframe,
      className: 'hidden sm:table-cell',
      headerClassName: 'hidden sm:table-cell',
      render: (signal) => (
        <span className="font-mono text-[10px] text-secondary-500 dark:text-secondary-400">
          {signal.timeframe}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (signal) => signal.status,
      render: (signal) => (
        <Badge tone={statusTone(signal.status)}>{SIGNAL_STATUS_LABELS[signal.status]}</Badge>
      ),
    },
    {
      key: 'detail',
      header: 'Event details',
      className: 'max-w-[300px]',
      render: (signal) => (
        <p className="line-clamp-2 max-w-[300px] text-[11px] leading-4 text-secondary-500 dark:text-secondary-400">
          {signal.detail}
        </p>
      ),
    },
    {
      key: 'inspect',
      header: '',
      align: 'right',
      render: (signal) => (
        <Button
          variant="ghost"
          size="xs"
          icon="eye"
          onClick={(event) => {
            event.stopPropagation();
            setSelected(signal);
          }}
        >
          View
        </Button>
      ),
    },
  ];

  const clearFilters = () => {
    setQuery('');
    setPairFilter('all');
    setStrategyFilter('all');
    setTypeFilter('all');
    setStatusFilter('all');
    setRangeFilter('all');
  };

  const hasFilters =
    Boolean(query) ||
    pairFilter !== 'all' ||
    strategyFilter !== 'all' ||
    typeFilter !== 'all' ||
    statusFilter !== 'all' ||
    rangeFilter !== 'all';

  const selectedPair = selected ? pairs.find((pair) => pair.id === selected.pairId) : undefined;
  const selectedStrategy = selected
    ? strategies.find((strategy) => strategy.id === selected.strategyId)
    : undefined;

  return (
    <div>
      <div className="flex flex-col gap-2 border-b border-secondary-200 px-4 py-3 dark:border-secondary-800">
        <div className="flex flex-col gap-2 lg:flex-row">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search pair, strategy, event…"
            ariaLabel="Search signals"
            className="lg:max-w-xs"
          />
          <div className="flex flex-wrap gap-2">
            {showPairFilter ? (
              <Select
                aria-label="Filter signals by pair"
                value={pairFilter}
                onChange={(event) => setPairFilter(event.target.value)}
                className="h-9 w-auto min-w-[120px] py-1 text-xs"
              >
                <option value="all">All pairs</option>
                {pairs.map((pair) => (
                  <option key={pair.id} value={pair.id}>
                    {pair.symbol}
                  </option>
                ))}
              </Select>
            ) : null}
            <Select
              aria-label="Filter signals by strategy"
              value={strategyFilter}
              onChange={(event) => setStrategyFilter(event.target.value)}
              className="h-9 w-auto min-w-[145px] py-1 text-xs"
            >
              <option value="all">All strategies</option>
              {strategies.map((strategy) => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter signals by type"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="h-9 w-auto min-w-[110px] py-1 text-xs"
            >
              <option value="all">All types</option>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
              <option value="exit">Exit</option>
              <option value="info">Info</option>
            </Select>
            <Select
              aria-label="Filter signals by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 w-auto min-w-[115px] py-1 text-xs"
            >
              <option value="all">All statuses</option>
              <option value="simulated">Simulated</option>
              <option value="filtered">Filtered</option>
              <option value="expired">Expired</option>
            </Select>
            <Select
              aria-label="Filter signals by date range"
              value={rangeFilter}
              onChange={(event) => setRangeFilter(event.target.value)}
              className="h-9 w-auto min-w-[120px] py-1 text-xs"
            >
              <option value="all">All time</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </Select>
            {hasFilters ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            ) : null}
          </div>
          <span className="ml-auto hidden self-center text-[11px] tabular-nums text-secondary-500 dark:text-secondary-400 xl:block">
            {filteredSignals.length} signal{filteredSignals.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <DataTable
        data={filteredSignals}
        columns={columns}
        rowKey={(signal) => signal.id}
        initialSort={{ key: 'timestamp', direction: 'desc' }}
        pageSize={pageSize}
        resetKey={`${query}|${pairFilter}|${strategyFilter}|${typeFilter}|${statusFilter}|${rangeFilter}`}
        onRowClick={setSelected}
        rowLabel={(signal) =>
          `Inspect ${signal.type} signal for ${
            pairs.find((pair) => pair.id === signal.pairId)?.symbol ?? 'pair'
          }`
        }
        emptyState={
          signals.length === 0 ? (
            <EmptyState
              compact
              icon="signals"
              title="No simulated signals"
              description="Signals generated by the demo model will appear here. No live feed is connected."
            />
          ) : (
            <EmptyState
              compact
              icon="filter"
              title="No signals match these filters"
              description="Adjust the search, filters, or date range."
              action={
                <Button variant="secondary" size="xs" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          )
        }
      />

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={
          selected
            ? `${selectedPair?.symbol ?? 'Signal'} · ${SIGNAL_TYPE_LABELS[selected.type]}`
            : 'Signal details'
        }
        description={selected ? formatDateTime(selected.timestamp) : undefined}
        size="md"
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={typeTone(selected.type)}>{SIGNAL_TYPE_LABELS[selected.type]}</Badge>
              <Badge tone={statusTone(selected.status)}>
                {SIGNAL_STATUS_LABELS[selected.status]}
              </Badge>
              <Badge tone="neutral">{selected.timeframe}</Badge>
              <span className="text-[10px] tabular-nums text-secondary-400 dark:text-secondary-500">
                ID {selected.id}
              </span>
            </div>
            <div className="grid gap-3 rounded-lg border border-secondary-200 p-3 dark:border-secondary-800 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary-400 dark:text-secondary-500">
                  Pair
                </p>
                <p className="mt-0.5 text-xs font-medium text-secondary-900 dark:text-white">
                  {selectedPair?.symbol ?? 'Unknown'}
                  <span className="ml-1 font-normal text-secondary-500">
                    {selectedPair?.displayName}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary-400 dark:text-secondary-500">
                  Strategy
                </p>
                <p className="mt-0.5 text-xs font-medium text-secondary-900 dark:text-white">
                  {selectedStrategy?.name ?? 'Unknown'}
                  <span className="ml-1 font-normal text-secondary-500">
                    v{selectedStrategy?.version}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary-400 dark:text-secondary-500">
                  Timestamp
                </p>
                <p className="mt-0.5 text-xs text-secondary-800 dark:text-secondary-200">
                  {formatDateTime(selected.timestamp)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary-400 dark:text-secondary-500">
                  Timeframe
                </p>
                <p className="mt-0.5 text-xs text-secondary-800 dark:text-secondary-200">
                  {selected.timeframe}
                </p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary-400 dark:text-secondary-500">
                Event details
              </p>
              <p className="mt-1 whitespace-pre-line text-xs leading-5 text-secondary-600 dark:text-secondary-300">
                {selected.detail}
              </p>
            </div>
            <div className="flex gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 dark:border-warning-500/20 dark:bg-warning-500/5">
              <Icon
                name="info"
                size={14}
                className="mt-0.5 shrink-0 text-warning-600 dark:text-warning-400"
              />
              <p className="text-[11px] leading-4 text-warning-700 dark:text-warning-300">
                Simulated demo record. No order was placed, no broker was contacted, and no
                financial result is implied.
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
