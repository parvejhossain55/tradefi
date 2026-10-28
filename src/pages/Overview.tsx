import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { DropdownMenu, type DropdownAction } from '@/components/ui/DropdownMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { StatCard } from '@/components/ui/StatCard';
import { BarList, DonutChart } from '@/components/ui/Charts';
import { AssignStrategyDialog } from '@/components/assignments/AssignStrategyDialog';
import { PairFormDialog } from '@/components/pairs/PairFormDialog';
import { notify, notifyError } from '@/store/toastStore';
import { useTradingStore } from '@/store/tradingStore';
import type { PairStatus, TradingPair } from '@/types/trading';
import { MARKET_TYPES } from '@/types/trading';
import {
  formatDateTime,
  formatRelativeTime,
  getAssignmentForPair,
  getAutomationStatus,
  getConfigurationState,
  getConfigurationStatus,
  getStrategyById,
} from '@/utils/trading';
import { cn } from '@/utils/cn';

type PendingAction = { pair: TradingPair; type: 'archive' | 'disable' | 'enable' };

const statusColors = {
  enabled: '#22c55e',
  disabled: '#f59e0b',
  archived: '#94a3b8',
};
const EMPTY_LIST: never[] = [];

export function Overview() {
  const snapshot = useTradingStore((state) => state.snapshot);
  const setPairStatus = useTradingStore((state) => state.setPairStatus);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [marketFilter, setMarketFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [assignPairId, setAssignPairId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const signals = snapshot?.signals ?? EMPTY_LIST;
  const pairs = snapshot?.pairs ?? EMPTY_LIST;
  const assignments = snapshot?.assignments ?? EMPTY_LIST;
  const strategies = snapshot?.strategies ?? EMPTY_LIST;
  const executions = snapshot?.executions ?? EMPTY_LIST;
  const events = snapshot?.events ?? EMPTY_LIST;
  const globalRisk = snapshot?.globalRisk;

  const metrics = useMemo(() => {
    const enabledPairs = pairs.filter((pair) => pair.status === 'enabled');
    const activeAssignments = assignments.filter((assignment) => {
      const pair = pairs.find((candidate) => candidate.id === assignment.pairId);
      return assignment.status === 'active' && pair?.status === 'enabled';
    });
    const last24h = signals.filter(
      (signal) => Date.now() - new Date(signal.timestamp).getTime() < 24 * 3_600_000
    );
    return {
      enabledPairs: enabledPairs.length,
      activeAssignments: activeAssignments.length,
      signals24h: last24h.length,
    };
  }, [assignments, pairs, signals]);

  const lastSignalByPair = useMemo(() => {
    const map = new Map<string, (typeof signals)[number]>();
    signals.forEach((signal) => {
      const current = map.get(signal.pairId);
      if (!current || new Date(signal.timestamp) > new Date(current.timestamp)) {
        map.set(signal.pairId, signal);
      }
    });
    return map;
  }, [signals]);

  const filteredPairs = useMemo(() => {
    const term = query.trim().toLowerCase();
    return pairs.filter((pair) => {
      if (marketFilter !== 'all' && pair.marketType !== marketFilter) return false;
      if (statusFilter !== 'all' && pair.status !== statusFilter) return false;
      if (!term) return true;
      return (
        pair.symbol.toLowerCase().includes(term) || pair.displayName.toLowerCase().includes(term)
      );
    });
  }, [marketFilter, pairs, query, statusFilter]);

  const statusDistribution = useMemo(
    () =>
      (['enabled', 'disabled', 'archived'] as PairStatus[]).map((status) => ({
        label: status === 'enabled' ? 'Enabled' : status === 'disabled' ? 'Disabled' : 'Archived',
        value: pairs.filter((pair) => pair.status === status).length,
        color: statusColors[status],
      })),
    [pairs]
  );

  const strategyUsage = useMemo(
    () =>
      strategies
        .map((strategy) => {
          const strategyAssignments = assignments.filter(
            (assignment) => assignment.strategyId === strategy.id
          );
          const active = strategyAssignments.filter((assignment) => {
            const pair = pairs.find((candidate) => candidate.id === assignment.pairId);
            return assignment.status === 'active' && pair?.status === 'enabled';
          }).length;
          return {
            label: strategy.name,
            value: strategyAssignments.length,
            hint: `${active} active · ${strategy.enabled ? 'enabled' : 'disabled'} definition`,
            colorClass: strategy.enabled ? 'bg-primary-500' : 'bg-secondary-400',
          };
        })
        .filter((item) => item.value > 0),
    [assignments, pairs, strategies]
  );

  const recentSignals = useMemo(
    () =>
      [...signals]
        .sort(
          (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
        )
        .slice(0, 5),
    [signals]
  );

  const recentConfigChanges = useMemo(
    () =>
      [...events]
        .filter((event) => ['assignment', 'pair', 'strategy', 'risk'].includes(event.category))
        .sort(
          (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
        )
        .slice(0, 5),
    [events]
  );

  const recentEvents = useMemo(
    () =>
      [...events]
        .sort(
          (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
        )
        .slice(0, 5),
    [events]
  );

  const openConfiguration = (pair: TradingPair) => {
    navigate(`/trading-pairs/${pair.id}?tab=configuration`);
  };

  const actionsForPair = (pair: TradingPair): DropdownAction[] => {
    const assignment = getAssignmentForPair(assignments, pair.id);
    return [
      {
        label: 'View details',
        icon: 'eye',
        onSelect: () => navigate(`/trading-pairs/${pair.id}`),
      },
      {
        label: 'Edit configuration',
        icon: 'sliders',
        disabled: !assignment || pair.status === 'archived',
        onSelect: () => openConfiguration(pair),
      },
      {
        label: assignment ? 'Change strategy' : 'Assign strategy',
        icon: 'link',
        disabled: pair.status === 'archived',
        onSelect: () => setAssignPairId(pair.id),
      },
      {
        label: pair.status === 'enabled' ? 'Disable pair' : 'Enable pair',
        icon: pair.status === 'enabled' ? 'pause' : 'play',
        disabled: pair.status === 'archived',
        onSelect: () =>
          setPendingAction({
            pair,
            type: pair.status === 'enabled' ? 'disable' : 'enable',
          }),
      },
      {
        label: 'Archive pair',
        icon: 'archive',
        tone: 'danger',
        separatorBefore: true,
        disabled: pair.status === 'archived',
        onSelect: () => setPendingAction({ pair, type: 'archive' }),
      },
    ];
  };

  const columns: DataTableColumn<TradingPair>[] = [
    {
      key: 'pair',
      header: 'Pair',
      sortValue: (pair) => pair.symbol,
      render: (pair) => (
        <div className="min-w-[120px]">
          <Link
            to={`/trading-pairs/${pair.id}`}
            className="font-semibold tabular-nums text-secondary-900 hover:text-primary-600 dark:text-white dark:hover:text-primary-400"
          >
            {pair.symbol}
          </Link>
          <p className="text-[10px] text-secondary-500 dark:text-secondary-400">
            {pair.displayName}
          </p>
        </div>
      ),
    },
    {
      key: 'market',
      header: 'Market',
      sortValue: (pair) => pair.marketType,
      className: 'hidden md:table-cell',
      headerClassName: 'hidden md:table-cell',
      render: (pair) => (
        <span className="text-xs text-secondary-600 dark:text-secondary-300">
          {pair.marketType}
        </span>
      ),
    },
    {
      key: 'strategy',
      header: 'Assigned strategy',
      sortValue: (pair) => {
        const assignment = getAssignmentForPair(assignments, pair.id);
        return getStrategyById(strategies, assignment?.strategyId)?.name ?? '';
      },
      render: (pair) => {
        const assignment = getAssignmentForPair(assignments, pair.id);
        const strategy = getStrategyById(strategies, assignment?.strategyId);
        return strategy ? (
          <div className="min-w-[130px]">
            <p className="text-xs font-medium text-secondary-800 dark:text-secondary-200">
              {strategy.name}
            </p>
            <p className="text-[10px] tabular-nums text-secondary-400 dark:text-secondary-500">
              v{assignment?.strategyVersion}
              {!strategy.enabled ? ' · definition disabled' : ''}
            </p>
          </div>
        ) : (
          <span className="text-xs text-secondary-400 dark:text-secondary-500">Not assigned</span>
        );
      },
    },
    {
      key: 'timeframe',
      header: 'TF',
      sortValue: (pair) => pair.defaultTimeframe,
      className: 'hidden sm:table-cell',
      headerClassName: 'hidden sm:table-cell',
      render: (pair) => (
        <span className="rounded bg-secondary-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-secondary-600 dark:bg-secondary-800 dark:text-secondary-300">
          {pair.defaultTimeframe}
        </span>
      ),
    },
    {
      key: 'configuration',
      header: 'Configuration',
      sortValue: (pair) => {
        const assignment = getAssignmentForPair(assignments, pair.id);
        return getConfigurationState(assignment);
      },
      render: (pair) => {
        const assignment = getAssignmentForPair(assignments, pair.id);
        const status = getConfigurationStatus(assignment);
        const overrides = assignment ? Object.keys(assignment.configuration).length : 0;
        return (
          <div className="flex min-w-[100px] flex-col items-start gap-1">
            <Badge tone={status.tone}>{status.label}</Badge>
            {overrides > 0 ? (
              <span className="text-[10px] tabular-nums text-secondary-400 dark:text-secondary-500">
                {overrides} override{overrides === 1 ? '' : 's'} · v
                {assignment?.configurationVersion}
              </span>
            ) : assignment ? (
              <span className="text-[10px] text-secondary-400 dark:text-secondary-500">
                v{assignment.configurationVersion}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'automation',
      header: 'Automation',
      sortValue: (pair) => {
        const assignment = getAssignmentForPair(assignments, pair.id);
        const strategy = getStrategyById(strategies, assignment?.strategyId);
        return globalRisk ? getAutomationStatus(pair, assignment, strategy, globalRisk).label : '';
      },
      render: (pair) => {
        const assignment = getAssignmentForPair(assignments, pair.id);
        const strategy = getStrategyById(strategies, assignment?.strategyId);
        if (!globalRisk) return null;
        const status = getAutomationStatus(pair, assignment, strategy, globalRisk);
        return (
          <div className="min-w-[105px]" title={status.detail}>
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
          </div>
        );
      },
    },
    {
      key: 'lastSignal',
      header: 'Last signal',
      sortValue: (pair) => lastSignalByPair.get(pair.id)?.timestamp ?? '',
      render: (pair) => {
        const signal = lastSignalByPair.get(pair.id);
        if (!signal) {
          return (
            <span className="text-[11px] text-secondary-400 dark:text-secondary-500">None</span>
          );
        }
        return (
          <div className="min-w-[85px]" title={formatDateTime(signal.timestamp)}>
            <p
              className={cn(
                'text-[11px] font-medium capitalize',
                signal.type === 'buy'
                  ? 'text-success-600 dark:text-success-400'
                  : signal.type === 'sell'
                    ? 'text-danger-600 dark:text-danger-400'
                    : 'text-secondary-600 dark:text-secondary-300'
              )}
            >
              {signal.type}
            </p>
            <p className="text-[10px] text-secondary-400 dark:text-secondary-500">
              {formatRelativeTime(signal.timestamp)}
            </p>
          </div>
        );
      },
    },
    {
      key: 'updated',
      header: 'Updated',
      sortValue: (pair) => pair.updatedAt,
      className: 'hidden lg:table-cell',
      headerClassName: 'hidden lg:table-cell',
      render: (pair) => (
        <span
          className="whitespace-nowrap text-[11px] text-secondary-500 dark:text-secondary-400"
          title={formatDateTime(pair.updatedAt)}
        >
          {formatRelativeTime(pair.updatedAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (pair) => (
        <DropdownMenu actions={actionsForPair(pair)} label={`Actions for ${pair.symbol}`} />
      ),
    },
  ];

  const pendingCopy = pendingAction
    ? pendingAction.type === 'archive'
      ? {
          title: `Archive ${pendingAction.pair.symbol}?`,
          description:
            'Archiving removes the pair from active operations, disables its strategy assignment, and switches automation off. Historical signals and execution records are retained.',
          confirm: 'Archive pair',
          tone: 'danger' as const,
        }
      : pendingAction.type === 'disable'
        ? {
            title: `Disable ${pendingAction.pair.symbol}?`,
            description:
              'Disabling stops automation for this pair. The strategy assignment, configuration, and history are preserved.',
            confirm: 'Disable pair',
            tone: 'danger' as const,
          }
        : {
            title: `Enable ${pendingAction.pair.symbol}?`,
            description:
              'Enabling makes the pair operational again. Automation remains off until you turn it on explicitly.',
            confirm: 'Enable pair',
            tone: 'primary' as const,
          }
    : null;

  const handleStatusAction = async () => {
    if (!pendingAction) return;
    setActionLoading(true);
    try {
      if (pendingAction.type === 'archive') {
        await setPairStatus(pendingAction.pair.id, 'archived');
        notify({
          tone: 'success',
          title: 'Pair archived',
          description: `${pendingAction.pair.symbol} was archived and its assignment disabled.`,
        });
      } else if (pendingAction.type === 'disable') {
        await setPairStatus(pendingAction.pair.id, 'disabled');
        notify({
          tone: 'success',
          title: 'Pair disabled',
          description: `${pendingAction.pair.symbol} automation was switched off.`,
        });
      } else {
        await setPairStatus(pendingAction.pair.id, 'enabled');
        notify({
          tone: 'success',
          title: 'Pair enabled',
          description: `${pendingAction.pair.symbol} is operational. Automation remains off.`,
        });
      }
      setPendingAction(null);
    } catch (error) {
      notifyError(error, 'The pair status could not be changed.');
    } finally {
      setActionLoading(false);
    }
  };

  const clearFilters = () => {
    setQuery('');
    setMarketFilter('all');
    setStatusFilter('all');
  };

  if (!snapshot || !globalRisk) return null;

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Operational summary of configured pairs, reusable strategies, and simulated activity. All data is local to this demo workspace."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              icon="refresh"
              onClick={() => void useTradingStore.getState().refresh()}
            >
              Refresh snapshot
            </Button>
            <Button size="sm" icon="plus" onClick={() => setCreateOpen(true)}>
              Create pair
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Configured pairs"
          value={pairs.length}
          hint={`${pairs.filter((pair) => pair.status === 'archived').length} archived`}
          icon="pairs"
          tone="primary"
        />
        <StatCard
          label="Enabled pairs"
          value={metrics.enabledPairs}
          hint={`${pairs.length - metrics.enabledPairs} not enabled`}
          icon="checkCircle"
          tone="success"
        />
        <StatCard
          label="Active assignments"
          value={metrics.activeAssignments}
          hint={`${assignments.length} assignment records`}
          icon="assignments"
          tone="primary"
        />
        <StatCard
          label="Signals generated"
          value={signals.length}
          hint={`${metrics.signals24h} in the last 24h · simulated`}
          icon="signals"
          tone="neutral"
        />
        <StatCard
          label="Simulated executions"
          value={executions.length}
          hint="No orders were placed"
          icon="executions"
          tone="neutral"
        />
      </div>

      <Card className="mt-5">
        <CardHeader
          title="Pair monitoring"
          description="Configuration and automation state for every pair. Sorted by most recently updated by default."
          actions={
            <Link
              to="/trading-pairs"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              Manage pairs
              <Icon name="chevronRight" size={12} />
            </Link>
          }
        />
        <div className="flex flex-col gap-2 border-b border-secondary-200 px-4 py-3 dark:border-secondary-800 sm:flex-row sm:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search pair symbol or name…"
            ariaLabel="Search monitored pairs"
            className="sm:max-w-xs"
          />
          <div className="flex gap-2">
            <Select
              aria-label="Filter by market"
              value={marketFilter}
              onChange={(event) => setMarketFilter(event.target.value)}
              className="h-9 w-auto min-w-[130px] py-1 text-xs"
            >
              <option value="all">All markets</option>
              {MARKET_TYPES.map((market) => (
                <option key={market} value={market}>
                  {market}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter by pair status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 w-auto min-w-[125px] py-1 text-xs"
            >
              <option value="all">All statuses</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
              <option value="archived">Archived</option>
            </Select>
            {query || marketFilter !== 'all' || statusFilter !== 'all' ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            ) : null}
          </div>
          <span className="ml-auto hidden text-[11px] tabular-nums text-secondary-500 dark:text-secondary-400 sm:block">
            {filteredPairs.length} of {pairs.length} pairs
          </span>
        </div>
        <DataTable
          data={filteredPairs}
          columns={columns}
          rowKey={(pair) => pair.id}
          initialSort={{ key: 'updated', direction: 'desc' }}
          pageSize={6}
          resetKey={`${query}|${marketFilter}|${statusFilter}`}
          emptyState={
            <EmptyState
              compact
              icon="filter"
              title="No pairs match these filters"
              description="Adjust the search or filters to see configured pairs."
              action={
                <Button variant="secondary" size="xs" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          }
        />
      </Card>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Recent simulated signals"
            description="Deterministic demo records. These are not live market signals."
            actions={
              <Link
                to="/signals"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:underline dark:text-primary-400"
              >
                View all
                <Icon name="chevronRight" size={12} />
              </Link>
            }
          />
          <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
            {recentSignals.length === 0 ? (
              <EmptyState compact icon="signals" title="No simulated signals yet" />
            ) : (
              recentSignals.map((signal) => {
                const pair = pairs.find((candidate) => candidate.id === signal.pairId);
                const strategy = strategies.find((candidate) => candidate.id === signal.strategyId);
                return (
                  <div
                    key={signal.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5"
                  >
                    <span className="w-16 shrink-0 text-xs font-semibold tabular-nums text-secondary-900 dark:text-white">
                      {pair?.symbol ?? 'Unknown'}
                    </span>
                    <Badge
                      tone={
                        signal.type === 'buy'
                          ? 'success'
                          : signal.type === 'sell'
                            ? 'danger'
                            : 'neutral'
                      }
                    >
                      {signal.type.toUpperCase()}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-secondary-500 dark:text-secondary-400">
                      {strategy?.name ?? 'Unknown strategy'} · {signal.timeframe}
                    </span>
                    <Badge tone={signal.status === 'simulated' ? 'info' : 'neutral'}>
                      {signal.status}
                    </Badge>
                    <span className="w-16 shrink-0 text-right text-[10px] text-secondary-400 dark:text-secondary-500">
                      {formatRelativeTime(signal.timestamp)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Pair status" description="Distribution across all configured pairs." />
          <CardBody>
            <DonutChart
              items={statusDistribution}
              centerLabel="configured pairs"
              centerValue={String(pairs.length)}
              ariaLabel={`Pair status distribution: ${statusDistribution
                .map((item) => `${item.label} ${item.value}`)
                .join(', ')}`}
            />
            <Link
              to="/trading-pairs"
              className="mt-4 inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              Open pair management
              <Icon name="chevronRight" size={12} />
            </Link>
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader
            title="Strategy usage"
            description="Assignments per reusable definition."
            actions={
              <Link
                to="/strategies"
                className="text-[11px] font-medium text-primary-600 hover:underline dark:text-primary-400"
              >
                Library
              </Link>
            }
          />
          <CardBody>
            <BarList items={strategyUsage} emptyMessage="No pair has a strategy assignment yet." />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent configuration changes"
            description="Pair, strategy, assignment, and risk updates."
          />
          <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
            {recentConfigChanges.length === 0 ? (
              <EmptyState compact icon="sliders" title="No configuration changes" />
            ) : (
              recentConfigChanges.map((event) => (
                <div key={event.id} className="px-4 py-2.5">
                  <p className="line-clamp-2 text-[11px] leading-4 text-secondary-700 dark:text-secondary-300">
                    {event.message}
                  </p>
                  <p className="mt-0.5 text-[10px] capitalize text-secondary-400 dark:text-secondary-500">
                    {event.category} · {formatRelativeTime(event.timestamp)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent application events"
            description="System and operator activity in the demo."
            actions={
              <Link
                to="/monitor"
                className="text-[11px] font-medium text-primary-600 hover:underline dark:text-primary-400"
              >
                Monitor
              </Link>
            }
          />
          <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
            {recentEvents.length === 0 ? (
              <EmptyState compact icon="activity" title="No application events" />
            ) : (
              recentEvents.map((event) => (
                <div key={event.id} className="flex gap-2 px-4 py-2.5">
                  <span
                    className={cn(
                      'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                      event.level === 'error'
                        ? 'bg-danger-500'
                        : event.level === 'warning'
                          ? 'bg-warning-500'
                          : event.level === 'success'
                            ? 'bg-success-500'
                            : 'bg-primary-400'
                    )}
                  />
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-[11px] leading-4 text-secondary-700 dark:text-secondary-300">
                      {event.message}
                    </p>
                    <p className="mt-0.5 text-[10px] capitalize text-secondary-400 dark:text-secondary-500">
                      {event.category} · {formatRelativeTime(event.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <PairFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(pair) => navigate(`/trading-pairs/${pair.id}`)}
      />

      {assignPairId ? (
        <AssignStrategyDialog open pairId={assignPairId} onClose={() => setAssignPairId(null)} />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingCopy?.title ?? 'Confirm action'}
        description={pendingCopy?.description}
        confirmLabel={pendingCopy?.confirm ?? 'Confirm'}
        tone={pendingCopy?.tone ?? 'danger'}
        icon={pendingAction?.type === 'archive' ? 'archive' : 'alertTriangle'}
        loading={actionLoading}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void handleStatusAction()}
      >
        {pendingAction?.type === 'archive' ? (
          <div className="rounded-md border border-secondary-200 bg-secondary-50 px-2.5 py-1.5 text-[11px] text-secondary-600 dark:border-secondary-700 dark:bg-secondary-800 dark:text-secondary-300">
            Scope: {pendingAction.pair.symbol} only. Signals and execution history stay available.
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
