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
import { StatCard } from '@/components/ui/StatCard';
import { AssignStrategyDialog } from '@/components/assignments/AssignStrategyDialog';
import { notify, notifyError } from '@/store/toastStore';
import { useTradingStore } from '@/store/tradingStore';
import type {
  AssignmentStatus,
  StrategyAssignment,
  StrategyDefinition,
  TradingPair,
} from '@/types/trading';
import { MARKET_TYPES, PAIR_STATUS_LABELS } from '@/types/trading';
import {
  formatDateTime,
  formatRelativeTime,
  getAutomationStatus,
  getConfigurationStatus,
  getPairStatusTone,
  getStrategyById,
} from '@/utils/trading';

interface AssignmentRow {
  pair: TradingPair;
  assignment?: StrategyAssignment;
  strategy?: StrategyDefinition;
}

type PendingAssignmentAction = {
  pair: TradingPair;
  nextStatus: AssignmentStatus;
};

const EMPTY_LIST: never[] = [];

export function Assignments() {
  const snapshot = useTradingStore((state) => state.snapshot);
  const setAssignmentStatus = useTradingStore((state) => state.setAssignmentStatus);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [marketFilter, setMarketFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [assignPairId, setAssignPairId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAssignmentAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const globalRisk = snapshot?.globalRisk;
  const assignments = snapshot?.assignments ?? EMPTY_LIST;
  const strategies = snapshot?.strategies ?? EMPTY_LIST;

  const rows = useMemo<AssignmentRow[]>(
    () =>
      (snapshot?.pairs ?? EMPTY_LIST).map((pair) => {
        const assignment = assignments.find((candidate) => candidate.pairId === pair.id);
        return {
          pair,
          assignment,
          strategy: getStrategyById(strategies, assignment?.strategyId),
        };
      }),
    [assignments, snapshot?.pairs, strategies]
  );

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (marketFilter !== 'all' && row.pair.marketType !== marketFilter) return false;
      if (strategyFilter !== 'all' && row.assignment?.strategyId !== strategyFilter) return false;
      if (assignmentFilter === 'assigned' && !row.assignment) return false;
      if (assignmentFilter === 'unassigned' && row.assignment) return false;
      if (assignmentFilter === 'active' && row.assignment?.status !== 'active') return false;
      if (assignmentFilter === 'disabled' && row.assignment?.status !== 'disabled') return false;
      if (!term) return true;
      return (
        row.pair.symbol.toLowerCase().includes(term) ||
        row.pair.displayName.toLowerCase().includes(term) ||
        (row.strategy?.name ?? '').toLowerCase().includes(term)
      );
    });
  }, [assignmentFilter, marketFilter, query, rows, strategyFilter]);

  const assignedCount = rows.filter((row) => row.assignment).length;
  const unassignedCount = rows.length - assignedCount;
  const disabledCount = rows.filter((row) => row.assignment?.status === 'disabled').length;
  const automatedCount = rows.filter((row) => {
    if (!row.assignment || !globalRisk) return false;
    return (
      getAutomationStatus(row.pair, row.assignment, row.strategy, globalRisk).label === 'Active'
    );
  }).length;

  const actionsForRow = (row: AssignmentRow): DropdownAction[] => [
    {
      label: 'View pair details',
      icon: 'eye',
      onSelect: () => navigate(`/trading-pairs/${row.pair.id}`),
    },
    {
      label: 'Inspect configuration',
      icon: 'sliders',
      disabled: !row.assignment,
      onSelect: () => navigate(`/trading-pairs/${row.pair.id}?tab=configuration`),
    },
    {
      label: row.assignment ? 'Reassign strategy' : 'Assign strategy',
      icon: 'link',
      disabled: row.pair.status === 'archived',
      onSelect: () => setAssignPairId(row.pair.id),
    },
    {
      label: row.assignment?.status === 'active' ? 'Disable assignment' : 'Enable assignment',
      icon: row.assignment?.status === 'active' ? 'pause' : 'play',
      disabled: !row.assignment || row.pair.status === 'archived',
      separatorBefore: true,
      onSelect: () =>
        setPendingAction({
          pair: row.pair,
          nextStatus: row.assignment?.status === 'active' ? 'disabled' : 'active',
        }),
    },
  ];

  const columns: DataTableColumn<AssignmentRow>[] = [
    {
      key: 'pair',
      header: 'Pair',
      sortValue: (row) => row.pair.symbol,
      render: (row) => (
        <div className="min-w-[130px]">
          <div className="flex items-center gap-1.5">
            <Link
              to={`/trading-pairs/${row.pair.id}`}
              className="font-semibold tabular-nums text-secondary-900 hover:text-primary-600 dark:text-white dark:hover:text-primary-400"
            >
              {row.pair.symbol}
            </Link>
            <Badge tone={getPairStatusTone(row.pair.status)}>
              {PAIR_STATUS_LABELS[row.pair.status]}
            </Badge>
          </div>
          <p className="text-[10px] text-secondary-500 dark:text-secondary-400">
            {row.pair.displayName} · {row.pair.marketType}
          </p>
        </div>
      ),
    },
    {
      key: 'strategy',
      header: 'Assigned strategy',
      sortValue: (row) => row.strategy?.name ?? 'zzz',
      render: (row) =>
        row.assignment && row.strategy ? (
          <div className="min-w-[140px]">
            <p className="text-xs font-medium text-secondary-800 dark:text-secondary-200">
              {row.strategy.name}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              <Badge tone={row.assignment.status === 'active' ? 'success' : 'warning'}>
                {row.assignment.status === 'active' ? 'Assignment active' : 'Assignment off'}
              </Badge>
              {!row.strategy.enabled ? <Badge tone="neutral">Definition disabled</Badge> : null}
            </div>
          </div>
        ) : (
          <span className="text-[11px] text-secondary-400 dark:text-secondary-500">Unassigned</span>
        ),
    },
    {
      key: 'version',
      header: 'Strategy version',
      sortValue: (row) => row.strategy?.version ?? '',
      className: 'hidden md:table-cell',
      headerClassName: 'hidden md:table-cell',
      render: (row) =>
        row.strategy && row.assignment ? (
          <div className="min-w-[75px]">
            <p className="text-[11px] font-medium tabular-nums text-secondary-800 dark:text-secondary-200">
              v{row.strategy.version}
            </p>
            <p
              className={`text-[10px] tabular-nums ${
                row.strategy.version !== row.assignment.strategyVersion
                  ? 'text-warning-600 dark:text-warning-400'
                  : 'text-secondary-400 dark:text-secondary-500'
              }`}
            >
              stamped v{row.assignment.strategyVersion}
            </p>
          </div>
        ) : (
          <span className="text-[11px] text-secondary-400 dark:text-secondary-500">—</span>
        ),
    },
    {
      key: 'configuration',
      header: 'Configuration',
      sortValue: (row) => getConfigurationStatus(row.assignment).label,
      render: (row) => {
        const status = getConfigurationStatus(row.assignment);
        const count = row.assignment ? Object.keys(row.assignment.configuration).length : 0;
        return row.assignment ? (
          <div className="min-w-[100px]">
            <Badge tone={status.tone}>{status.label}</Badge>
            <p className="mt-0.5 text-[10px] tabular-nums text-secondary-400 dark:text-secondary-500">
              {count} override{count === 1 ? '' : 's'} · v{row.assignment.configurationVersion}
            </p>
          </div>
        ) : (
          <span className="text-[11px] text-secondary-400 dark:text-secondary-500">—</span>
        );
      },
    },
    {
      key: 'automation',
      header: 'Automation',
      sortValue: (row) =>
        globalRisk
          ? getAutomationStatus(row.pair, row.assignment, row.strategy, globalRisk).label
          : '',
      render: (row) => {
        if (!globalRisk) return null;
        const status = getAutomationStatus(row.pair, row.assignment, row.strategy, globalRisk);
        return (
          <div className="min-w-[110px]" title={status.detail}>
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
          </div>
        );
      },
    },
    {
      key: 'updated',
      header: 'Last updated',
      sortValue: (row) => row.assignment?.updatedAt ?? row.pair.updatedAt,
      className: 'hidden lg:table-cell',
      headerClassName: 'hidden lg:table-cell',
      render: (row) => (
        <span
          className="whitespace-nowrap text-[10px] text-secondary-500 dark:text-secondary-400"
          title={formatDateTime(row.assignment?.updatedAt ?? row.pair.updatedAt)}
        >
          {formatRelativeTime(row.assignment?.updatedAt ?? row.pair.updatedAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <DropdownMenu actions={actionsForRow(row)} label={`Actions for ${row.pair.symbol}`} />
      ),
    },
  ];

  const handleToggleAssignment = async () => {
    if (!pendingAction) return;
    setActionLoading(true);
    try {
      await setAssignmentStatus(pendingAction.pair.id, pendingAction.nextStatus);
      notify({
        tone: 'success',
        title: pendingAction.nextStatus === 'active' ? 'Assignment enabled' : 'Assignment disabled',
        description:
          pendingAction.nextStatus === 'active'
            ? `${pendingAction.pair.symbol} assignment is active. Pair automation remains off until enabled.`
            : `${pendingAction.pair.symbol} assignment was disabled and automation switched off. Configuration was preserved.`,
      });
      setPendingAction(null);
    } catch (error) {
      notifyError(error, 'The assignment status could not be changed.');
    } finally {
      setActionLoading(false);
    }
  };

  const clearFilters = () => {
    setQuery('');
    setStrategyFilter('all');
    setMarketFilter('all');
    setAssignmentFilter('all');
  };

  if (!snapshot || !globalRisk) return null;

  return (
    <div>
      <PageHeader
        title="Strategy Assignments"
        description="The relationship between pairs and reusable strategy definitions. Each pair owns one assignment record with independent configuration values."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Configured pairs"
          value={rows.length}
          hint={`${assignedCount} assigned`}
          icon="pairs"
          tone="primary"
        />
        <StatCard
          label="Unassigned"
          value={unassignedCount}
          hint="Awaiting a strategy"
          icon="info"
          tone={unassignedCount > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Disabled assignments"
          value={disabledCount}
          hint="Configuration preserved"
          icon="pause"
          tone={disabledCount > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Effectively automated"
          value={automatedCount}
          hint="Demo mode only"
          icon="activity"
          tone="success"
        />
      </div>

      <div className="my-4 flex gap-2 rounded-lg border border-secondary-200 bg-white px-3.5 py-2.5 dark:border-secondary-800 dark:bg-secondary-900">
        <Icon
          name="info"
          size={15}
          className="mt-0.5 shrink-0 text-primary-600 dark:text-primary-400"
        />
        <p className="text-[11px] leading-5 text-secondary-500 dark:text-secondary-400">
          One active strategy per pair is supported initially. Assignment records use stable pair
          and strategy IDs, so multiple strategies per pair can be added later without changing page
          contracts.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Pair assignments"
          description={`${filteredRows.length} of ${rows.length} pairs shown`}
        />
        <div className="flex flex-col gap-2 border-b border-secondary-200 px-4 py-3 dark:border-secondary-800 lg:flex-row lg:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search pair or strategy…"
            ariaLabel="Search assignments"
            className="lg:max-w-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Select
              aria-label="Filter assignments by strategy"
              value={strategyFilter}
              onChange={(event) => setStrategyFilter(event.target.value)}
              className="h-9 w-auto min-w-[150px] py-1 text-xs"
            >
              <option value="all">All strategies</option>
              {strategies.map((strategy) => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter assignments by market"
              value={marketFilter}
              onChange={(event) => setMarketFilter(event.target.value)}
              className="h-9 w-auto min-w-[125px] py-1 text-xs"
            >
              <option value="all">All markets</option>
              {MARKET_TYPES.map((market) => (
                <option key={market} value={market}>
                  {market}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter by assignment state"
              value={assignmentFilter}
              onChange={(event) => setAssignmentFilter(event.target.value)}
              className="h-9 w-auto min-w-[140px] py-1 text-xs"
            >
              <option value="all">All assignment states</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned</option>
              <option value="active">Active assignments</option>
              <option value="disabled">Disabled assignments</option>
            </Select>
            {query ||
            strategyFilter !== 'all' ||
            marketFilter !== 'all' ||
            assignmentFilter !== 'all' ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        <DataTable
          data={filteredRows}
          columns={columns}
          rowKey={(row) => row.pair.id}
          initialSort={{ key: 'pair', direction: 'asc' }}
          pageSize={10}
          resetKey={`${query}|${strategyFilter}|${marketFilter}|${assignmentFilter}`}
          emptyState={
            <EmptyState
              compact
              icon="filter"
              title="No assignments match these filters"
              description="Adjust or clear the search and filters."
              action={
                <Button variant="secondary" size="xs" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          }
        />
      </Card>

      {assignPairId ? (
        <AssignStrategyDialog open pairId={assignPairId} onClose={() => setAssignPairId(null)} />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={
          pendingAction
            ? `${
                pendingAction.nextStatus === 'active' ? 'Enable' : 'Disable'
              } assignment for ${pendingAction.pair.symbol}?`
            : 'Confirm assignment change'
        }
        description={
          pendingAction?.nextStatus === 'active'
            ? 'The assignment becomes active. Pair automation is not enabled automatically.'
            : 'Disabling the assignment switches pair automation off. The strategy configuration is retained and can be re-enabled later.'
        }
        confirmLabel={
          pendingAction?.nextStatus === 'active' ? 'Enable assignment' : 'Disable assignment'
        }
        tone={pendingAction?.nextStatus === 'active' ? 'primary' : 'danger'}
        icon={pendingAction?.nextStatus === 'active' ? 'play' : 'pause'}
        loading={actionLoading}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void handleToggleAssignment()}
      />
    </div>
  );
}
