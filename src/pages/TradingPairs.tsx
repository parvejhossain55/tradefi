import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { DropdownMenu, type DropdownAction } from '@/components/ui/DropdownMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { AssignStrategyDialog } from '@/components/assignments/AssignStrategyDialog';
import { PairFormDialog } from '@/components/pairs/PairFormDialog';
import { notify, notifyError } from '@/store/toastStore';
import { useTradingStore } from '@/store/tradingStore';
import type { TradingPair } from '@/types/trading';
import { MARKET_TYPES, PAIR_STATUS_LABELS } from '@/types/trading';
import {
  formatDateTime,
  formatRelativeTime,
  getAssignmentForPair,
  getAutomationStatus,
  getConfigurationStatus,
  getPairStatusTone,
  getStrategyById,
} from '@/utils/trading';

type PendingAction = { pair: TradingPair; type: 'archive' | 'disable' | 'enable' };

const EMPTY_LIST: never[] = [];

export function TradingPairs() {
  const snapshot = useTradingStore((state) => state.snapshot);
  const setPairStatus = useTradingStore((state) => state.setPairStatus);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [marketFilter, setMarketFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPair, setEditingPair] = useState<TradingPair | null>(null);
  const [assignPairId, setAssignPairId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const pairs = snapshot?.pairs ?? EMPTY_LIST;
  const assignments = snapshot?.assignments ?? EMPTY_LIST;
  const strategies = snapshot?.strategies ?? EMPTY_LIST;
  const globalRisk = snapshot?.globalRisk;

  const filteredPairs = useMemo(() => {
    const term = query.trim().toLowerCase();
    return pairs.filter((pair) => {
      if (marketFilter !== 'all' && pair.marketType !== marketFilter) return false;
      if (statusFilter !== 'all' && pair.status !== statusFilter) return false;
      if (!term) return true;
      return (
        pair.symbol.toLowerCase().includes(term) ||
        pair.displayName.toLowerCase().includes(term) ||
        (pair.broker ?? '').toLowerCase().includes(term)
      );
    });
  }, [marketFilter, pairs, query, statusFilter]);

  const statusActionCopy = pendingAction
    ? pendingAction.type === 'archive'
      ? {
          title: `Archive ${pendingAction.pair.symbol}?`,
          description:
            'The pair will leave active operations, its strategy assignment will be disabled, and automation will be switched off. Historical signals and executions remain available.',
          confirm: 'Archive pair',
          tone: 'danger' as const,
        }
      : pendingAction.type === 'disable'
        ? {
            title: `Disable ${pendingAction.pair.symbol}?`,
            description:
              'Disabling switches automation off and pauses the pair. Its strategy configuration and history are preserved.',
            confirm: 'Disable pair',
            tone: 'danger' as const,
          }
        : {
            title: `Enable ${pendingAction.pair.symbol}?`,
            description:
              'The pair becomes operational again. Automation does not turn on automatically.',
            confirm: 'Enable pair',
            tone: 'primary' as const,
          }
    : null;

  const handleStatusAction = async () => {
    if (!pendingAction) return;
    setActionLoading(true);
    try {
      const status =
        pendingAction.type === 'archive'
          ? 'archived'
          : pendingAction.type === 'disable'
            ? 'disabled'
            : 'enabled';
      await setPairStatus(pendingAction.pair.id, status);
      notify({
        tone: 'success',
        title:
          status === 'archived'
            ? 'Pair archived'
            : status === 'disabled'
              ? 'Pair disabled'
              : 'Pair enabled',
        description:
          status === 'archived'
            ? `${pendingAction.pair.symbol} was archived and its assignment disabled.`
            : `${pendingAction.pair.symbol} is now ${PAIR_STATUS_LABELS[status].toLowerCase()}.`,
      });
      setPendingAction(null);
    } catch (error) {
      notifyError(error, 'The pair status could not be changed.');
    } finally {
      setActionLoading(false);
    }
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
        label: 'Edit pair metadata',
        icon: 'edit',
        onSelect: () => setEditingPair(pair),
      },
      {
        label: 'Edit strategy configuration',
        icon: 'sliders',
        disabled: !assignment || pair.status === 'archived',
        onSelect: () => navigate(`/trading-pairs/${pair.id}?tab=configuration`),
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
        <div className="min-w-[130px]">
          <div className="flex items-center gap-2">
            <Link
              to={`/trading-pairs/${pair.id}`}
              className="font-semibold tabular-nums text-secondary-900 hover:text-primary-600 dark:text-white dark:hover:text-primary-400"
            >
              {pair.symbol}
            </Link>
            {pair.status === 'archived' ? (
              <Icon name="archive" size={12} className="text-secondary-400" title="Archived" />
            ) : null}
          </div>
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
        <div>
          <p className="text-xs text-secondary-700 dark:text-secondary-300">{pair.marketType}</p>
          {pair.broker ? (
            <p className="text-[10px] text-secondary-400 dark:text-secondary-500">{pair.broker}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'strategy',
      header: 'Assigned strategy',
      sortValue: (pair) => {
        const assignment = getAssignmentForPair(assignments, pair.id);
        return getStrategyById(strategies, assignment?.strategyId)?.name ?? 'zzz';
      },
      render: (pair) => {
        const assignment = getAssignmentForPair(assignments, pair.id);
        const strategy = getStrategyById(strategies, assignment?.strategyId);
        return strategy ? (
          <div className="min-w-[125px]">
            <p className="text-xs font-medium text-secondary-800 dark:text-secondary-200">
              {strategy.name}
            </p>
            <p className="text-[10px] tabular-nums text-secondary-400 dark:text-secondary-500">
              v{assignment?.strategyVersion} · {analysisSummary(assignment?.configuration ?? {})}
            </p>
          </div>
        ) : (
          <span className="text-[11px] text-secondary-400 dark:text-secondary-500">Unassigned</span>
        );
      },
    },
    {
      key: 'timeframe',
      header: 'Default TF',
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
      key: 'status',
      header: 'Pair status',
      sortValue: (pair) => pair.status,
      render: (pair) => (
        <Badge tone={getPairStatusTone(pair.status)} dot>
          {PAIR_STATUS_LABELS[pair.status]}
        </Badge>
      ),
    },
    {
      key: 'configuration',
      header: 'Configuration',
      sortValue: (pair) => {
        const assignment = getAssignmentForPair(assignments, pair.id);
        return getConfigurationStatus(assignment).label;
      },
      render: (pair) => {
        const assignment = getAssignmentForPair(assignments, pair.id);
        const status = getConfigurationStatus(assignment);
        return <Badge tone={status.tone}>{status.label}</Badge>;
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
          <div title={status.detail}>
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
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

  const clearFilters = () => {
    setQuery('');
    setMarketFilter('all');
    setStatusFilter('all');
  };

  if (!snapshot) return null;

  return (
    <div>
      <PageHeader
        title="Trading Pairs"
        description="Manage supported market pairs, their lifecycle, and which reusable strategy definition is assigned. Symbols are normalized to uppercase letters and digits and must be unique."
        actions={
          <Button size="sm" icon="plus" onClick={() => setCreateOpen(true)}>
            Create pair
          </Button>
        }
      />

      <Card>
        <CardHeader
          title="All pairs"
          description={`${pairs.length} configured · ${
            pairs.filter((pair) => pair.status === 'enabled').length
          } enabled · ${pairs.filter((pair) => pair.status === 'archived').length} archived`}
        />
        <div className="flex flex-col gap-2 border-b border-secondary-200 px-4 py-3 dark:border-secondary-800 sm:flex-row sm:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search by pair symbol, name, or source…"
            ariaLabel="Search trading pairs"
            className="sm:max-w-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Select
              aria-label="Filter pairs by market"
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
              aria-label="Filter pairs by status"
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
          <span className="ml-auto hidden text-[11px] tabular-nums text-secondary-500 dark:text-secondary-400 md:block">
            {filteredPairs.length} shown
          </span>
        </div>

        <DataTable
          data={filteredPairs}
          columns={columns}
          rowKey={(pair) => pair.id}
          initialSort={{ key: 'pair', direction: 'asc' }}
          pageSize={10}
          resetKey={`${query}|${marketFilter}|${statusFilter}`}
          emptyState={
            pairs.length === 0 ? (
              <EmptyState
                icon="pairs"
                title="No trading pairs yet"
                description="Create a pair, then assign a reusable strategy configuration."
                action={
                  <Button size="sm" icon="plus" onClick={() => setCreateOpen(true)}>
                    Create pair
                  </Button>
                }
              />
            ) : (
              <EmptyState
                compact
                icon="filter"
                title="No pairs match these filters"
                description="Adjust or clear the search and filters."
                action={
                  <Button variant="secondary" size="xs" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            )
          }
        />
      </Card>

      <PairFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <PairFormDialog
        open={Boolean(editingPair)}
        pair={editingPair}
        onClose={() => setEditingPair(null)}
      />

      {assignPairId ? (
        <AssignStrategyDialog open pairId={assignPairId} onClose={() => setAssignPairId(null)} />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={statusActionCopy?.title ?? 'Confirm action'}
        description={statusActionCopy?.description}
        confirmLabel={statusActionCopy?.confirm ?? 'Confirm'}
        tone={statusActionCopy?.tone ?? 'danger'}
        icon={pendingAction?.type === 'archive' ? 'archive' : 'alertTriangle'}
        loading={actionLoading}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void handleStatusAction()}
      >
        {pendingAction?.type === 'archive' ? (
          <div className="rounded-md border border-secondary-200 bg-secondary-50 px-2.5 py-1.5 text-[11px] text-secondary-600 dark:border-secondary-700 dark:bg-secondary-800 dark:text-secondary-300">
            Scope: {pendingAction.pair.symbol} only. Historical signals and execution records are
            retained.
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

function analysisSummary(configuration: Record<string, string | number | boolean>): string {
  const keys = Object.keys(configuration).length;
  return keys === 0 ? 'defaults' : `${keys} override${keys === 1 ? '' : 's'}`;
}
