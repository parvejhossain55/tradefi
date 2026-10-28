import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/Button';
import { Field, Input, Select, Textarea, Toggle } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { notify, notifyError } from '@/store/toastStore';
import { useTradingStore } from '@/store/tradingStore';
import { TradingApiError } from '@/services/tradingApi';
import type { MarketType, PairInput, Timeframe, TradingPair } from '@/types/trading';
import { MARKET_TYPES, TIMEFRAMES } from '@/types/trading';
import { normalizePairSymbol, validatePairForm } from '@/utils/trading';

interface PairFormDialogProps {
  open: boolean;
  onClose: () => void;
  pair?: TradingPair | null;
  onCreated?: (pair: TradingPair) => void;
}

interface FormState {
  symbol: string;
  displayName: string;
  marketType: MarketType;
  broker: string;
  defaultTimeframe: Timeframe;
  strategyId: string;
  automationEnabled: boolean;
  notes: string;
}

const emptyForm = (strategyId = ''): FormState => ({
  symbol: '',
  displayName: '',
  marketType: 'Forex',
  broker: '',
  defaultTimeframe: 'M15',
  strategyId,
  automationEnabled: false,
  notes: '',
});

export function PairFormDialog({ open, onClose, pair, onCreated }: PairFormDialogProps) {
  const snapshot = useTradingStore((state) => state.snapshot);
  const createPair = useTradingStore((state) => state.createPair);
  const updatePair = useTradingStore((state) => state.updatePair);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const editing = Boolean(pair);
  const strategies = useMemo(
    () => (snapshot?.strategies ?? []).filter((strategy) => editing || strategy.enabled),
    [snapshot?.strategies, editing]
  );
  const assignment = useMemo(
    () =>
      pair && snapshot
        ? snapshot.assignments.find((candidate) => candidate.pairId === pair.id)
        : undefined,
    [pair, snapshot]
  );
  const currentStrategy = useMemo(() => {
    if (editing) {
      return snapshot?.strategies.find((strategy) => strategy.id === assignment?.strategyId);
    }
    return snapshot?.strategies.find((strategy) => strategy.id === form.strategyId);
  }, [assignment?.strategyId, editing, form.strategyId, snapshot?.strategies]);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSaving(false);
    if (pair) {
      setForm({
        symbol: pair.symbol,
        displayName: pair.displayName,
        marketType: pair.marketType,
        broker: pair.broker ?? '',
        defaultTimeframe: pair.defaultTimeframe,
        strategyId: assignment?.strategyId ?? '',
        automationEnabled: pair.automationEnabled,
        notes: pair.notes ?? '',
      });
    } else {
      const defaultStrategy = snapshot?.settings.defaultStrategyId;
      const enabledDefault = snapshot?.strategies.find(
        (strategy) => strategy.id === defaultStrategy && strategy.enabled
      );
      setForm(emptyForm(enabledDefault?.id ?? ''));
    }
  }, [
    open,
    pair,
    assignment?.strategyId,
    snapshot?.settings.defaultStrategyId,
    snapshot?.strategies,
  ]);

  const automationAllowed =
    !snapshot?.globalRisk.emergencyAutomationDisabled &&
    currentStrategy?.enabled === true &&
    (editing ? assignment?.status === 'active' : true) &&
    (!pair || pair.status === 'enabled');

  const clearError = (field: string) => {
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    clearError(key);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot) return;

    const input: PairInput = {
      symbol: normalizePairSymbol(form.symbol),
      displayName: form.displayName.trim(),
      marketType: form.marketType,
      broker: form.broker.trim() || undefined,
      defaultTimeframe: form.defaultTimeframe,
      automationEnabled: form.automationEnabled && automationAllowed,
      notes: form.notes.trim() || undefined,
      strategyId: editing ? undefined : form.strategyId || undefined,
    };

    const nextErrors = validatePairForm(input, snapshot.pairs, pair?.id);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      if (pair) {
        await updatePair(pair.id, input);
        notify({
          tone: 'success',
          title: 'Trading pair updated',
          description: `${input.symbol} details were saved. Strategy configuration was preserved.`,
        });
      } else {
        const updatedSnapshot = await createPair(input);
        const created = updatedSnapshot.pairs.find(
          (candidate) => candidate.symbol === input.symbol
        );
        const assignedStrategy = updatedSnapshot.strategies.find(
          (strategy) => strategy.id === input.strategyId
        );
        notify({
          tone: 'success',
          title: 'Trading pair created',
          description: assignedStrategy
            ? `${input.symbol} was created with ${assignedStrategy.name} assigned at default parameters.`
            : `${input.symbol} was created without a strategy assignment.`,
        });
        if (created) onCreated?.(created);
      }
      onClose();
    } catch (error) {
      if (error instanceof TradingApiError && error.fieldErrors) {
        setErrors((current) => ({ ...current, ...error.fieldErrors }));
      }
      notifyError(error, 'The trading pair could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const compatibilityWarning =
    currentStrategy &&
    (!currentStrategy.supportedMarkets.includes(form.marketType) ||
      !currentStrategy.supportedTimeframes.includes(form.defaultTimeframe)) &&
    `This strategy declares support for ${currentStrategy.supportedMarkets.join(
      ', '
    )} and ${currentStrategy.supportedTimeframes.join(', ')}. You can still save, but review the assignment.`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${pair?.symbol}` : 'Create trading pair'}
      description={
        editing
          ? 'Update pair metadata and automation. The assigned strategy and its parameters are managed separately.'
          : 'Add a market pair, then optionally assign a reusable strategy with its default parameters.'
      }
      size="lg"
      dismissible={!saving}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="pair-form" size="sm" loading={saving}>
            {editing ? 'Save changes' : 'Create pair'}
          </Button>
        </>
      }
    >
      <form id="pair-form" className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Pair symbol"
            htmlFor="pair-symbol"
            required
            error={errors.symbol}
            hint="Normalized to uppercase letters and digits. Must be unique."
          >
            <Input
              id="pair-symbol"
              value={form.symbol}
              invalid={Boolean(errors.symbol)}
              placeholder="EURUSD"
              autoFocus
              onChange={(event) =>
                update('symbol', event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
              }
            />
          </Field>
          <Field label="Display name" htmlFor="pair-name" required error={errors.displayName}>
            <Input
              id="pair-name"
              value={form.displayName}
              invalid={Boolean(errors.displayName)}
              placeholder="Euro / US Dollar"
              onChange={(event) => update('displayName', event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Market type" htmlFor="pair-market" required error={errors.marketType}>
            <Select
              id="pair-market"
              value={form.marketType}
              invalid={Boolean(errors.marketType)}
              onChange={(event) => update('marketType', event.target.value as MarketType)}
            >
              {MARKET_TYPES.map((market) => (
                <option key={market} value={market}>
                  {market}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Broker or data source"
            htmlFor="pair-broker"
            error={errors.broker}
            hint="Optional label only. No broker integration is created."
          >
            <Input
              id="pair-broker"
              value={form.broker}
              invalid={Boolean(errors.broker)}
              placeholder="Mock FX feed"
              onChange={(event) => update('broker', event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Default timeframe"
            htmlFor="pair-timeframe"
            required
            error={errors.defaultTimeframe}
          >
            <Select
              id="pair-timeframe"
              value={form.defaultTimeframe}
              onChange={(event) => update('defaultTimeframe', event.target.value as Timeframe)}
            >
              {TIMEFRAMES.map((timeframe) => (
                <option key={timeframe} value={timeframe}>
                  {timeframe}
                </option>
              ))}
            </Select>
          </Field>
          {!editing ? (
            <Field
              label="Initial strategy assignment"
              htmlFor="pair-strategy"
              error={errors.strategyId}
              hint="Defaults are loaded. Pair-specific overrides can be added later."
            >
              <Select
                id="pair-strategy"
                value={form.strategyId}
                onChange={(event) => {
                  update('strategyId', event.target.value);
                  if (!event.target.value) update('automationEnabled', false);
                }}
              >
                <option value="">No initial strategy</option>
                {strategies.map((strategy) => (
                  <option key={strategy.id} value={strategy.id}>
                    {strategy.name} · v{strategy.version}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div className="rounded-lg border border-secondary-200 bg-secondary-50 px-3 py-2 dark:border-secondary-800 dark:bg-secondary-950/40">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary-400 dark:text-secondary-500">
                Assigned strategy
              </p>
              <p className="mt-0.5 text-xs font-medium text-secondary-800 dark:text-secondary-200">
                {currentStrategy?.name ?? 'No strategy assigned'}
                {currentStrategy ? (
                  <span className="ml-1 font-normal text-secondary-500">
                    · v{assignment?.strategyVersion}
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-[10px] text-secondary-500 dark:text-secondary-400">
                Change or configure it from the pair details page.
              </p>
            </div>
          )}
        </div>

        {compatibilityWarning ? (
          <div className="flex gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 dark:border-warning-500/20 dark:bg-warning-500/5">
            <Icon
              name="alertTriangle"
              size={14}
              className="mt-0.5 shrink-0 text-warning-600 dark:text-warning-400"
            />
            <p className="text-[11px] leading-4 text-warning-700 dark:text-warning-300">
              {compatibilityWarning}
            </p>
          </div>
        ) : null}

        <div className="rounded-lg border border-secondary-200 px-3.5 py-3 dark:border-secondary-800">
          <Toggle
            checked={form.automationEnabled && automationAllowed}
            onChange={(checked) => update('automationEnabled', checked)}
            disabled={!automationAllowed}
            label="Automation enabled"
            description={
              automationAllowed
                ? 'The pair is eligible to run in the demo model. No broker orders are placed.'
                : snapshot?.globalRisk.emergencyAutomationDisabled
                  ? 'Blocked by the global emergency automation halt.'
                  : editing && assignment?.status === 'disabled'
                    ? 'Enable the strategy assignment before turning on automation.'
                    : !currentStrategy
                      ? 'Select an enabled strategy before enabling automation.'
                      : currentStrategy && !currentStrategy.enabled
                        ? 'The selected strategy is disabled.'
                        : 'Automation is unavailable for this pair state.'
            }
          />
          {errors.automationEnabled ? (
            <p className="mt-1.5 text-[11px] font-medium text-danger-600 dark:text-danger-400">
              {errors.automationEnabled}
            </p>
          ) : null}
        </div>

        <Field label="Notes" htmlFor="pair-notes" error={errors.notes}>
          <Textarea
            id="pair-notes"
            value={form.notes}
            invalid={Boolean(errors.notes)}
            placeholder="Optional operational context for this pair."
            onChange={(event) => update('notes', event.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
