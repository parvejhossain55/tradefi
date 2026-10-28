import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Field, InlineCheckbox, Input, Toggle } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { PairRiskForm } from '@/components/risk/PairRiskForm';
import { notify, notifyError } from '@/store/toastStore';
import { useTradingStore } from '@/store/tradingStore';
import { TradingApiError } from '@/services/tradingApi';
import type {
  PairRiskConfiguration,
  SessionName,
  SessionRestriction,
  TradingPair,
} from '@/types/trading';
import { SESSIONS } from '@/types/trading';
import {
  createPairRiskFallback,
  formatDateTime,
  formatMinutes,
  formatRelativeTime,
  getEffectiveRisk,
  validateRiskValues,
} from '@/utils/trading';

interface GlobalFormState {
  maxRiskPerTradePct: number;
  maxExposurePct: number;
  maxConcurrentPositions: number;
  cooldownMinutes: number;
  sessions: SessionRestriction;
}

interface RiskRow {
  pair: TradingPair;
  configuration: PairRiskConfiguration;
}

const EMPTY_LIST: never[] = [];

function toGlobalForm(globalRisk: {
  maxRiskPerTradePct: number;
  maxExposurePct: number;
  maxConcurrentPositions: number;
  cooldownMinutes: number;
  sessions: SessionRestriction;
}): GlobalFormState {
  return {
    maxRiskPerTradePct: globalRisk.maxRiskPerTradePct,
    maxExposurePct: globalRisk.maxExposurePct,
    maxConcurrentPositions: globalRisk.maxConcurrentPositions,
    cooldownMinutes: globalRisk.cooldownMinutes,
    sessions: {
      enabled: globalRisk.sessions.enabled,
      sessions: [...globalRisk.sessions.sessions],
    },
  };
}

export function RiskManagement() {
  const snapshot = useTradingStore((state) => state.snapshot);
  const saveGlobalRisk = useTradingStore((state) => state.saveGlobalRisk);
  const setEmergencyAutomationDisabled = useTradingStore(
    (state) => state.setEmergencyAutomationDisabled
  );
  const [form, setForm] = useState<GlobalFormState | null>(
    snapshot ? toGlobalForm(snapshot.globalRisk) : null
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editingPairId, setEditingPairId] = useState<string | null>(null);
  const [emergencyConfirmOpen, setEmergencyConfirmOpen] = useState(false);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const lastSignatureRef = useRef('');

  const globalRisk = snapshot?.globalRisk;
  const pairs = snapshot?.pairs ?? EMPTY_LIST;
  const riskConfigurations = snapshot?.pairRiskConfigurations ?? EMPTY_LIST;

  const storedSignature = globalRisk ? JSON.stringify(toGlobalForm(globalRisk)) : '';

  useEffect(() => {
    if (!globalRisk) return;
    const signature = JSON.stringify(toGlobalForm(globalRisk));
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;
    setForm(toGlobalForm(globalRisk));
  }, [globalRisk]);

  const riskRows = useMemo<RiskRow[]>(() => {
    if (!globalRisk) return [];
    return pairs.map((pair) => ({
      pair,
      configuration:
        riskConfigurations.find((configuration) => configuration.pairId === pair.id) ??
        createPairRiskFallback(pair.id, globalRisk),
    }));
  }, [globalRisk, pairs, riskConfigurations]);

  const editingRow = riskRows.find((row) => row.pair.id === editingPairId);

  const exceedingPairs = useMemo(() => {
    if (!form) return [];
    return riskRows.filter((row) => {
      if (row.configuration.inheritGlobal) return false;
      return (
        row.configuration.maxRiskPerTradePct > form.maxRiskPerTradePct ||
        row.configuration.maxExposurePct > form.maxExposurePct ||
        row.configuration.maxConcurrentPositions > form.maxConcurrentPositions
      );
    });
  }, [form, riskRows]);

  if (!snapshot || !globalRisk || !form) return null;

  const dirty = JSON.stringify(form) !== storedSignature;
  const emergencyActive = globalRisk.emergencyAutomationDisabled;
  const automationEnabledPairs = pairs.filter((pair) => pair.automationEnabled).length;

  const clearError = (field: string) => {
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const update = <K extends keyof GlobalFormState>(key: K, value: GlobalFormState[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    clearError(key);
  };

  const toggleSession = (session: SessionName, checked: boolean) => {
    setForm((current) =>
      current
        ? {
            ...current,
            sessions: {
              enabled: current.sessions.enabled,
              sessions: checked
                ? [...current.sessions.sessions, session]
                : current.sessions.sessions.filter((candidate) => candidate !== session),
            },
          }
        : current
    );
    clearError('sessions');
  };

  const handleSaveGlobal = async () => {
    const validation = validateRiskValues(form);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      notify({
        tone: 'error',
        title: 'Global risk settings need attention',
        description: 'Fix the highlighted fields before saving.',
      });
      return;
    }
    setSaving(true);
    try {
      await saveGlobalRisk(form);
      setErrors({});
      notify({
        tone: 'success',
        title: 'Global risk defaults saved',
        description:
          exceedingPairs.length > 0
            ? `${exceedingPairs.length} pair override${
                exceedingPairs.length === 1 ? '' : 's'
              } exceed the new caps and were left unchanged.`
            : 'Global defaults were saved. Existing pair overrides were not rewritten.',
      });
    } catch (error) {
      if (error instanceof TradingApiError && error.fieldErrors) {
        setErrors(error.fieldErrors);
      }
      notifyError(error, 'Global risk settings could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(toGlobalForm(globalRisk));
    setErrors({});
  };

  const handleEmergency = async () => {
    setEmergencyLoading(true);
    try {
      await setEmergencyAutomationDisabled(!emergencyActive);
      notify({
        tone: emergencyActive ? 'success' : 'error',
        title: emergencyActive ? 'Emergency halt lifted' : 'Emergency automation halt enabled',
        description: emergencyActive
          ? 'Effective automation can resume according to each pair’s own flags. Pair flags were not changed.'
          : 'Effective automation is blocked for every pair in this demo dashboard. No broker connection exists.',
      });
      setEmergencyConfirmOpen(false);
    } catch (error) {
      notifyError(error, 'The emergency control could not be updated.');
    } finally {
      setEmergencyLoading(false);
    }
  };

  const columns: DataTableColumn<RiskRow>[] = [
    {
      key: 'pair',
      header: 'Pair',
      sortValue: (row) => row.pair.symbol,
      render: (row) => (
        <div>
          <p className="text-xs font-semibold tabular-nums text-secondary-900 dark:text-white">
            {row.pair.symbol}
          </p>
          <p className="text-[10px] text-secondary-500 dark:text-secondary-400">
            {row.pair.displayName} · {row.pair.marketType}
          </p>
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      sortValue: (row) => (row.configuration.inheritGlobal ? 'Global' : 'Override'),
      render: (row) => (
        <div className="flex flex-col items-start gap-1">
          <Badge tone={row.configuration.inheritGlobal ? 'neutral' : 'info'}>
            {row.configuration.inheritGlobal ? 'Global defaults' : 'Pair override'}
          </Badge>
          {!row.configuration.inheritGlobal &&
          (row.configuration.maxRiskPerTradePct > form.maxRiskPerTradePct ||
            row.configuration.maxExposurePct > form.maxExposurePct ||
            row.configuration.maxConcurrentPositions > form.maxConcurrentPositions) ? (
            <span className="flex items-center gap-1 text-[10px] text-warning-600 dark:text-warning-400">
              <Icon name="alertTriangle" size={10} />
              Exceeds current caps
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'risk',
      header: 'Risk limit',
      align: 'right',
      sortValue: (row) => getEffectiveRisk(row.configuration, globalRisk).maxRiskPerTradePct,
      render: (row) => (
        <span className="font-mono text-[11px] tabular-nums text-secondary-800 dark:text-secondary-200">
          {getEffectiveRisk(row.configuration, globalRisk).maxRiskPerTradePct}%
        </span>
      ),
    },
    {
      key: 'exposure',
      header: 'Exposure',
      align: 'right',
      sortValue: (row) => getEffectiveRisk(row.configuration, globalRisk).maxExposurePct,
      className: 'hidden sm:table-cell',
      headerClassName: 'hidden sm:table-cell',
      render: (row) => (
        <span className="font-mono text-[11px] tabular-nums text-secondary-800 dark:text-secondary-200">
          {getEffectiveRisk(row.configuration, globalRisk).maxExposurePct}%
        </span>
      ),
    },
    {
      key: 'positions',
      header: 'Max positions',
      align: 'right',
      sortValue: (row) => getEffectiveRisk(row.configuration, globalRisk).maxConcurrentPositions,
      className: 'hidden md:table-cell',
      headerClassName: 'hidden md:table-cell',
      render: (row) => (
        <span className="font-mono text-[11px] tabular-nums text-secondary-800 dark:text-secondary-200">
          {getEffectiveRisk(row.configuration, globalRisk).maxConcurrentPositions}
        </span>
      ),
    },
    {
      key: 'sessions',
      header: 'Sessions',
      className: 'hidden lg:table-cell',
      headerClassName: 'hidden lg:table-cell',
      render: (row) => {
        const effective = getEffectiveRisk(row.configuration, globalRisk);
        return (
          <span className="text-[10px] text-secondary-600 dark:text-secondary-300">
            {effective.sessions.enabled ? effective.sessions.sessions.join(', ') : 'Any'}
          </span>
        );
      },
    },
    {
      key: 'updated',
      header: 'Updated',
      sortValue: (row) => row.configuration.updatedAt,
      className: 'hidden xl:table-cell',
      headerClassName: 'hidden xl:table-cell',
      render: (row) => (
        <span
          className="text-[10px] text-secondary-500 dark:text-secondary-400"
          title={formatDateTime(row.configuration.updatedAt)}
        >
          {formatRelativeTime(row.configuration.updatedAt)}
        </span>
      ),
    },
    {
      key: 'edit',
      header: '',
      align: 'right',
      render: (row) => (
        <Button variant="ghost" size="xs" icon="edit" onClick={() => setEditingPairId(row.pair.id)}>
          Edit risk
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Risk Management"
        description="Configure global risk caps and pair-level overrides for the dashboard model. These settings do not guarantee execution safety; a backend must independently enforce every limit."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Global max risk"
          value={`${globalRisk.maxRiskPerTradePct}%`}
          hint="Per operation"
          icon="risk"
          tone="primary"
        />
        <StatCard
          label="Global exposure"
          value={`${globalRisk.maxExposurePct}%`}
          hint="Configured maximum"
          icon="sliders"
          tone="neutral"
        />
        <StatCard
          label="Concurrent positions"
          value={globalRisk.maxConcurrentPositions}
          hint="Global cap"
          icon="layers"
          tone="neutral"
        />
        <StatCard
          label="Emergency halt"
          value={emergencyActive ? 'Active' : 'Inactive'}
          hint={emergencyActive ? 'Automation blocked globally' : 'Local dashboard control only'}
          icon={emergencyActive ? 'alertTriangle' : 'shieldCheck'}
          tone={emergencyActive ? 'danger' : 'success'}
        />
      </div>

      <Card
        className={`mt-4 ${
          emergencyActive
            ? 'border-danger-300 dark:border-danger-500/40'
            : 'border-warning-200 dark:border-warning-500/20'
        }`}
      >
        <CardHeader
          title="Emergency automation control"
          description="Global stop for the demo automation model. It changes local dashboard state only and does not contact any broker."
          actions={
            <Badge tone={emergencyActive ? 'danger' : 'neutral'} dot>
              {emergencyActive ? 'Halt active' : 'Not active'}
            </Badge>
          }
        />
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex max-w-2xl gap-2.5">
            <span
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                emergencyActive
                  ? 'bg-danger-50 text-danger-600 dark:bg-danger-500/10 dark:text-danger-400'
                  : 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-400'
              }`}
            >
              <Icon name={emergencyActive ? 'alertTriangle' : 'shieldCheck'} size={16} />
            </span>
            <div>
              <p className="text-xs font-semibold text-secondary-900 dark:text-white">
                {emergencyActive
                  ? 'All effective automation is halted'
                  : 'Immediately block effective automation across every pair'}
              </p>
              <p className="mt-0.5 text-[11px] leading-5 text-secondary-500 dark:text-secondary-400">
                {emergencyActive
                  ? 'Pair automation flags and configurations are unchanged. Lift the halt to return control to each pair’s local settings.'
                  : 'This sets a global guard in local state. It does not change each pair’s automation flag, configuration, or assignment.'}
              </p>
            </div>
          </div>
          <Button
            variant={emergencyActive ? 'primary' : 'danger'}
            size="sm"
            icon={emergencyActive ? 'play' : 'pause'}
            onClick={() => setEmergencyConfirmOpen(true)}
          >
            {emergencyActive ? 'Lift emergency halt' : 'Halt all automation'}
          </Button>
        </CardBody>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardHeader
            title="Global risk defaults"
            description="Caps that apply to pairs inheriting global defaults. Pair overrides are never silently rewritten."
            actions={
              dirty ? (
                <Badge tone="warning" dot>
                  Unsaved changes
                </Badge>
              ) : null
            }
          />
          <CardBody>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Max risk per operation"
                htmlFor="global-risk"
                required
                error={errors.maxRiskPerTradePct}
                hint="Percentage of equity; 0.01–10%"
              >
                <Input
                  id="global-risk"
                  type="number"
                  min={0.01}
                  max={10}
                  step={0.01}
                  invalid={Boolean(errors.maxRiskPerTradePct)}
                  value={String(form.maxRiskPerTradePct)}
                  onChange={(event) => update('maxRiskPerTradePct', Number(event.target.value))}
                />
              </Field>
              <Field
                label="Max configured exposure"
                htmlFor="global-exposure"
                required
                error={errors.maxExposurePct}
                hint="Percentage of equity; up to 100%"
              >
                <Input
                  id="global-exposure"
                  type="number"
                  min={0.01}
                  max={100}
                  step={0.01}
                  invalid={Boolean(errors.maxExposurePct)}
                  value={String(form.maxExposurePct)}
                  onChange={(event) => update('maxExposurePct', Number(event.target.value))}
                />
              </Field>
              <Field
                label="Max concurrent positions"
                htmlFor="global-positions"
                required
                error={errors.maxConcurrentPositions}
                hint="Whole number, 1–50"
              >
                <Input
                  id="global-positions"
                  type="number"
                  min={1}
                  max={50}
                  step={1}
                  invalid={Boolean(errors.maxConcurrentPositions)}
                  value={String(form.maxConcurrentPositions)}
                  onChange={(event) => update('maxConcurrentPositions', Number(event.target.value))}
                />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-secondary-200 p-3 dark:border-secondary-800">
                <Toggle
                  checked={form.sessions.enabled}
                  onChange={(checked) => update('sessions', { ...form.sessions, enabled: checked })}
                  label="Restrict trading sessions"
                  description="When enabled, only selected sessions are permitted."
                />
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2">
                  {SESSIONS.map((session) => (
                    <InlineCheckbox
                      key={session}
                      checked={form.sessions.sessions.includes(session)}
                      disabled={!form.sessions.enabled}
                      onChange={(checked) => toggleSession(session, checked)}
                      label={session}
                    />
                  ))}
                </div>
                {errors.sessions ? (
                  <p
                    role="alert"
                    className="mt-1 text-[11px] font-medium text-danger-600 dark:text-danger-400"
                  >
                    {errors.sessions}
                  </p>
                ) : null}
              </div>

              <Field
                label="Default cooldown"
                htmlFor="global-cooldown"
                error={errors.cooldownMinutes}
                hint="Whole minutes, 0–10080. Pairs may override this when not inheriting."
              >
                <Input
                  id="global-cooldown"
                  type="number"
                  min={0}
                  max={10080}
                  step={1}
                  invalid={Boolean(errors.cooldownMinutes)}
                  value={String(form.cooldownMinutes)}
                  onChange={(event) => update('cooldownMinutes', Number(event.target.value))}
                />
              </Field>
            </div>

            {exceedingPairs.length > 0 ? (
              <div className="mt-3 flex gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 dark:border-warning-500/20 dark:bg-warning-500/5">
                <Icon
                  name="alertTriangle"
                  size={14}
                  className="mt-0.5 shrink-0 text-warning-600 dark:text-warning-400"
                />
                <p className="text-[11px] leading-4 text-warning-700 dark:text-warning-300">
                  {exceedingPairs.length} pair override
                  {exceedingPairs.length === 1 ? '' : 's'} (
                  {exceedingPairs.map((row) => row.pair.symbol).join(', ')}) exceed these caps.
                  Saving will not rewrite them; adjust each pair explicitly if required.
                </p>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-secondary-200 pt-3 dark:border-secondary-800">
              <p className="flex items-center gap-1.5 text-[10px] text-secondary-500 dark:text-secondary-400">
                <Icon name="shieldCheck" size={12} />A backend must enforce risk limits
                independently before any real execution.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReset}
                  disabled={!dirty || saving}
                >
                  Reset changes
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleSaveGlobal()}
                  loading={saving}
                  disabled={!dirty}
                >
                  Save global defaults
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Current global snapshot" />
            <CardBody>
              <dl className="space-y-2 text-[11px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-secondary-500 dark:text-secondary-400">Risk / operation</dt>
                  <dd className="font-medium tabular-nums text-secondary-800 dark:text-secondary-200">
                    {globalRisk.maxRiskPerTradePct}%
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-secondary-500 dark:text-secondary-400">Exposure</dt>
                  <dd className="font-medium tabular-nums text-secondary-800 dark:text-secondary-200">
                    {globalRisk.maxExposurePct}%
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-secondary-500 dark:text-secondary-400">Positions</dt>
                  <dd className="font-medium tabular-nums text-secondary-800 dark:text-secondary-200">
                    {globalRisk.maxConcurrentPositions}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-secondary-500 dark:text-secondary-400">Sessions</dt>
                  <dd className="text-right font-medium text-secondary-800 dark:text-secondary-200">
                    {globalRisk.sessions.enabled ? globalRisk.sessions.sessions.join(', ') : 'Any'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-secondary-500 dark:text-secondary-400">Cooldown</dt>
                  <dd className="font-medium text-secondary-800 dark:text-secondary-200">
                    {formatMinutes(globalRisk.cooldownMinutes)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-secondary-100 pt-2 dark:border-secondary-800">
                  <dt className="text-secondary-500 dark:text-secondary-400">Saved</dt>
                  <dd className="font-medium text-secondary-800 dark:text-secondary-200">
                    {formatDateTime(globalRisk.updatedAt)}
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Override policy" />
            <CardBody>
              <ul className="space-y-2 text-[11px] leading-4 text-secondary-500 dark:text-secondary-400">
                <li className="flex gap-2">
                  <Icon name="check" size={12} className="mt-0.5 shrink-0 text-success-500" />
                  Pair overrides are stored independently and are never wiped by global saves.
                </li>
                <li className="flex gap-2">
                  <Icon name="check" size={12} className="mt-0.5 shrink-0 text-success-500" />
                  Pair values can never validate above the current global caps.
                </li>
                <li className="flex gap-2">
                  <Icon name="check" size={12} className="mt-0.5 shrink-0 text-success-500" />
                  Emergency halt is a local guard; per-pair flags stay unchanged.
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Pair-level risk overrides"
          description="Each pair can inherit global defaults or define its own stop-loss, take-profit, sizing, session, and cooldown settings."
          actions={
            <span className="text-[10px] text-secondary-500 dark:text-secondary-400">
              {riskRows.filter((row) => !row.configuration.inheritGlobal).length} override
              {riskRows.filter((row) => !row.configuration.inheritGlobal).length === 1
                ? ''
                : 's'}{' '}
              of {riskRows.length} pairs
            </span>
          }
        />
        <DataTable
          data={riskRows}
          columns={columns}
          rowKey={(row) => row.pair.id}
          initialSort={{ key: 'pair', direction: 'asc' }}
          pageSize={10}
          emptyState="No pairs configured."
        />
      </Card>

      <Modal
        open={Boolean(editingRow)}
        onClose={() => setEditingPairId(null)}
        title={editingRow ? `Risk settings · ${editingRow.pair.symbol}` : 'Pair risk settings'}
        description="Pair-level overrides remain independent of global defaults. Save from within the form."
        size="lg"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setEditingPairId(null)}>
            Close
          </Button>
        }
      >
        {editingRow ? (
          <PairRiskForm
            key={editingRow.pair.id}
            pair={editingRow.pair}
            configuration={editingRow.configuration}
            globalRisk={globalRisk}
            readOnly={editingRow.pair.status === 'archived'}
            onSaved={() => setEditingPairId(null)}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={emergencyConfirmOpen}
        title={emergencyActive ? 'Lift emergency automation halt?' : 'Halt all automation?'}
        description={
          emergencyActive
            ? 'This removes the global guard from local dashboard state. Pair automation flags, assignments, and configurations are not changed. Any pair with automation enabled may become effectively active again.'
            : 'This sets a global guard that blocks effective automation for every pair in this demo dashboard.'
        }
        confirmLabel={emergencyActive ? 'Lift halt' : 'Halt all automation'}
        tone={emergencyActive ? 'primary' : 'danger'}
        icon={emergencyActive ? 'shieldCheck' : 'alertTriangle'}
        loading={emergencyLoading}
        onCancel={() => setEmergencyConfirmOpen(false)}
        onConfirm={() => void handleEmergency()}
      >
        <div className="space-y-1.5 rounded-md border border-secondary-200 bg-secondary-50 px-2.5 py-2 text-[11px] text-secondary-600 dark:border-secondary-700 dark:bg-secondary-800 dark:text-secondary-300">
          <p>
            Scope: all {pairs.length} configured pairs. {automationEnabledPairs} pair
            {automationEnabledPairs === 1 ? '' : 's'} currently have automation switched on.
          </p>
          <p>Per-pair flags and configurations remain unchanged.</p>
          <p className="font-medium text-secondary-700 dark:text-secondary-200">
            This updates local application state only. No broker or backend connection exists.
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
