import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/SearchInput';
import type {
  ExecutionRecord,
  ExecutionStatus,
  StrategyDefinition,
  TradingPair,
} from '@/types/trading';
import { EXECUTION_EVENT_LABELS, EXECUTION_STATUS_LABELS } from '@/types/trading';
import { formatDateTime, formatLatency, formatRelativeTime } from '@/utils/trading';

interface ExecutionHistoryTableProps {
  executions: ExecutionRecord[];
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

const statusTone = (status: ExecutionStatus) => {
  if (status === 'success') return 'success' as const;
  if (status === 'failed') return 'danger' as const;
  return 'warning' as const;
};

export function ExecutionHistoryTable({
  executions,
  pairs,
  strategies,
  showPairFilter = false,
  pageSize = 10,
}: ExecutionHistoryTableProps) {
  const [query, setQuery] = useState('');
  const [pairFilter, setPairFilter] = useState('all');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rangeFilter, setRangeFilter] = useState('all');
  const [selected, setSelected] = useState<ExecutionRecord | null>(null);

  const filteredExecutions = useMemo(() => {
    const term = query.trim().toLowerCase();
    const cutoff = rangeCutoffs[rangeFilter] ?? 0;
    const now = Date.now();
    return executions
      .filter((execution) => {
        if (pairFilter !== 'all' && execution.pairId !== pairFilter) return false;
        if (strategyFilter !== 'all' && execution.strategyId !== strategyFilter) return false;
        if (eventFilter !== 'all' && execution.eventType !== eventFilter) return false;
        if (statusFilter !== 'all' && execution.status !== statusFilter) return false;
        if (cutoff > 0 && now - new Date(execution.timestamp).getTime() > cutoff) return false;
        if (!term) return true;
        const pair = pairs.find((candidate) => candidate.id === execution.pairId);
        const strategy = strategies.find((candidate) => candidate.id === execution.strategyId);
        return (
          execution.error?.toLowerCase().includes(term) ||
          execution.id.toLowerCase().includes(term) ||
          (pair?.symbol ?? '').toLowerCase().includes(term) ||
          (strategy?.name ?? '').toLowerCase().includes(term)
        );
      })
      .sort(
        (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
      );
  }, [
    eventFilter,
    executions,
    pairFilter,
    pairs,
    query,
    rangeFilter,
    statusFilter,
    strategies,
    strategyFilter,
  ]);

  const columns: DataTableColumn<ExecutionRecord>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      sortValue: (execution) => execution.timestamp,
      render: (execution) => (
        <div className="min-w-[110px]">
          <p className="text-[11px] font-medium text-secondary-800 dark:text-secondary-200">
            {formatDateTime(execution.timestamp)}
          </p>
          <p className="text-[10px] text-secondary-400 dark:text-secondary-500">
            {formatRelativeTime(execution.timestamp)}
          </p>
        </div>
      ),
    },
    {
      key: 'pair',
      header: 'Pair',
      sortValue: (execution) => pairs.find((pair) => pair.id === execution.pairId)?.symbol ?? '',
      render: (execution) => {
        const pair = pairs.find((candidate) => candidate.id === execution.pairId);
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
      sortValue: (execution) =>
        strategies.find((strategy) => strategy.id === execution.strategyId)?.name ?? '',
      className: 'hidden xl:table-cell',
      headerClassName: 'hidden xl:table-cell',
      render: (execution) => (
        <span className="whitespace-nowrap text-[11px] text-secondary-600 dark:text-secondary-300">
          {strategies.find((strategy) => strategy.id === execution.strategyId)?.name ?? 'Unknown'}
        </span>
      ),
    },
    {
      key: 'mode',
      header: 'Mode',
      render: () => <Badge tone="primary">Simulation</Badge>,
    },
    {
      key: 'event',
      header: 'Event',
      sortValue: (execution) => execution.eventType,
      render: (execution) => (
        <span className="whitespace-nowrap text-[11px] text-secondary-700 dark:text-secondary-300">
          {EXECUTION_EVENT_LABELS[execution.eventType]}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (execution) => execution.status,
      render: (execution) => (
        <Badge tone={statusTone(execution.status)}>
          {EXECUTION_STATUS_LABELS[execution.status]}
        </Badge>
      ),
    },
    {
      key: 'latency',
      header: 'Latency',
      align: 'right',
      sortValue: (execution) => execution.latencyMs ?? -1,
      className: 'hidden sm:table-cell',
      headerClassName: 'hidden sm:table-cell',
      render: (execution) => (
        <span className="whitespace-nowrap font-mono text-[10px] tabular-nums text-secondary-500 dark:text-secondary-400">
          {formatLatency(execution.latencyMs)}
        </span>
      ),
    },
    {
      key: 'error',
      header: 'Error details',
      className: 'max-w-[220px]',
      render: (execution) =>
        execution.error ? (
          <p className="line-clamp-2 max-w-[220px] text-[11px] leading-4 text-danger-600 dark:text-danger-400">
            {execution.error}
          </p>
        ) : (
          <span className="text-[11px] text-secondary-400 dark:text-secondary-500">—</span>
        ),
    },
    {
      key: 'inspect',
      header: '',
      align: 'right',
      render: (execution) => (
        <Button
          variant="ghost"
          size="xs"
          icon="eye"
          onClick={(event) => {
            event.stopPropagation();
            setSelected(execution);
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
    setEventFilter('all');
    setStatusFilter('all');
    setRangeFilter('all');
  };

  const hasFilters =
    Boolean(query) ||
    pairFilter !== 'all' ||
    strategyFilter !== 'all' ||
    eventFilter !== 'all' ||
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
            placeholder="Search pair, strategy, error…"
            ariaLabel="Search executions"
            className="lg:max-w-xs"
          />
          <div className="flex flex-wrap gap-2">
            {showPairFilter ? (
              <Select
                aria-label="Filter executions by pair"
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
              aria-label="Filter executions by strategy"
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
              aria-label="Filter executions by event type"
              value={eventFilter}
              onChange={(event) => setEventFilter(event.target.value)}
              className="h-9 w-auto min-w-[140px] py-1 text-xs"
            >
              <option value="all">All events</option>
              {Object.entries(EXECUTION_EVENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter executions by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 w-auto min-w-[115px] py-1 text-xs"
            >
              <option value="all">All statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
            </Select>
            <Select
              aria-label="Filter executions by date range"
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
            {filteredExecutions.length} record{filteredExecutions.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <DataTable
        data={filteredExecutions}
        columns={columns}
        rowKey={(execution) => execution.id}
        initialSort={{ key: 'timestamp', direction: 'desc' }}
        pageSize={pageSize}
        resetKey={`${query}|${pairFilter}|${strategyFilter}|${eventFilter}|${statusFilter}|${rangeFilter}`}
        onRowClick={setSelected}
        rowLabel={(execution) =>
          `Inspect ${EXECUTION_EVENT_LABELS[execution.eventType]} for ${
            pairs.find((pair) => pair.id === execution.pairId)?.symbol ?? 'pair'
          }`
        }
        emptyState={
          executions.length === 0 ? (
            <EmptyState
              compact
              icon="executions"
              title="No simulated executions"
              description="Execution records from the demo model will appear here. No broker orders are ever sent."
            />
          ) : (
            <EmptyState
              compact
              icon="filter"
              title="No executions match these filters"
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
            ? `${selectedPair?.symbol ?? 'Execution'} · ${
                EXECUTION_EVENT_LABELS[selected.eventType]
              }`
            : 'Execution details'
        }
        description={selected ? formatDateTime(selected.timestamp) : undefined}
        size="md"
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="primary">Simulation</Badge>
              <Badge tone={statusTone(selected.status)}>
                {EXECUTION_STATUS_LABELS[selected.status]}
              </Badge>
              <Badge tone="neutral">{EXECUTION_EVENT_LABELS[selected.eventType]}</Badge>
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
                  Latency
                </p>
                <p className="mt-0.5 font-mono text-xs tabular-nums text-secondary-800 dark:text-secondary-200">
                  {formatLatency(selected.latencyMs)}
                </p>
              </div>
            </div>
            {selected.error ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary-400 dark:text-secondary-500">
                  Error details
                </p>
                <p className="mt-1 rounded-md bg-danger-50 px-2.5 py-2 text-[11px] leading-4 text-danger-700 dark:bg-danger-500/10 dark:text-danger-300">
                  {selected.error}
                </p>
              </div>
            ) : null}
            <div className="flex gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 dark:border-warning-500/20 dark:bg-warning-500/5">
              <Icon
                name="info"
                size={14}
                className="mt-0.5 shrink-0 text-warning-600 dark:text-warning-400"
              />
              <p className="text-[11px] leading-4 text-warning-700 dark:text-warning-300">
                Simulated record only. The dashboard does not place orders, connect to a broker, or
                prove execution performance.
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
