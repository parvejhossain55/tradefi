import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { DropdownMenu, type DropdownAction } from '@/components/ui/DropdownMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { StatCard } from '@/components/ui/StatCard';
import { StrategyFormDialog } from '@/components/strategies/StrategyFormDialog';
import { notify, notifyError } from '@/store/toastStore';
import { useTradingStore } from '@/store/tradingStore';
import type {
  StatusTone,
  StrategyAssignment,
  StrategyCategory,
  StrategyDefinition,
  TradingPair,
} from '@/types/trading';
import { MARKET_TYPES, STRATEGY_CATEGORIES } from '@/types/trading';
import {
  formatDateTime,
  formatRelativeTime,
  getConfigurationStatus,
  getStrategyById,
} from '@/utils/trading';

const categoryTone: Record<StrategyCategory, StatusTone> = {
  Liquidity: 'primary',
  'Price Action': 'info',
  Momentum: 'success',
  'Mean Reversion': 'warning',
  Breakout: 'neutral',
};

const EMPTY_LIST: never[] = [];

export function StrategyLibrary() {
  const snapshot = useTradingStore((state) => state.snapshot);
  const setStrategyEnabled = useTradingStore((state) => state.setStrategyEnabled);
  const duplicateStrategy = useTradingStore((state) => state.duplicateStrategy);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [marketFilter, setMarketFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<StrategyDefinition | null>(null);
  const [viewingStrategyId, setViewingStrategyId] = useState<string | null>(null);
  const [pendingToggle, setPendingToggle] = useState<StrategyDefinition | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const strategies = snapshot?.strategies ?? EMPTY_LIST;
  const assignments = snapshot?.assignments ?? EMPTY_LIST;
  const pairs = snapshot?.pairs ?? EMPTY_LIST;

  const filteredStrategies = useMemo(() => {
    const term = query.trim().toLowerCase();
    return strategies.filter((strategy) => {
      if (categoryFilter !== 'all' && strategy.category !== categoryFilter) return false;
      if (statusFilter === 'enabled' && !strategy.enabled) return false;
      if (statusFilter === 'disabled' && strategy.enabled) return false;
      if (
        marketFilter !== 'all' &&
        !strategy.supportedMarkets.includes(marketFilter as (typeof MARKET_TYPES)[number])
      ) {
        return false;
      }
      if (!term) return true;
      return (
        strategy.name.toLowerCase().includes(term) ||
        strategy.identifier.toLowerCase().includes(term) ||
        strategy.category.toLowerCase().includes(term) ||
        strategy.description.toLowerCase().includes(term)
      );
    });
  }, [categoryFilter, marketFilter, query, statusFilter, strategies]);

  const viewingStrategy = getStrategyById(strategies, viewingStrategyId);
  const viewingAssignments = assignments.filter(
    (assignment) => assignment.strategyId === viewingStrategyId
  );
  const viewedPairs = viewingAssignments
    .map((assignment) => pairs.find((pair) => pair.id === assignment.pairId))
    .filter((pair): pair is TradingPair => Boolean(pair));

  const toggleCopy = pendingToggle
    ? pendingToggle.enabled
      ? {
          title: `Disable ${pendingToggle.name}?`,
          description:
            'Automation will be switched off for pairs using this definition. Assignments and pair-specific configurations are preserved, and the definition remains available for review.',
          confirm: 'Disable strategy',
          tone: 'danger' as const,
        }
      : {
          title: `Enable ${pendingToggle.name}?`,
          description:
            'The definition becomes available for assignments. Pair automation is not restored automatically; enable it per pair when ready.',
          confirm: 'Enable strategy',
          tone: 'primary' as const,
        }
    : null;

  const handleToggle = async () => {
    if (!pendingToggle) return;
    setToggleLoading(true);
    try {
      await setStrategyEnabled(pendingToggle.id, !pendingToggle.enabled);
      notify({
        tone: 'success',
        title: pendingToggle.enabled ? 'Strategy disabled' : 'Strategy enabled',
        description: pendingToggle.enabled
          ? `${pendingToggle.name} was disabled. Pair configurations were preserved.`
          : `${pendingToggle.name} is enabled. Pair automation remains off until enabled per pair.`,
      });
      setPendingToggle(null);
    } catch (error) {
      notifyError(error, 'The strategy status could not be changed.');
    } finally {
      setToggleLoading(false);
    }
  };

  const handleDuplicate = async (strategy: StrategyDefinition) => {
    setDuplicatingId(strategy.id);
    try {
      await duplicateStrategy(strategy.id);
      notify({
        tone: 'success',
        title: 'Strategy duplicated',
        description: `A disabled copy of ${strategy.name} was created with its schema and defaults preserved.`,
      });
    } catch (error) {
      notifyError(error, 'The strategy could not be duplicated.');
    } finally {
      setDuplicatingId(null);
    }
  };

  const actionsForStrategy = (strategy: StrategyDefinition): DropdownAction[] => [
    {
      label: 'Edit metadata & schema',
      icon: 'edit',
      onSelect: () => setEditingStrategy(strategy),
    },
    {
      label: 'View assigned pairs',
      icon: 'assignments',
      onSelect: () => setViewingStrategyId(strategy.id),
    },
    {
      label: 'Duplicate strategy',
      icon: 'copy',
      disabled: duplicatingId === strategy.id,
      onSelect: () => void handleDuplicate(strategy),
    },
    {
      label: strategy.enabled ? 'Disable strategy' : 'Enable strategy',
      icon: strategy.enabled ? 'pause' : 'play',
      tone: strategy.enabled ? 'danger' : 'default',
      separatorBefore: true,
      onSelect: () => setPendingToggle(strategy),
    },
  ];

  const assignmentColumns: DataTableColumn<StrategyAssignment & { pair?: TradingPair }>[] = [
    {
      key: 'pair',
      header: 'Pair',
      render: (assignment) => (
        <div>
          <Link
            to={`/trading-pairs/${assignment.pairId}?tab=configuration`}
            onClick={() => setViewingStrategyId(null)}
            className="font-semibold tabular-nums text-secondary-900 hover:text-primary-600 dark:text-white dark:hover:text-primary-400"
          >
            {assignment.pair?.symbol ?? 'Unknown pair'}
          </Link>
          <p className="text-[10px] text-secondary-500 dark:text-secondary-400">
            {assignment.pair?.displayName}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Assignment',
      render: (assignment) => (
        <Badge tone={assignment.status === 'active' ? 'success' : 'warning'}>
          {assignment.status === 'active' ? 'Active' : 'Disabled'}
        </Badge>
      ),
    },
    {
      key: 'configuration',
      header: 'Configuration',
      render: (assignment) => {
        const status = getConfigurationStatus(assignment);
        return (
          <div className="flex flex-col items-start gap-0.5">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span className="text-[10px] tabular-nums text-secondary-400 dark:text-secondary-500">
              {Object.keys(assignment.configuration).length} overrides · v
              {assignment.configurationVersion}
            </span>
          </div>
        );
      },
    },
    {
      key: 'updated',
      header: 'Updated',
      render: (assignment) => (
        <span
          className="whitespace-nowrap text-[10px] text-secondary-500 dark:text-secondary-400"
          title={formatDateTime(assignment.updatedAt)}
        >
          {formatRelativeTime(assignment.updatedAt)}
        </span>
      ),
    },
    {
      key: 'open',
      header: '',
      align: 'right',
      render: (assignment) => (
        <Link
          to={`/trading-pairs/${assignment.pairId}?tab=configuration`}
          onClick={() => setViewingStrategyId(null)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:underline dark:text-primary-400"
        >
          Configure
          <Icon name="chevronRight" size={12} />
        </Link>
      ),
    },
  ];

  const clearFilters = () => {
    setQuery('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setMarketFilter('all');
  };

  if (!snapshot) return null;

  const enabledCount = strategies.filter((strategy) => strategy.enabled).length;
  const assignedPairCount = new Set(assignments.map((assignment) => assignment.pairId)).size;

  return (
    <div>
      <PageHeader
        title="Strategy Library"
        description="Reusable strategy definitions and their parameter schemas. These are configuration templates only — this frontend does not execute strategy logic."
        actions={
          <Button size="sm" icon="plus" onClick={() => setCreateOpen(true)}>
            Create strategy
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Definitions"
          value={strategies.length}
          hint="Reusable templates"
          icon="strategies"
          tone="primary"
        />
        <StatCard
          label="Enabled"
          value={enabledCount}
          hint={`${strategies.length - enabledCount} disabled`}
          icon="checkCircle"
          tone="success"
        />
        <StatCard
          label="Assigned pairs"
          value={assignedPairCount}
          hint="Across all assignments"
          icon="assignments"
          tone="neutral"
        />
        <StatCard
          label="Categories"
          value={new Set(strategies.map((strategy) => strategy.category)).size}
          hint="Strategy classification"
          icon="layers"
          tone="neutral"
        />
      </div>

      <div className="my-4 flex gap-2 rounded-lg border border-primary-200 bg-primary-50/60 px-3.5 py-2.5 dark:border-primary-500/20 dark:bg-primary-500/5">
        <Icon
          name="info"
          size={15}
          className="mt-0.5 shrink-0 text-primary-600 dark:text-primary-400"
        />
        <p className="text-[11px] leading-5 text-primary-800/80 dark:text-primary-300/80">
          Editing metadata or default parameters never overwrites already-saved pair overrides. Each
          pair keeps its own assignment record and configuration values.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Definitions"
          description={`${filteredStrategies.length} of ${strategies.length} definitions shown`}
        />
        <div className="flex flex-col gap-2 border-b border-secondary-200 px-4 py-3 dark:border-secondary-800 lg:flex-row lg:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search name, identifier, category…"
            ariaLabel="Search strategy definitions"
            className="lg:max-w-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Select
              aria-label="Filter strategies by category"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-9 w-auto min-w-[145px] py-1 text-xs"
            >
              <option value="all">All categories</option>
              {STRATEGY_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter strategies by market"
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
              aria-label="Filter strategies by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 w-auto min-w-[125px] py-1 text-xs"
            >
              <option value="all">All statuses</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </Select>
            {query ||
            categoryFilter !== 'all' ||
            marketFilter !== 'all' ||
            statusFilter !== 'all' ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        {filteredStrategies.length === 0 ? (
          <EmptyState
            icon={strategies.length === 0 ? 'strategies' : 'filter'}
            title={
              strategies.length === 0
                ? 'No strategy definitions'
                : 'No definitions match these filters'
            }
            description={
              strategies.length === 0
                ? 'Create a reusable strategy definition with a parameter schema, then assign it to pairs.'
                : 'Adjust the search or filters to see strategy definitions.'
            }
            action={
              strategies.length === 0 ? (
                <Button size="sm" icon="plus" onClick={() => setCreateOpen(true)}>
                  Create strategy
                </Button>
              ) : (
                <Button variant="secondary" size="xs" onClick={clearFilters}>
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredStrategies.map((strategy) => {
              const strategyAssignments = assignments.filter(
                (assignment) => assignment.strategyId === strategy.id
              );
              const activeAssignments = strategyAssignments.filter((assignment) => {
                const pair = pairs.find((candidate) => candidate.id === assignment.pairId);
                return assignment.status === 'active' && pair?.status === 'enabled';
              }).length;
              return (
                <div
                  key={strategy.id}
                  className={`flex flex-col rounded-lg border p-3.5 transition-colors ${
                    strategy.enabled
                      ? 'border-secondary-200 bg-white dark:border-secondary-800 dark:bg-secondary-900'
                      : 'border-secondary-200 bg-secondary-50/70 dark:border-secondary-800 dark:bg-secondary-950/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 gap-2.5">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
                        <Icon name="strategies" size={16} />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-secondary-900 dark:text-white">
                          {strategy.name}
                        </h3>
                        <p className="truncate text-[10px] text-secondary-500 dark:text-secondary-400">
                          <code>{strategy.identifier}</code> · v{strategy.version}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu
                      actions={actionsForStrategy(strategy)}
                      label={`Actions for ${strategy.name}`}
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone={categoryTone[strategy.category]}>{strategy.category}</Badge>
                    <Badge tone={strategy.enabled ? 'success' : 'neutral'} dot>
                      {strategy.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    {activeAssignments > 0 ? (
                      <Badge tone="info">{activeAssignments} active</Badge>
                    ) : null}
                  </div>

                  <p className="mt-2 line-clamp-2 min-h-[32px] text-[11px] leading-4 text-secondary-500 dark:text-secondary-400">
                    {strategy.description}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-secondary-100 pt-2.5 text-[10px] dark:border-secondary-800">
                    <div>
                      <p className="text-secondary-400 dark:text-secondary-500">Parameters</p>
                      <p className="mt-0.5 font-medium tabular-nums text-secondary-800 dark:text-secondary-200">
                        {strategy.parameterSchema.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-secondary-400 dark:text-secondary-500">Assigned pairs</p>
                      <p className="mt-0.5 font-medium tabular-nums text-secondary-800 dark:text-secondary-200">
                        {strategyAssignments.length}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-secondary-400 dark:text-secondary-500">Markets</p>
                      <p className="mt-0.5 truncate font-medium text-secondary-800 dark:text-secondary-200">
                        {strategy.supportedMarkets.join(' · ')}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-secondary-400 dark:text-secondary-500">Timeframes</p>
                      <p className="mt-0.5 truncate font-medium text-secondary-800 dark:text-secondary-200">
                        {strategy.supportedTimeframes.join(' · ')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-secondary-100 pt-2.5 dark:border-secondary-800">
                    <span className="text-[10px] text-secondary-400 dark:text-secondary-500">
                      Updated {formatRelativeTime(strategy.updatedAt)}
                    </span>
                    <Button
                      variant="ghost"
                      size="xs"
                      icon="assignments"
                      onClick={() => setViewingStrategyId(strategy.id)}
                    >
                      Assigned pairs
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <StrategyFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <StrategyFormDialog
        open={Boolean(editingStrategy)}
        strategy={editingStrategy}
        onClose={() => setEditingStrategy(null)}
      />

      <Modal
        open={Boolean(viewingStrategy)}
        onClose={() => setViewingStrategyId(null)}
        title={viewingStrategy ? `Assigned pairs · ${viewingStrategy.name}` : 'Assigned pairs'}
        description="Each row is a pair-specific assignment. Configuration values stay independent per pair."
        size="lg"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setViewingStrategyId(null)}>
            Close
          </Button>
        }
      >
        {viewingStrategy ? (
          viewedPairs.length === 0 ? (
            <EmptyState
              compact
              icon="assignments"
              title="No pairs assigned"
              description="Use Strategy Assignments or a pair details page to assign this definition."
              action={
                <Link
                  to="/assignments"
                  onClick={() => setViewingStrategyId(null)}
                  className="text-[11px] font-medium text-primary-600 hover:underline dark:text-primary-400"
                >
                  Open strategy assignments
                </Link>
              }
            />
          ) : (
            <DataTable
              data={viewingAssignments.map((assignment) => ({
                ...assignment,
                pair: pairs.find((pair) => pair.id === assignment.pairId),
              }))}
              columns={assignmentColumns}
              rowKey={(assignment) => assignment.id}
              pageSize={10}
              emptyState="No assigned pairs."
            />
          )
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingToggle)}
        title={toggleCopy?.title ?? 'Confirm strategy change'}
        description={toggleCopy?.description}
        confirmLabel={toggleCopy?.confirm ?? 'Confirm'}
        tone={toggleCopy?.tone ?? 'danger'}
        loading={toggleLoading}
        onCancel={() => setPendingToggle(null)}
        onConfirm={() => void handleToggle()}
      />
    </div>
  );
}
