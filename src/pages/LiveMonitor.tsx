import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Form';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { notify } from '@/store/toastStore';
import { useTradingStore } from '@/store/tradingStore';
import type { StatusTone } from '@/types/trading';
import { EXECUTION_EVENT_LABELS, PAIR_STATUS_LABELS } from '@/types/trading';
import {
  formatDateTime,
  formatLatency,
  formatRelativeTime,
  getAssignmentForPair,
  getAutomationStatus,
  getPairStatusTone,
  getStrategyById,
} from '@/utils/trading';
import { cn } from '@/utils/cn';

type MonitorEventType = 'signal' | 'execution' | 'risk' | 'configuration' | 'system';
type MonitorEventStatus = 'success' | 'info' | 'warning' | 'error' | 'neutral';

interface MonitorEvent {
  id: string;
  timestamp: string;
  pairId?: string;
  strategyId?: string;
  type: MonitorEventType;
  status: MonitorEventStatus;
  title: string;
  detail: string;
  recordId: string;
}

const statusTone: Record<MonitorEventStatus, StatusTone> = {
  success: 'success',
  info: 'primary',
  warning: 'warning',
  error: 'danger',
  neutral: 'neutral',
};

const typeIcon: Record<MonitorEventType, IconName> = {
  signal: 'signals',
  execution: 'executions',
  risk: 'risk',
  configuration: 'sliders',
  system: 'activity',
};

const typeLabel: Record<MonitorEventType, string> = {
  signal: 'Signal',
  execution: 'Execution',
  risk: 'Risk check',
  configuration: 'Configuration',
  system: 'System',
};

const statusLabel: Record<MonitorEventStatus, string> = {
  success: 'Success',
  info: 'Informational',
  warning: 'Warning',
  error: 'Error',
  neutral: 'Neutral',
};

const EMPTY_LIST: never[] = [];

export function LiveMonitor() {
  const snapshot = useTradingStore((state) => state.snapshot);
  const refresh = useTradingStore((state) => state.refresh);
  const [pairFilter, setPairFilter] = useState('all');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState<MonitorEvent | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const pairs = snapshot?.pairs ?? EMPTY_LIST;
  const strategies = snapshot?.strategies ?? EMPTY_LIST;
  const assignments = snapshot?.assignments ?? EMPTY_LIST;
  const signals = snapshot?.signals ?? EMPTY_LIST;
  const executions = snapshot?.executions ?? EMPTY_LIST;
  const applicationEvents = snapshot?.events ?? EMPTY_LIST;

  const monitorEvents = useMemo<MonitorEvent[]>(() => {
    const signalEvents: MonitorEvent[] = signals.map((signal) => {
      const pair = pairs.find((candidate) => candidate.id === signal.pairId);
      return {
        id: `mon-signal-${signal.id}`,
        timestamp: signal.timestamp,
        pairId: signal.pairId,
        strategyId: signal.strategyId,
        type: 'signal',
        status:
          signal.status === 'filtered'
            ? 'warning'
            : signal.status === 'simulated'
              ? 'info'
              : 'neutral',
        title: `${pair?.symbol ?? 'Pair'} ${signal.type.toUpperCase()} signal · ${signal.timeframe}`,
        detail: signal.detail,
        recordId: signal.id,
      };
    });

    const executionEvents: MonitorEvent[] = executions.map((execution) => {
      const pair = pairs.find((candidate) => candidate.id === execution.pairId);
      return {
        id: `mon-exec-${execution.id}`,
        timestamp: execution.timestamp,
        pairId: execution.pairId,
        strategyId: execution.strategyId,
        type: execution.eventType === 'risk_check' ? 'risk' : 'execution',
        status:
          execution.status === 'failed'
            ? 'error'
            : execution.status === 'skipped'
              ? 'warning'
              : 'success',
        title: `${pair?.symbol ?? 'Pair'} · ${EXECUTION_EVENT_LABELS[execution.eventType]}`,
        detail:
          execution.error ??
          `Simulated ${EXECUTION_EVENT_LABELS[execution.eventType].toLowerCase()} completed with ${formatLatency(
            execution.latencyMs
          )} latency. No broker order was placed.`,
        recordId: execution.id,
      };
    });

    const systemEvents: MonitorEvent[] = applicationEvents.map((event) => ({
      id: `mon-event-${event.id}`,
      timestamp: event.timestamp,
      pairId: event.pairId,
      strategyId: event.strategyId,
      type:
        event.category === 'risk'
          ? 'risk'
          : event.category === 'system' || event.category === 'monitor'
            ? 'system'
            : 'configuration',
      status: event.level,
      title: `${event.category} event`,
      detail: event.message,
      recordId: event.id,
    }));

    return [...signalEvents, ...executionEvents, ...systemEvents].sort(
      (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
    );
  }, [applicationEvents, executions, pairs, signals]);

  const filteredEvents = useMemo(() => {
    return monitorEvents.filter((event) => {
      if (pairFilter !== 'all' && event.pairId !== pairFilter) return false;
      if (strategyFilter !== 'all' && event.strategyId !== strategyFilter) return false;
      if (typeFilter !== 'all' && event.type !== typeFilter) return false;
      if (statusFilter !== 'all' && event.status !== statusFilter) return false;
      return true;
    });
  }, [monitorEvents, pairFilter, statusFilter, strategyFilter, typeFilter]);

  const warningCount =
    applicationEvents.filter((event) => event.level === 'warning').length +
    executions.filter((execution) => execution.status === 'skipped').length +
    signals.filter((signal) => signal.status === 'filtered').length;
  const errorCount =
    applicationEvents.filter((event) => event.level === 'error').length +
    executions.filter((execution) => execution.status === 'failed').length;
  const failedExecutions = executions.filter((execution) => execution.status === 'failed').length;

  const latestExecution = useMemo(
    () =>
      [...executions].sort(
        (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
      )[0],
    [executions]
  );

  const pairHealth = (pairId: string) => {
    const pair = pairs.find((candidate) => candidate.id === pairId);
    if (!pair) return { label: 'Unknown', tone: 'neutral' as StatusTone, detail: '' };
    if (pair.status === 'archived') {
      return { label: 'Archived', tone: 'neutral' as StatusTone, detail: 'No events processed.' };
    }
    const assignment = getAssignmentForPair(assignments, pairId);
    const strategy = getStrategyById(strategies, assignment?.strategyId);
    if (!assignment) {
      return {
        label: 'Unassigned',
        tone: 'warning' as StatusTone,
        detail: 'No strategy is assigned to this pair.',
      };
    }
    if (!strategy?.enabled) {
      return {
        label: 'Strategy disabled',
        tone: 'warning' as StatusTone,
        detail: 'The assigned strategy definition is disabled.',
      };
    }
    const lastExecution = [...executions]
      .filter((execution) => execution.pairId === pairId)
      .sort(
        (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
      )[0];
    if (lastExecution?.status === 'failed') {
      return {
        label: 'Error',
        tone: 'danger' as StatusTone,
        detail: lastExecution.error ?? 'The last simulated execution failed.',
      };
    }
    if (lastExecution?.status === 'skipped') {
      return {
        label: 'Warning',
        tone: 'warning' as StatusTone,
        detail: lastExecution.error ?? 'The last simulated execution was skipped.',
      };
    }
    if (pair.status === 'enabled' && pair.automationEnabled) {
      return {
        label: 'Healthy',
        tone: 'success' as StatusTone,
        detail: 'Pair is enabled and automation is on. Demo events are deterministic.',
      };
    }
    return {
      label: 'Idle',
      tone: 'neutral' as StatusTone,
      detail: 'Pair is configured but automation is off or the pair is disabled.',
    };
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
      notify({
        tone: 'info',
        title: 'Demo snapshot refreshed',
        description:
          'Reloaded from local mock storage. No live market or broker connection exists.',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const clearFilters = () => {
    setPairFilter('all');
    setStrategyFilter('all');
    setTypeFilter('all');
    setStatusFilter('all');
  };

  const hasFilters =
    pairFilter !== 'all' ||
    strategyFilter !== 'all' ||
    typeFilter !== 'all' ||
    statusFilter !== 'all';

  if (!snapshot) return null;

  const selectedPair = selectedEvent
    ? pairs.find((pair) => pair.id === selectedEvent.pairId)
    : undefined;
  const selectedStrategy = selectedEvent
    ? strategies.find((strategy) => strategy.id === selectedEvent.strategyId)
    : undefined;

  return (
    <div>
      <PageHeader
        title="Live Monitor"
        description="Static demo snapshot of pair health and simulated processing events. This page is not a live market or broker monitor."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon="refresh"
            loading={refreshing}
            onClick={() => void handleRefresh()}
          >
            Refresh snapshot
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Connection & heartbeat"
            description="The dashboard has no backend, WebSocket, broker, or market data integration."
            actions={
              <Badge tone="warning" dot>
                Disconnected
              </Badge>
            }
          />
          <CardBody>
            <dl className="grid gap-x-8 sm:grid-cols-2">
              <div className="flex items-start justify-between gap-4 border-b border-secondary-100 py-2 dark:border-secondary-800">
                <dt className="text-[11px] text-secondary-500 dark:text-secondary-400">Provider</dt>
                <dd className="text-right text-[11px] font-medium text-secondary-800 dark:text-secondary-200">
                  {snapshot.settings.dataSource.provider}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-secondary-100 py-2 dark:border-secondary-800">
                <dt className="text-[11px] text-secondary-500 dark:text-secondary-400">Mode</dt>
                <dd className="text-right text-[11px] font-medium text-secondary-800 dark:text-secondary-200">
                  Mock / demo
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-secondary-100 py-2 dark:border-secondary-800">
                <dt className="text-[11px] text-secondary-500 dark:text-secondary-400">
                  Broker connection
                </dt>
                <dd className="text-right text-[11px] font-medium text-danger-600 dark:text-danger-400">
                  None
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-secondary-100 py-2 dark:border-secondary-800">
                <dt className="text-[11px] text-secondary-500 dark:text-secondary-400">
                  Market feed
                </dt>
                <dd className="text-right text-[11px] font-medium text-danger-600 dark:text-danger-400">
                  Not connected
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 py-2">
                <dt className="text-[11px] text-secondary-500 dark:text-secondary-400">
                  Last heartbeat
                </dt>
                <dd className="text-right">
                  <p className="text-[11px] font-medium text-secondary-800 dark:text-secondary-200">
                    {formatRelativeTime(snapshot.heartbeatAt)}
                  </p>
                  <p className="text-[10px] text-secondary-400 dark:text-secondary-500">
                    {formatDateTime(snapshot.heartbeatAt)}
                  </p>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 py-2">
                <dt className="text-[11px] text-secondary-500 dark:text-secondary-400">
                  Last processed event
                </dt>
                <dd className="text-right">
                  {latestExecution ? (
                    <>
                      <p className="text-[11px] font-medium text-secondary-800 dark:text-secondary-200">
                        {pairs.find((pair) => pair.id === latestExecution.pairId)?.symbol ?? 'Pair'}{' '}
                        · {EXECUTION_EVENT_LABELS[latestExecution.eventType]}
                      </p>
                      <p className="text-[10px] text-secondary-400 dark:text-secondary-500">
                        {formatRelativeTime(latestExecution.timestamp)} · {latestExecution.status}
                      </p>
                    </>
                  ) : (
                    <span className="text-[11px] text-secondary-500">No events</span>
                  )}
                </dd>
              </div>
            </dl>
            <p className="mt-2 border-t border-secondary-100 pt-2 text-[10px] leading-4 text-secondary-500 dark:border-secondary-800 dark:text-secondary-400">
              Heartbeat is a seeded snapshot timestamp, not a live signal. No broker connection is
              simulated as healthy.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Error & warning indicators"
            description="Counts across seeded application events, signals, and executions."
          />
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-danger-200 bg-danger-50/60 px-3 py-2 dark:border-danger-500/20 dark:bg-danger-500/5">
              <div className="flex items-center gap-2">
                <Icon name="xCircle" size={15} className="text-danger-600 dark:text-danger-400" />
                <div>
                  <p className="text-[11px] font-semibold text-danger-800 dark:text-danger-300">
                    Errors
                  </p>
                  <p className="text-[10px] text-danger-600/80 dark:text-danger-300/70">
                    {failedExecutions} failed execution{failedExecutions === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <span className="text-lg font-semibold tabular-nums text-danger-700 dark:text-danger-300">
                {errorCount}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-warning-200 bg-warning-50/60 px-3 py-2 dark:border-warning-500/20 dark:bg-warning-500/5">
              <div className="flex items-center gap-2">
                <Icon
                  name="alertTriangle"
                  size={15}
                  className="text-warning-600 dark:text-warning-400"
                />
                <div>
                  <p className="text-[11px] font-semibold text-warning-800 dark:text-warning-300">
                    Warnings
                  </p>
                  <p className="text-[10px] text-warning-600/80 dark:text-warning-300/70">
                    Filters, skips, and operator warnings
                  </p>
                </div>
              </div>
              <span className="text-lg font-semibold tabular-nums text-warning-700 dark:text-warning-300">
                {warningCount}
              </span>
            </div>

            <div className="rounded-lg border border-secondary-200 px-3 py-2 dark:border-secondary-800">
              <p className="text-[11px] font-medium text-secondary-700 dark:text-secondary-300">
                Environment
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge tone="warning">Demo mode</Badge>
                <Badge tone="neutral">Static snapshot</Badge>
                <Badge tone="neutral">No WebSocket</Badge>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Pair status overview"
          description="Assignment state, automation eligibility, and last events for each pair."
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
        <CardBody>
          {pairs.length === 0 ? (
            <EmptyState
              compact
              icon="pairs"
              title="No pairs configured"
              description="Create a trading pair to see its demo health summary."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {pairs.map((pair) => {
                const assignment = getAssignmentForPair(assignments, pair.id);
                const strategy = getStrategyById(strategies, assignment?.strategyId);
                const automation = getAutomationStatus(
                  pair,
                  assignment,
                  strategy,
                  snapshot.globalRisk
                );
                const health = pairHealth(pair.id);
                const lastSignal = [...signals]
                  .filter((signal) => signal.pairId === pair.id)
                  .sort(
                    (left, right) =>
                      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
                  )[0];
                const lastExecution = [...executions]
                  .filter((execution) => execution.pairId === pair.id)
                  .sort(
                    (left, right) =>
                      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
                  )[0];

                return (
                  <div
                    key={pair.id}
                    className="rounded-lg border border-secondary-200 bg-white p-3 dark:border-secondary-800 dark:bg-secondary-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            to={`/trading-pairs/${pair.id}`}
                            className="text-xs font-semibold tabular-nums text-secondary-900 hover:text-primary-600 dark:text-white dark:hover:text-primary-400"
                          >
                            {pair.symbol}
                          </Link>
                          <Badge tone={getPairStatusTone(pair.status)}>
                            {PAIR_STATUS_LABELS[pair.status]}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-[10px] text-secondary-500 dark:text-secondary-400">
                          {pair.displayName} · {pair.marketType} · {pair.defaultTimeframe}
                        </p>
                      </div>
                      <span title={health.detail}>
                        <Badge tone={health.tone} dot>
                          {health.label}
                        </Badge>
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <Badge tone={automation.tone}>{automation.label}</Badge>
                      <Badge
                        tone={
                          assignment
                            ? assignment.status === 'active'
                              ? 'success'
                              : 'warning'
                            : 'neutral'
                        }
                      >
                        {assignment
                          ? assignment.status === 'active'
                            ? 'Assignment active'
                            : 'Assignment off'
                          : 'Unassigned'}
                      </Badge>
                      {!strategy ? null : !strategy.enabled ? (
                        <Badge tone="warning">Strategy disabled</Badge>
                      ) : null}
                    </div>

                    <p className="mt-1.5 truncate text-[11px] text-secondary-600 dark:text-secondary-300">
                      {strategy ? strategy.name : 'No strategy assigned'}
                    </p>

                    <dl className="mt-2 space-y-1 border-t border-secondary-100 pt-2 text-[10px] dark:border-secondary-800">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-secondary-400 dark:text-secondary-500">Last signal</dt>
                        <dd className="text-right font-medium text-secondary-700 dark:text-secondary-300">
                          {lastSignal
                            ? `${lastSignal.type.toUpperCase()} · ${formatRelativeTime(lastSignal.timestamp)}`
                            : 'None'}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-secondary-400 dark:text-secondary-500">
                          Last processed
                        </dt>
                        <dd
                          className={cn(
                            'max-w-[60%] truncate text-right font-medium',
                            lastExecution?.status === 'failed'
                              ? 'text-danger-600 dark:text-danger-400'
                              : lastExecution?.status === 'skipped'
                                ? 'text-warning-600 dark:text-warning-400'
                                : 'text-secondary-700 dark:text-secondary-300'
                          )}
                          title={
                            lastExecution
                              ? `${EXECUTION_EVENT_LABELS[lastExecution.eventType]} · ${formatDateTime(
                                  lastExecution.timestamp
                                )}`
                              : undefined
                          }
                        >
                          {lastExecution
                            ? `${EXECUTION_EVENT_LABELS[lastExecution.eventType]} · ${formatRelativeTime(
                                lastExecution.timestamp
                              )}`
                            : 'None'}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-secondary-400 dark:text-secondary-500">Source</dt>
                        <dd className="text-right font-medium text-warning-600 dark:text-warning-400">
                          Demo feed · disconnected
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-secondary-400 dark:text-secondary-500">Heartbeat</dt>
                        <dd className="text-right font-medium text-secondary-600 dark:text-secondary-400">
                          {formatRelativeTime(snapshot.heartbeatAt)} · static
                        </dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Recent simulated events"
          description="Signals, execution processing, risk checks, configuration changes, and system events. No live events."
          actions={
            <span className="text-[10px] tabular-nums text-secondary-500 dark:text-secondary-400">
              {filteredEvents.length} match{filteredEvents.length === 1 ? '' : 'es'} · latest 25
              shown
            </span>
          }
        />
        <div className="flex flex-wrap gap-2 border-b border-secondary-200 px-4 py-3 dark:border-secondary-800">
          <Select
            aria-label="Filter monitor events by pair"
            value={pairFilter}
            onChange={(event) => setPairFilter(event.target.value)}
            className="h-9 w-auto min-w-[125px] py-1 text-xs"
          >
            <option value="all">All pairs</option>
            {pairs.map((pair) => (
              <option key={pair.id} value={pair.id}>
                {pair.symbol}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter monitor events by strategy"
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
            aria-label="Filter monitor events by event type"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="h-9 w-auto min-w-[135px] py-1 text-xs"
          >
            <option value="all">All event types</option>
            <option value="signal">Signals</option>
            <option value="execution">Executions</option>
            <option value="risk">Risk checks</option>
            <option value="configuration">Configuration</option>
            <option value="system">System</option>
          </Select>
          <Select
            aria-label="Filter monitor events by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-9 w-auto min-w-[130px] py-1 text-xs"
          >
            <option value="all">All statuses</option>
            <option value="success">Success</option>
            <option value="info">Informational</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="neutral">Neutral</option>
          </Select>
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          ) : null}
        </div>

        {filteredEvents.length === 0 ? (
          <EmptyState
            compact
            icon="filter"
            title="No events match these filters"
            description="Adjust the pair, strategy, event type, or status filters."
            action={
              hasFilters ? (
                <Button variant="secondary" size="xs" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="max-h-[520px] divide-y divide-secondary-100 overflow-y-auto dark:divide-secondary-800">
            {filteredEvents.slice(0, 25).map((event) => {
              const pair = pairs.find((candidate) => candidate.id === event.pairId);
              const strategy = strategies.find((candidate) => candidate.id === event.strategyId);
              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelectedEvent(event)}
                  className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-secondary-50 dark:hover:bg-secondary-800/40"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary-100 text-secondary-500 dark:bg-secondary-800 dark:text-secondary-400">
                    <Icon name={typeIcon[event.type]} size={13} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-secondary-900 dark:text-white">
                        {event.title}
                      </span>
                      <Badge tone={statusTone[event.status]}>{statusLabel[event.status]}</Badge>
                      <span className="text-[10px] text-secondary-400 dark:text-secondary-500">
                        {typeLabel[event.type]}
                      </span>
                    </span>
                    <span className="mt-0.5 line-clamp-1 block text-[11px] text-secondary-500 dark:text-secondary-400">
                      {event.detail}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-secondary-400 dark:text-secondary-500">
                      {pair?.symbol ?? 'No pair'} · {strategy?.name ?? 'No strategy'} ·{' '}
                      {formatRelativeTime(event.timestamp)}
                    </span>
                  </span>
                  <Icon
                    name="chevronRight"
                    size={13}
                    className="mt-1 shrink-0 text-secondary-300"
                  />
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent?.title ?? 'Monitor event'}
        description={selectedEvent ? formatDateTime(selectedEvent.timestamp) : undefined}
        size="md"
      >
        {selectedEvent ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{typeLabel[selectedEvent.type]}</Badge>
              <Badge tone={statusTone[selectedEvent.status]}>
                {statusLabel[selectedEvent.status]}
              </Badge>
              <span className="text-[10px] tabular-nums text-secondary-400 dark:text-secondary-500">
                ID {selectedEvent.recordId}
              </span>
            </div>
            <div className="grid gap-3 rounded-lg border border-secondary-200 p-3 dark:border-secondary-800 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary-400 dark:text-secondary-500">
                  Pair
                </p>
                <p className="mt-0.5 text-xs font-medium text-secondary-900 dark:text-white">
                  {selectedPair?.symbol ?? 'No pair'}
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
                  {selectedStrategy?.name ?? 'No strategy'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary-400 dark:text-secondary-500">
                  Timestamp
                </p>
                <p className="mt-0.5 text-xs text-secondary-800 dark:text-secondary-200">
                  {formatDateTime(selectedEvent.timestamp)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary-400 dark:text-secondary-500">
                  Source
                </p>
                <p className="mt-0.5 text-xs text-secondary-800 dark:text-secondary-200">
                  Local mock data
                </p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary-400 dark:text-secondary-500">
                Event details
              </p>
              <p className="mt-1 text-xs leading-5 text-secondary-600 dark:text-secondary-300">
                {selectedEvent.detail}
              </p>
            </div>
            <div className="flex gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 dark:border-warning-500/20 dark:bg-warning-500/5">
              <Icon
                name="wifiOff"
                size={14}
                className="mt-0.5 shrink-0 text-warning-600 dark:text-warning-400"
              />
              <p className="text-[11px] leading-4 text-warning-700 dark:text-warning-300">
                This is a static demo event. No live market data was received and no broker
                connection exists. Signal status labels do not imply real execution.
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
