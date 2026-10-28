import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { AssignStrategyDialog } from '@/components/assignments/AssignStrategyDialog';
import { ExecutionHistoryTable } from '@/components/executions/ExecutionHistoryTable';
import { PairFormDialog } from '@/components/pairs/PairFormDialog';
import { StrategyParameterFields } from '@/components/pairs/StrategyParameterFields';
import { PairRiskForm } from '@/components/risk/PairRiskForm';
import { SignalHistoryTable } from '@/components/signals/SignalHistoryTable';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { notify, notifyError } from '@/store/toastStore';
import { useTradingStore } from '@/store/tradingStore';
import { TradingApiError } from '@/services/tradingApi';
import type {
  PairRiskConfiguration,
  SessionRestriction,
  StrategyParameters,
} from '@/types/trading';
import {
  EXECUTION_EVENT_LABELS,
  PAIR_STATUS_LABELS,
  POSITION_SIZING_MODE_LABELS,
  SIGNAL_STATUS_LABELS,
  STOP_LOSS_MODE_LABELS,
  TAKE_PROFIT_MODE_LABELS,
} from '@/types/trading';
import { buttonClasses } from '@/utils/button';
import {
  buildConfigurationOverrides,
  buildDefaultParameters,
  configurationValuesEqual,
  createPairRiskFallback,
  formatDateTime,
  formatMinutes,
  formatRelativeTime,
  getAssignmentForPair,
  getAutomationStatus,
  getConfigurationStatus,
  getEffectiveRisk,
  getPairStatusTone,
  getStrategyById,
  resolveConfiguration,
  validateConfiguration,
} from '@/utils/trading';
import { cn } from '@/utils/cn';

type PairTab = 'overview' | 'strategy' | 'risk' | 'signals' | 'executions' | 'activity';
type PendingStatus = 'archive' | 'disable' | 'enable';

function normalizeTab(tab: string | null): PairTab {
  if (tab === 'configuration' || tab === 'strategy') return 'strategy';
  if (tab === 'risk') return 'risk';
  if (tab === 'signals') return 'signals';
  if (tab === 'executions') return 'executions';
  if (tab === 'activity') return 'activity';
  return 'overview';
}

function sessionSummary(restriction: SessionRestriction): string {
  return restriction.enabled ? restriction.sessions.join(', ') : 'Any session';
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-secondary-100 py-2 last:border-0 dark:border-secondary-800">
      <dt className="shrink-0 text-[11px] text-secondary-500 dark:text-secondary-400">{label}</dt>
      <dd className="min-w-0 text-right text-[11px] font-medium text-secondary-800 dark:text-secondary-200">
        {children}
      </dd>
    </div>
  );
}

export function PairDetails() {
  const { pairId } = useParams<{ pairId: string }>();
  const [searchParams] = useSearchParams();
  const snapshot = useTradingStore((state) => state.snapshot);
  const updateAssignmentConfiguration = useTradingStore(
    (state) => state.updateAssignmentConfiguration
  );
  const setPairAutomation = useTradingStore((state) => state.setPairAutomation);
  const setPairStatus = useTradingStore((state) => state.setPairStatus);

  const pair = snapshot?.pairs.find((candidate) => candidate.id === pairId);
  const assignment = useMemo(
    () => (snapshot && pair ? getAssignmentForPair(snapshot.assignments, pair.id) : undefined),
    [pair, snapshot]
  );
  const strategy = getStrategyById(snapshot?.strategies ?? [], assignment?.strategyId);
  const globalRisk = snapshot?.globalRisk;

  const pairRisk = useMemo<PairRiskConfiguration | null>(() => {
    if (!snapshot || !pair) return null;
    const existing = snapshot.pairRiskConfigurations.find(
      (configuration) => configuration.pairId === pair.id
    );
    return existing ?? createPairRiskFallback(pair.id, snapshot.globalRisk);
  }, [pair, snapshot]);

  const [activeTab, setActiveTab] = useState<PairTab>(() => normalizeTab(searchParams.get('tab')));
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<PendingStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [resetConfigOpen, setResetConfigOpen] = useState(false);
  const [automationConfirmOpen, setAutomationConfirmOpen] = useState(false);
  const [automationLoading, setAutomationLoading] = useState(false);

  const [draft, setDraft] = useState<StrategyParameters | null>(null);
  const [configErrors, setConfigErrors] = useState<Record<string, string>>({});
  const [configSaving, setConfigSaving] = useState(false);
  const lastConfigSignature = useRef('');

  const pairSignals = useMemo(
    () =>
      [...(snapshot?.signals ?? [])]
        .filter((signal) => signal.pairId === pair?.id)
        .sort(
          (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
        ),
    [pair?.id, snapshot?.signals]
  );
  const pairExecutions = useMemo(
    () =>
      [...(snapshot?.executions ?? [])]
        .filter((execution) => execution.pairId === pair?.id)
        .sort(
          (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
        ),
    [pair?.id, snapshot?.executions]
  );
  const pairEvents = useMemo(
    () =>
      [...(snapshot?.events ?? [])]
        .filter((event) => event.pairId === pair?.id)
        .sort(
          (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
        ),
    [pair?.id, snapshot?.events]
  );

  const savedValues = useMemo(
    () =>
      assignment && strategy
        ? resolveConfiguration(strategy.parameterSchema, assignment.configuration)
        : null,
    [assignment, strategy]
  );

  const configDirty = Boolean(
    draft && savedValues && !configurationValuesEqual(draft, savedValues)
  );
  const customizedKeys =
    draft && strategy
      ? Object.keys(buildConfigurationOverrides(strategy.parameterSchema, draft))
      : [];

  const unsavedGuard = useUnsavedChanges(configDirty);

  useEffect(() => {
    const signature =
      assignment && strategy && pair
        ? `${pair.id}|${assignment.id}|${assignment.updatedAt}|${strategy.id}|${strategy.updatedAt}`
        : pair
          ? `${pair.id}|unassigned`
          : '';
    if (signature === lastConfigSignature.current) return;
    lastConfigSignature.current = signature;
    if (assignment && strategy) {
      setDraft(resolveConfiguration(strategy.parameterSchema, assignment.configuration));
    } else {
      setDraft(null);
    }
    setConfigErrors({});
  }, [assignment, pair, strategy]);

  const automationStatus =
    pair && globalRisk ? getAutomationStatus(pair, assignment, strategy, globalRisk) : undefined;
  const configStatus = getConfigurationStatus(assignment);
  const effectiveRisk = pairRisk && globalRisk ? getEffectiveRisk(pairRisk, globalRisk) : null;
  const readOnly = pair?.status === 'archived';

  const automationBlocker = !globalRisk
    ? 'Risk configuration is not loaded.'
    : pair?.status !== 'enabled'
      ? 'The pair is not enabled.'
      : globalRisk.emergencyAutomationDisabled
        ? 'The global emergency automation halt is active.'
        : !assignment
          ? 'Assign a strategy before enabling automation.'
          : assignment.status !== 'active'
            ? 'The assignment is disabled.'
            : !strategy?.enabled
              ? 'The assigned strategy is disabled.'
              : null;
  const canToggleAutomation = Boolean(
    pair && pair.status === 'enabled' && (pair.automationEnabled || automationBlocker === null)
  );

  const latestSignal = pairSignals[0];
  const latestExecution = pairExecutions[0];

  const handleSaveConfig = async () => {
    if (!pair || !strategy || !draft) return;
    const validation = validateConfiguration(strategy.parameterSchema, draft);
    if (Object.keys(validation).length > 0) {
      setConfigErrors(validation);
      notify({
        tone: 'error',
        title: 'Configuration has errors',
        description: 'Fix the highlighted parameters before saving.',
      });
      return;
    }
    setConfigSaving(true);
    try {
      await updateAssignmentConfiguration(pair.id, draft);
      setConfigErrors({});
      notify({
        tone: 'success',
        title: 'Pair configuration saved',
        description: `${pair.symbol} now has ${customizedKeys.length} pair-specific override${
          customizedKeys.length === 1 ? '' : 's'
        }. Other pairs using ${strategy.name} were not changed.`,
      });
    } catch (error) {
      if (error instanceof TradingApiError && error.fieldErrors) {
        setConfigErrors(error.fieldErrors);
      }
      notifyError(error, 'The configuration could not be saved.');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (!strategy) return;
    setDraft(buildDefaultParameters(strategy.parameterSchema));
    setConfigErrors({});
    setResetConfigOpen(false);
    notify({
      tone: 'info',
      title: 'Defaults loaded into the form',
      description: 'Save the configuration to apply the strategy defaults to this pair.',
    });
  };

  const toggleAutomation = async () => {
    if (!pair) return;
    setAutomationLoading(true);
    try {
      await setPairAutomation(pair.id, !pair.automationEnabled);
      notify({
        tone: 'success',
        title: pair.automationEnabled ? 'Automation disabled' : 'Automation enabled',
        description: pair.automationEnabled
          ? `${pair.symbol} will not process demo events until automation is enabled again.`
          : `${pair.symbol} is eligible for the demo automation model. No broker orders are placed.`,
      });
      setAutomationConfirmOpen(false);
    } catch (error) {
      notifyError(error, 'Automation could not be changed.');
    } finally {
      setAutomationLoading(false);
    }
  };

  const handleStatusAction = async () => {
    if (!pair || !pendingStatus) return;
    setStatusLoading(true);
    try {
      const status =
        pendingStatus === 'archive'
          ? 'archived'
          : pendingStatus === 'disable'
            ? 'disabled'
            : 'enabled';
      await setPairStatus(pair.id, status);
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
            ? `${pair.symbol} was archived; its assignment was disabled and history retained.`
            : `${pair.symbol} is now ${PAIR_STATUS_LABELS[status].toLowerCase()}.`,
      });
      setPendingStatus(null);
      if (status === 'archived') setActiveTab('overview');
    } catch (error) {
      notifyError(error, 'The pair status could not be changed.');
    } finally {
      setStatusLoading(false);
    }
  };

  const statusCopy = pendingStatus
    ? pendingStatus === 'archive'
      ? {
          title: `Archive ${pair?.symbol}?`,
          description:
            'The pair leaves active operations, its assignment is disabled, and automation is switched off. Signals and execution history are retained.',
          confirm: 'Archive pair',
          tone: 'danger' as const,
        }
      : pendingStatus === 'disable'
        ? {
            title: `Disable ${pair?.symbol}?`,
            description:
              'Automation is switched off and the pair is paused. Its strategy configuration is preserved.',
            confirm: 'Disable pair',
            tone: 'danger' as const,
          }
        : {
            title: `Enable ${pair?.symbol}?`,
            description:
              'The pair becomes operational. Automation stays off until you enable it explicitly.',
            confirm: 'Enable pair',
            tone: 'primary' as const,
          }
    : null;

  if (!pair || !snapshot) {
    return (
      <div>
        <PageHeader
          title="Pair not found"
          backTo={{ to: '/trading-pairs', label: 'Back to trading pairs' }}
        />
        <Card>
          <EmptyState
            icon="pairs"
            title="This trading pair does not exist"
            description="It may have been removed from the demo workspace. Return to pair management to choose another pair."
            action={
              <Link to="/trading-pairs" className={buttonClasses('primary', 'sm')}>
                Back to trading pairs
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const tabItems = [
    { id: 'overview', label: 'Overview', panelId: 'pair-panel-overview' },
    {
      id: 'strategy',
      label: 'Strategy Configuration',
      panelId: 'pair-panel-strategy',
    },
    { id: 'risk', label: 'Risk Settings', panelId: 'pair-panel-risk' },
    { id: 'signals', label: 'Signals', count: pairSignals.length, panelId: 'pair-panel-signals' },
    {
      id: 'executions',
      label: 'Execution History',
      count: pairExecutions.length,
      panelId: 'pair-panel-executions',
    },
    {
      id: 'activity',
      label: 'Activity Log',
      count: pairEvents.length,
      panelId: 'pair-panel-activity',
    },
  ];

  return (
    <div>
      <PageHeader
        backTo={{ to: '/trading-pairs', label: 'Back to trading pairs' }}
        title={pair.symbol}
        description={
          <div className="flex flex-wrap items-center gap-1.5">
            <span>{pair.displayName}</span>
            <span className="text-secondary-300 dark:text-secondary-600">·</span>
            <span>{pair.marketType}</span>
            <span className="text-secondary-300 dark:text-secondary-600">·</span>
            <span className="font-mono text-xs">{pair.defaultTimeframe}</span>
            <span className="mx-0.5" />
            <Badge tone={getPairStatusTone(pair.status)} dot>
              {PAIR_STATUS_LABELS[pair.status]}
            </Badge>
            <Badge tone={configStatus.tone}>{configStatus.label}</Badge>
            {automationStatus ? (
              <Badge tone={automationStatus.tone} dot>
                {automationStatus.label}
              </Badge>
            ) : null}
          </div>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" icon="edit" onClick={() => setEditOpen(true)}>
              Edit pair
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon="link"
              disabled={pair.status === 'archived'}
              onClick={() => setAssignOpen(true)}
            >
              {assignment ? 'Change strategy' : 'Assign strategy'}
            </Button>
            <Button
              size="sm"
              variant={pair.automationEnabled ? 'secondary' : 'primary'}
              icon={pair.automationEnabled ? 'pause' : 'play'}
              disabled={!canToggleAutomation}
              loading={automationLoading}
              title={
                canToggleAutomation
                  ? undefined
                  : (automationBlocker ?? 'Automation cannot be changed.')
              }
              onClick={() => {
                if (pair.automationEnabled) setAutomationConfirmOpen(true);
                else void toggleAutomation();
              }}
            >
              {pair.automationEnabled ? 'Turn automation off' : 'Turn automation on'}
            </Button>
          </>
        }
      />

      {pair.status === 'archived' ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-secondary-300 bg-secondary-100 px-3.5 py-2.5 dark:border-secondary-700 dark:bg-secondary-800/60">
          <Icon name="archive" size={15} className="mt-0.5 shrink-0 text-secondary-500" />
          <div>
            <p className="text-xs font-semibold text-secondary-800 dark:text-secondary-200">
              Archived pair — read-only operational state
            </p>
            <p className="mt-0.5 text-[11px] leading-5 text-secondary-600 dark:text-secondary-400">
              Strategy configuration and automation are locked. Historical signals, executions, and
              activity remain available. Archived pairs cannot be restored in this demo.
            </p>
          </div>
        </div>
      ) : null}

      {pair.status === 'disabled' ? (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-warning-200 bg-warning-50 px-3.5 py-2.5 dark:border-warning-500/20 dark:bg-warning-500/5">
          <div className="flex gap-2">
            <Icon
              name="pause"
              size={15}
              className="mt-0.5 shrink-0 text-warning-600 dark:text-warning-400"
            />
            <div>
              <p className="text-xs font-semibold text-warning-800 dark:text-warning-300">
                Pair is disabled
              </p>
              <p className="mt-0.5 text-[11px] leading-5 text-warning-700/80 dark:text-warning-300/70">
                Configuration is preserved but automation is off. Enable the pair before resuming
                operations.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="xs" onClick={() => setPendingStatus('enable')}>
            Enable pair
          </Button>
        </div>
      ) : null}

      {globalRisk?.emergencyAutomationDisabled ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3.5 py-2.5 dark:border-danger-500/20 dark:bg-danger-500/10">
          <Icon
            name="alertTriangle"
            size={15}
            className="mt-0.5 shrink-0 text-danger-600 dark:text-danger-400"
          />
          <div>
            <p className="text-xs font-semibold text-danger-800 dark:text-danger-300">
              Emergency automation halt is active
            </p>
            <p className="mt-0.5 text-[11px] leading-5 text-danger-700/80 dark:text-danger-300/70">
              Automation is blocked for every pair regardless of local settings. Lift the halt in
              Risk Management.
            </p>
          </div>
        </div>
      ) : null}

      <Tabs
        items={tabItems}
        value={activeTab}
        onChange={(id) => setActiveTab(id as PairTab)}
        ariaLabel="Pair detail sections"
        className="mb-4"
      />

      {activeTab === 'overview' ? (
        <div role="tabpanel" aria-label="Overview" id="pair-panel-overview" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Pair profile"
                description="Static pair metadata and data-source label."
                actions={
                  <Button variant="ghost" size="xs" icon="edit" onClick={() => setEditOpen(true)}>
                    Edit
                  </Button>
                }
              />
              <CardBody className="py-1">
                <dl className="grid gap-x-8 sm:grid-cols-2">
                  <DetailRow label="Symbol">
                    <span className="font-mono">{pair.symbol}</span>
                  </DetailRow>
                  <DetailRow label="Market">{pair.marketType}</DetailRow>
                  <DetailRow label="Default timeframe">{pair.defaultTimeframe}</DetailRow>
                  <DetailRow label="Broker / source">{pair.broker ?? 'Not set'}</DetailRow>
                  <DetailRow label="Created">{formatDateTime(pair.createdAt)}</DetailRow>
                  <DetailRow label="Last updated">{formatDateTime(pair.updatedAt)}</DetailRow>
                  <DetailRow label="Lifecycle">
                    <Badge tone={getPairStatusTone(pair.status)} dot>
                      {PAIR_STATUS_LABELS[pair.status]}
                    </Badge>
                  </DetailRow>
                  <DetailRow label="Automation flag">
                    <span
                      className={
                        pair.automationEnabled
                          ? 'text-success-600 dark:text-success-400'
                          : 'text-secondary-500'
                      }
                    >
                      {pair.automationEnabled ? 'On' : 'Off'}
                    </span>
                  </DetailRow>
                </dl>
                {pair.notes ? (
                  <div className="mt-3 rounded-lg bg-secondary-50 px-3 py-2 text-[11px] leading-5 text-secondary-600 dark:bg-secondary-950/50 dark:text-secondary-400">
                    <span className="font-medium text-secondary-700 dark:text-secondary-300">
                      Notes:
                    </span>{' '}
                    {pair.notes}
                  </div>
                ) : null}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Operational state" />
              <CardBody className="space-y-3">
                {automationStatus ? (
                  <div>
                    <Badge tone={automationStatus.tone} dot>
                      {automationStatus.label}
                    </Badge>
                    <p className="mt-1.5 text-[11px] leading-5 text-secondary-500 dark:text-secondary-400">
                      {automationStatus.detail}
                    </p>
                  </div>
                ) : null}
                <dl>
                  <DetailRow label="Pair state">{PAIR_STATUS_LABELS[pair.status]}</DetailRow>
                  <DetailRow label="Assignment">
                    {assignment ? (
                      <span
                        className={
                          assignment.status === 'active'
                            ? 'text-success-600 dark:text-success-400'
                            : 'text-warning-600 dark:text-warning-400'
                        }
                      >
                        {assignment.status === 'active' ? 'Active' : 'Disabled'}
                      </span>
                    ) : (
                      'None'
                    )}
                  </DetailRow>
                  <DetailRow label="Strategy definition">
                    {strategy ? (strategy.enabled ? 'Enabled' : 'Disabled') : 'Not assigned'}
                  </DetailRow>
                  <DetailRow label="Connection">
                    <span className="text-warning-600 dark:text-warning-400">Demo only</span>
                  </DetailRow>
                </dl>
                {pair.status !== 'archived' ? (
                  <Button
                    variant="secondary"
                    size="xs"
                    icon={pair.status === 'enabled' ? 'pause' : 'play'}
                    className="w-full"
                    onClick={() =>
                      setPendingStatus(pair.status === 'enabled' ? 'disable' : 'enable')
                    }
                  >
                    {pair.status === 'enabled' ? 'Disable pair' : 'Enable pair'}
                  </Button>
                ) : null}
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Strategy assignment"
                description="A strategy definition supplies the schema; this pair stores only its own overrides."
                actions={
                  assignment ? (
                    <div className="flex gap-1.5">
                      <Button
                        variant="ghost"
                        size="xs"
                        icon="sliders"
                        disabled={readOnly}
                        onClick={() => setActiveTab('strategy')}
                      >
                        Configure
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        icon="link"
                        disabled={readOnly}
                        onClick={() => setAssignOpen(true)}
                      >
                        Reassign
                      </Button>
                    </div>
                  ) : null
                }
              />
              <CardBody>
                {assignment && strategy ? (
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/strategies"
                        className="text-sm font-semibold text-secondary-900 hover:text-primary-600 dark:text-white dark:hover:text-primary-400"
                      >
                        {strategy.name}
                      </Link>
                      <span className="text-[10px] tabular-nums text-secondary-400 dark:text-secondary-500">
                        definition v{strategy.version} · assignment v{assignment.strategyVersion}
                      </span>
                      <Badge tone={strategy.enabled ? 'success' : 'warning'}>
                        {strategy.enabled ? 'Definition enabled' : 'Definition disabled'}
                      </Badge>
                      <Badge tone={configStatus.tone}>{configStatus.label}</Badge>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-5 text-secondary-500 dark:text-secondary-400">
                      {strategy.description}
                    </p>
                    <dl className="mt-3 grid gap-x-8 sm:grid-cols-2">
                      <DetailRow label="Assignment status">
                        {assignment.status === 'active' ? 'Active' : 'Disabled'}
                      </DetailRow>
                      <DetailRow label="Configuration version">
                        v{assignment.configurationVersion}
                      </DetailRow>
                      <DetailRow label="Customized parameters">
                        {Object.keys(assignment.configuration).length} of{' '}
                        {strategy.parameterSchema.length}
                      </DetailRow>
                      <DetailRow label="Assigned">
                        {formatDateTime(assignment.assignedAt)}
                      </DetailRow>
                      <DetailRow label="Last configuration save">
                        {formatDateTime(assignment.updatedAt)}
                      </DetailRow>
                      <DetailRow label="Supported">
                        {strategy.supportedMarkets.join(', ')}
                      </DetailRow>
                    </dl>
                  </div>
                ) : (
                  <EmptyState
                    compact
                    icon="assignments"
                    title="No strategy assigned"
                    description="Assign a reusable strategy definition to generate this pair's configuration form."
                    action={
                      <Button
                        size="xs"
                        icon="plus"
                        disabled={pair.status === 'archived'}
                        onClick={() => setAssignOpen(true)}
                      >
                        Assign strategy
                      </Button>
                    }
                  />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Effective risk"
                description="Resolved from global defaults or pair overrides."
                actions={
                  <Button
                    variant="ghost"
                    size="xs"
                    icon="edit"
                    onClick={() => setActiveTab('risk')}
                  >
                    Edit
                  </Button>
                }
              />
              <CardBody>
                {effectiveRisk && pairRisk ? (
                  <div>
                    <Badge tone={pairRisk.inheritGlobal ? 'neutral' : 'info'}>
                      {effectiveRisk.source}
                    </Badge>
                    <dl className="mt-2">
                      <DetailRow label="Max risk / operation">
                        {effectiveRisk.maxRiskPerTradePct}%
                      </DetailRow>
                      <DetailRow label="Max exposure">{effectiveRisk.maxExposurePct}%</DetailRow>
                      <DetailRow label="Max positions">
                        {effectiveRisk.maxConcurrentPositions}
                      </DetailRow>
                      <DetailRow label="Sessions">
                        {sessionSummary(effectiveRisk.sessions)}
                      </DetailRow>
                      <DetailRow label="Cooldown">
                        {formatMinutes(effectiveRisk.cooldownMinutes)}
                      </DetailRow>
                      <DetailRow label="Stop / target">
                        {STOP_LOSS_MODE_LABELS[effectiveRisk.stopLoss.mode]} ·{' '}
                        {TAKE_PROFIT_MODE_LABELS[effectiveRisk.takeProfit.mode]}
                      </DetailRow>
                    </dl>
                  </div>
                ) : (
                  <EmptyState compact icon="risk" title="Risk configuration unavailable" />
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Latest activity"
              description="Most recent simulated signal and execution record for this pair."
            />
            <CardBody>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-secondary-200 p-3 dark:border-secondary-800">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-secondary-800 dark:text-secondary-200">
                      Latest signal
                    </p>
                    <Button variant="ghost" size="xs" onClick={() => setActiveTab('signals')}>
                      All signals
                    </Button>
                  </div>
                  {latestSignal ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          latestSignal.type === 'buy'
                            ? 'success'
                            : latestSignal.type === 'sell'
                              ? 'danger'
                              : 'neutral'
                        }
                      >
                        {latestSignal.type.toUpperCase()}
                      </Badge>
                      <Badge tone="neutral">{latestSignal.timeframe}</Badge>
                      <Badge tone={latestSignal.status === 'filtered' ? 'warning' : 'info'}>
                        {SIGNAL_STATUS_LABELS[latestSignal.status]}
                      </Badge>
                      <span className="text-[10px] text-secondary-400 dark:text-secondary-500">
                        {formatRelativeTime(latestSignal.timestamp)}
                      </span>
                      <p className="w-full text-[11px] leading-4 text-secondary-500 dark:text-secondary-400">
                        {latestSignal.detail}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-secondary-500 dark:text-secondary-400">
                      No signals recorded for this pair.
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-secondary-200 p-3 dark:border-secondary-800">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-secondary-800 dark:text-secondary-200">
                      Latest simulated execution
                    </p>
                    <Button variant="ghost" size="xs" onClick={() => setActiveTab('executions')}>
                      All executions
                    </Button>
                  </div>
                  {latestExecution ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge tone="primary">Simulation</Badge>
                      <Badge
                        tone={
                          latestExecution.status === 'success'
                            ? 'success'
                            : latestExecution.status === 'failed'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {latestExecution.status}
                      </Badge>
                      <span className="text-[10px] text-secondary-400 dark:text-secondary-500">
                        {formatRelativeTime(latestExecution.timestamp)}
                      </span>
                      <p className="w-full text-[11px] leading-4 text-secondary-500 dark:text-secondary-400">
                        {EXECUTION_EVENT_LABELS[latestExecution.eventType]}
                        {latestExecution.error ? ` — ${latestExecution.error}` : ''}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-secondary-500 dark:text-secondary-400">
                      No execution records for this pair.
                    </p>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="border-danger-200 dark:border-danger-500/20">
            <CardHeader
              title="Lifecycle"
              description="Archive removes the pair from active operations. History is retained."
            />
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-xl text-[11px] leading-5 text-secondary-500 dark:text-secondary-400">
                {pair.status === 'archived'
                  ? 'This pair is archived. Its assignment is disabled and automation cannot run.'
                  : 'Archiving is irreversible in this demo. Signal and execution history remains available for audit.'}
              </p>
              {pair.status !== 'archived' ? (
                <Button
                  variant="danger"
                  size="sm"
                  icon="archive"
                  onClick={() => setPendingStatus('archive')}
                >
                  Archive pair
                </Button>
              ) : (
                <Badge tone="neutral" dot>
                  Archived
                </Badge>
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {activeTab === 'strategy' ? (
        <div role="tabpanel" aria-label="Strategy Configuration" id="pair-panel-strategy">
          {!assignment || !strategy ? (
            <Card>
              <EmptyState
                icon="assignments"
                title="No strategy assigned to this pair"
                description="Assign a reusable strategy definition to generate a schema-driven configuration form. Defaults load on first assignment."
                action={
                  <Button
                    size="sm"
                    icon="plus"
                    disabled={pair.status === 'archived'}
                    onClick={() => setAssignOpen(true)}
                  >
                    Assign strategy
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
              <Card>
                <CardHeader
                  title="Pair-specific configuration"
                  description={`Overrides for ${pair.symbol}. Values equal to defaults stay inherited.`}
                  actions={
                    readOnly ? (
                      <Badge tone="neutral">Read-only</Badge>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          size="xs"
                          icon="refresh"
                          disabled={configSaving}
                          onClick={() => setResetConfigOpen(true)}
                        >
                          Reset to defaults
                        </Button>
                        <Button
                          size="xs"
                          icon="check"
                          loading={configSaving}
                          disabled={!configDirty}
                          onClick={() => void handleSaveConfig()}
                        >
                          Save configuration
                        </Button>
                      </>
                    )
                  }
                />
                <div className="flex flex-wrap items-center gap-2 border-b border-secondary-200 px-4 py-2.5 dark:border-secondary-800">
                  <Badge tone={configStatus.tone}>{configStatus.label}</Badge>
                  <span className="text-[10px] tabular-nums text-secondary-400 dark:text-secondary-500">
                    config v{assignment.configurationVersion} · {customizedKeys.length} of{' '}
                    {strategy.parameterSchema.length} customized · updated{' '}
                    {formatRelativeTime(assignment.updatedAt)}
                  </span>
                  {configDirty ? (
                    <Badge tone="warning" dot>
                      Unsaved changes
                    </Badge>
                  ) : null}
                </div>
                <CardBody>
                  {strategy.version !== assignment.strategyVersion ? (
                    <div className="mb-3 flex gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 dark:border-warning-500/20 dark:bg-warning-500/5">
                      <Icon
                        name="alertTriangle"
                        size={14}
                        className="mt-0.5 shrink-0 text-warning-600 dark:text-warning-400"
                      />
                      <p className="text-[11px] leading-4 text-warning-700 dark:text-warning-300">
                        The definition is now v{strategy.version}, while this assignment was last
                        stamped at v{assignment.strategyVersion}. Saving stamps the current version;
                        pair overrides remain untouched.
                      </p>
                    </div>
                  ) : null}
                  {!strategy.enabled ? (
                    <div className="mb-3 flex gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 dark:border-warning-500/20 dark:bg-warning-500/5">
                      <Icon
                        name="pause"
                        size={14}
                        className="mt-0.5 shrink-0 text-warning-600 dark:text-warning-400"
                      />
                      <p className="text-[11px] leading-4 text-warning-700 dark:text-warning-300">
                        The strategy definition is disabled. Configuration can still be reviewed;
                        automation cannot run.
                      </p>
                    </div>
                  ) : null}
                  {draft ? (
                    <StrategyParameterFields
                      schema={strategy.parameterSchema}
                      values={draft}
                      customizedKeys={customizedKeys}
                      errors={configErrors}
                      supportedTimeframes={strategy.supportedTimeframes}
                      disabled={readOnly || configSaving}
                      onChange={(key, value) => {
                        setDraft((current) => (current ? { ...current, [key]: value } : current));
                        setConfigErrors((current) => {
                          if (!(key in current)) return current;
                          const next = { ...current };
                          delete next[key];
                          return next;
                        });
                      }}
                      onRevert={(key) => {
                        const parameter = strategy.parameterSchema.find(
                          (candidate) => candidate.key === key
                        );
                        if (!parameter) return;
                        setDraft((current) =>
                          current ? { ...current, [key]: parameter.defaultValue } : current
                        );
                        setConfigErrors((current) => {
                          const next = { ...current };
                          delete next[key];
                          return next;
                        });
                      }}
                    />
                  ) : (
                    <div className="space-y-2">
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                  )}
                </CardBody>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader title="Strategy definition" />
                  <CardBody className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold text-secondary-900 dark:text-white">
                        {strategy.name}
                      </p>
                      <Badge tone={strategy.enabled ? 'success' : 'neutral'}>
                        {strategy.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <p className="text-[11px] leading-5 text-secondary-500 dark:text-secondary-400">
                      {strategy.description}
                    </p>
                    <dl>
                      <DetailRow label="Category">{strategy.category}</DetailRow>
                      <DetailRow label="Definition version">v{strategy.version}</DetailRow>
                      <DetailRow label="Parameters">{strategy.parameterSchema.length}</DetailRow>
                      <DetailRow label="Markets">{strategy.supportedMarkets.join(', ')}</DetailRow>
                      <DetailRow label="Timeframes">
                        {strategy.supportedTimeframes.join(', ')}
                      </DetailRow>
                    </dl>
                    <Button
                      variant="secondary"
                      size="xs"
                      icon="link"
                      className="w-full"
                      disabled={readOnly}
                      onClick={() => setAssignOpen(true)}
                    >
                      Change assigned strategy
                    </Button>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="Configuration rules" />
                  <CardBody>
                    <ul className="space-y-2 text-[11px] leading-4 text-secondary-500 dark:text-secondary-400">
                      <li className="flex gap-2">
                        <Icon name="check" size={13} className="mt-0.5 shrink-0 text-success-500" />
                        Overrides are stored only for this pair; another pair using the same
                        strategy is independent.
                      </li>
                      <li className="flex gap-2">
                        <Icon name="check" size={13} className="mt-0.5 shrink-0 text-success-500" />
                        Editing strategy metadata or defaults never rewrites saved pair overrides.
                      </li>
                      <li className="flex gap-2">
                        <Icon name="check" size={13} className="mt-0.5 shrink-0 text-success-500" />
                        Each save increments the configuration version and records an audit event.
                      </li>
                    </ul>
                  </CardBody>
                </Card>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {activeTab === 'risk' ? (
        <div role="tabpanel" aria-label="Risk Settings" id="pair-panel-risk">
          {pairRisk && globalRisk ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
              <Card>
                <CardHeader
                  title={`Risk settings · ${pair.symbol}`}
                  description="Configure pair-level overrides. Global defaults never overwrite these values."
                />
                <CardBody>
                  <PairRiskForm
                    key={pair.id}
                    pair={pair}
                    configuration={pairRisk}
                    globalRisk={globalRisk}
                    readOnly={readOnly}
                  />
                </CardBody>
              </Card>
              <div className="space-y-4">
                <Card>
                  <CardHeader
                    title="Global defaults"
                    description="Applied when inheritance is on."
                  />
                  <CardBody>
                    <dl>
                      <DetailRow label="Max risk / operation">
                        {globalRisk.maxRiskPerTradePct}%
                      </DetailRow>
                      <DetailRow label="Max exposure">{globalRisk.maxExposurePct}%</DetailRow>
                      <DetailRow label="Max positions">
                        {globalRisk.maxConcurrentPositions}
                      </DetailRow>
                      <DetailRow label="Sessions">{sessionSummary(globalRisk.sessions)}</DetailRow>
                      <DetailRow label="Cooldown">
                        {formatMinutes(globalRisk.cooldownMinutes)}
                      </DetailRow>
                      <DetailRow label="Emergency halt">
                        {globalRisk.emergencyAutomationDisabled ? 'Active' : 'Inactive'}
                      </DetailRow>
                    </dl>
                    <Link
                      to="/risk"
                      className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:underline dark:text-primary-400"
                    >
                      Open global risk management
                      <Icon name="chevronRight" size={12} />
                    </Link>
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Pair-specific details" />
                  <CardBody>
                    <dl>
                      <DetailRow label="Execution mode">
                        {POSITION_SIZING_MODE_LABELS[pairRisk.positionSizing.mode]}
                      </DetailRow>
                      <DetailRow label="Stop loss">
                        {STOP_LOSS_MODE_LABELS[pairRisk.stopLoss.mode]}
                      </DetailRow>
                      <DetailRow label="Take profit">
                        {TAKE_PROFIT_MODE_LABELS[pairRisk.takeProfit.mode]}
                      </DetailRow>
                      <DetailRow label="Last updated">
                        {formatDateTime(pairRisk.updatedAt)}
                      </DetailRow>
                    </dl>
                    <p className="mt-2 text-[10px] leading-4 text-secondary-500 dark:text-secondary-400">
                      These settings only configure the dashboard model. A connected backend must
                      independently enforce risk controls before execution.
                    </p>
                  </CardBody>
                </Card>
              </div>
            </div>
          ) : (
            <Card>
              <EmptyState
                icon="risk"
                title="Risk configuration unavailable"
                description="The global risk model could not be loaded for this pair."
              />
            </Card>
          )}
        </div>
      ) : null}

      {activeTab === 'signals' ? (
        <div role="tabpanel" aria-label="Signals" id="pair-panel-signals">
          <Card>
            <CardHeader
              title={`Signals · ${pair.symbol}`}
              description="All signal records are simulated demo events. No live market feed is connected."
            />
            <SignalHistoryTable
              signals={pairSignals}
              pairs={snapshot.pairs}
              strategies={snapshot.strategies}
              pageSize={8}
            />
          </Card>
        </div>
      ) : null}

      {activeTab === 'executions' ? (
        <div role="tabpanel" aria-label="Execution History" id="pair-panel-executions">
          <Card>
            <CardHeader
              title={`Execution history · ${pair.symbol}`}
              description="Simulated processing records with latency and error details. No broker orders exist."
            />
            <ExecutionHistoryTable
              executions={pairExecutions}
              pairs={snapshot.pairs}
              strategies={snapshot.strategies}
              pageSize={8}
            />
          </Card>
        </div>
      ) : null}

      {activeTab === 'activity' ? (
        <div role="tabpanel" aria-label="Activity Log" id="pair-panel-activity">
          <Card>
            <CardHeader
              title={`Activity log · ${pair.symbol}`}
              description="Operator and system events recorded against this pair."
            />
            <CardBody>
              {pairEvents.length === 0 ? (
                <EmptyState
                  compact
                  icon="activity"
                  title="No activity recorded"
                  description="Configuration, status, and risk changes for this pair will appear here."
                />
              ) : (
                <ol className="relative ml-2 border-l border-secondary-200 dark:border-secondary-800">
                  {pairEvents.map((event) => (
                    <li key={event.id} className="relative pb-4 pl-4 last:pb-0">
                      <span
                        className={cn(
                          'absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full ring-2 ring-white dark:ring-secondary-900',
                          event.level === 'error'
                            ? 'bg-danger-500'
                            : event.level === 'warning'
                              ? 'bg-warning-500'
                              : event.level === 'success'
                                ? 'bg-success-500'
                                : 'bg-primary-400'
                        )}
                      />
                      <p className="text-[11px] leading-5 text-secondary-700 dark:text-secondary-300">
                        {event.message}
                      </p>
                      <p className="mt-0.5 text-[10px] capitalize text-secondary-400 dark:text-secondary-500">
                        {event.category} · {event.actor} · {formatDateTime(event.timestamp)} ·{' '}
                        {formatRelativeTime(event.timestamp)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}

      <PairFormDialog open={editOpen} pair={pair} onClose={() => setEditOpen(false)} />

      {assignOpen ? (
        <AssignStrategyDialog open pairId={pair.id} onClose={() => setAssignOpen(false)} />
      ) : null}

      <ConfirmDialog
        open={unsavedGuard.blocked}
        title="Discard unsaved configuration?"
        description="This pair has unsaved strategy parameter changes. Leaving now will discard them."
        confirmLabel="Discard and leave"
        cancelLabel="Stay on page"
        tone="danger"
        onCancel={unsavedGuard.reset}
        onConfirm={unsavedGuard.proceed}
      />

      <ConfirmDialog
        open={resetConfigOpen}
        title="Reset to strategy defaults?"
        description="This loads the current strategy defaults into the form for this pair. The change is not persisted until you save the configuration."
        confirmLabel="Load defaults"
        tone="primary"
        icon="shieldCheck"
        onCancel={() => setResetConfigOpen(false)}
        onConfirm={handleResetDefaults}
      />

      <ConfirmDialog
        open={automationConfirmOpen}
        title={`Turn off automation for ${pair.symbol}?`}
        description="The pair will stop processing demo events. Its configuration and strategy assignment are preserved."
        confirmLabel="Turn automation off"
        tone="danger"
        icon="pause"
        loading={automationLoading}
        onCancel={() => setAutomationConfirmOpen(false)}
        onConfirm={() => void toggleAutomation()}
      />

      <ConfirmDialog
        open={Boolean(pendingStatus)}
        title={statusCopy?.title ?? 'Confirm action'}
        description={statusCopy?.description}
        confirmLabel={statusCopy?.confirm ?? 'Confirm'}
        tone={statusCopy?.tone ?? 'danger'}
        icon={pendingStatus === 'archive' ? 'archive' : 'alertTriangle'}
        loading={statusLoading}
        onCancel={() => setPendingStatus(null)}
        onConfirm={() => void handleStatusAction()}
      >
        {pendingStatus === 'archive' ? (
          <div className="rounded-md border border-secondary-200 bg-secondary-50 px-2.5 py-1.5 text-[11px] text-secondary-600 dark:border-secondary-700 dark:bg-secondary-800 dark:text-secondary-300">
            Scope: {pair.symbol} only. The strategy configuration is retained but locked by the
            archived state.
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
