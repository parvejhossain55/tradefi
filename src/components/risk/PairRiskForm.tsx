import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { Field, InlineCheckbox, Input, Select, Toggle } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { notify, notifyError } from '@/store/toastStore';
import { useTradingStore } from '@/store/tradingStore';
import { TradingApiError } from '@/services/tradingApi';
import type {
  GlobalRiskConfiguration,
  PairRiskConfiguration,
  PairRiskInput,
  PositionSizingMode,
  StopLossMode,
  TakeProfitMode,
  TradingPair,
} from '@/types/trading';
import {
  POSITION_SIZING_MODE_LABELS,
  SESSIONS,
  STOP_LOSS_MODE_LABELS,
  TAKE_PROFIT_MODE_LABELS,
} from '@/types/trading';
import { validatePairRiskValues } from '@/utils/trading';

interface PairRiskFormProps {
  pair: TradingPair;
  configuration: PairRiskConfiguration;
  globalRisk: GlobalRiskConfiguration;
  readOnly?: boolean;
  onSaved?: () => void;
}

function toInput(configuration: PairRiskConfiguration): PairRiskInput {
  return {
    inheritGlobal: configuration.inheritGlobal,
    maxRiskPerTradePct: configuration.maxRiskPerTradePct,
    maxExposurePct: configuration.maxExposurePct,
    maxConcurrentPositions: configuration.maxConcurrentPositions,
    stopLoss: { ...configuration.stopLoss },
    takeProfit: { ...configuration.takeProfit },
    positionSizing: { ...configuration.positionSizing },
    sessions: {
      enabled: configuration.sessions.enabled,
      sessions: [...configuration.sessions.sessions],
    },
    cooldownMinutes: configuration.cooldownMinutes,
  };
}

export function PairRiskForm({
  pair,
  configuration,
  globalRisk,
  readOnly = false,
  onSaved,
}: PairRiskFormProps) {
  const savePairRisk = useTradingStore((state) => state.savePairRisk);
  const [form, setForm] = useState<PairRiskInput>(() => toInput(configuration));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const lastUpdatedRef = useRef(configuration.updatedAt);

  useEffect(() => {
    if (configuration.updatedAt === lastUpdatedRef.current) return;
    lastUpdatedRef.current = configuration.updatedAt;
    setForm(toInput(configuration));
  }, [configuration]);

  const clearError = (field: string) => {
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const update = <K extends keyof PairRiskInput>(key: K, value: PairRiskInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    clearError(key);
  };

  const toggleInheritance = (inherit: boolean) => {
    setForm((current) =>
      inherit
        ? {
            ...current,
            inheritGlobal: true,
            maxRiskPerTradePct: globalRisk.maxRiskPerTradePct,
            maxExposurePct: globalRisk.maxExposurePct,
            maxConcurrentPositions: globalRisk.maxConcurrentPositions,
            sessions: {
              enabled: globalRisk.sessions.enabled,
              sessions: [...globalRisk.sessions.sessions],
            },
            cooldownMinutes: globalRisk.cooldownMinutes,
          }
        : { ...current, inheritGlobal: false }
    );
    clearError('sessions');
  };

  const handleSave = async () => {
    const validation = validatePairRiskValues(form, globalRisk);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      notify({
        tone: 'error',
        title: 'Risk settings need attention',
        description: 'Fix the highlighted fields before saving.',
      });
      return;
    }
    setSaving(true);
    try {
      await savePairRisk(pair.id, form);
      notify({
        tone: 'success',
        title: 'Pair risk settings saved',
        description: `${pair.symbol} now uses ${
          form.inheritGlobal ? 'global default limits' : 'pair-specific risk overrides'
        }. The backend must still enforce these controls independently.`,
      });
      setErrors({});
      onSaved?.();
    } catch (error) {
      if (error instanceof TradingApiError && error.fieldErrors) {
        setErrors(error.fieldErrors);
      }
      notifyError(error, 'The pair risk settings could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(toInput(configuration));
    setErrors({});
  };

  const numericDisabled = form.inheritGlobal || readOnly;
  const inputDisabled = readOnly;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-secondary-200 bg-secondary-50/60 px-3.5 py-3 dark:border-secondary-800 dark:bg-secondary-950/40">
        <Toggle
          checked={form.inheritGlobal}
          onChange={toggleInheritance}
          disabled={readOnly}
          label="Use global risk defaults"
          description="Global limits apply unless this pair explicitly overrides them. Overrides are never rewritten when global defaults change."
        />
        {readOnly ? (
          <p className="mt-2 text-[10px] text-secondary-500 dark:text-secondary-400">
            Archived pair — risk configuration is read-only.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Max risk per operation"
          htmlFor="pair-risk-percent"
          required
          error={errors.maxRiskPerTradePct}
          hint={
            form.inheritGlobal
              ? `Global: ${globalRisk.maxRiskPerTradePct}%`
              : 'Percentage of equity'
          }
        >
          <Input
            id="pair-risk-percent"
            type="number"
            min={0.01}
            max={10}
            step={0.01}
            disabled={numericDisabled}
            invalid={Boolean(errors.maxRiskPerTradePct)}
            value={String(form.maxRiskPerTradePct)}
            onChange={(event) => update('maxRiskPerTradePct', Number(event.target.value))}
          />
        </Field>
        <Field
          label="Max configured exposure"
          htmlFor="pair-risk-exposure"
          required
          error={errors.maxExposurePct}
          hint={form.inheritGlobal ? `Global: ${globalRisk.maxExposurePct}%` : 'Total exposure cap'}
        >
          <Input
            id="pair-risk-exposure"
            type="number"
            min={0.01}
            max={100}
            step={0.01}
            disabled={numericDisabled}
            invalid={Boolean(errors.maxExposurePct)}
            value={String(form.maxExposurePct)}
            onChange={(event) => update('maxExposurePct', Number(event.target.value))}
          />
        </Field>
        <Field
          label="Max concurrent positions"
          htmlFor="pair-risk-positions"
          required
          error={errors.maxConcurrentPositions}
          hint={
            form.inheritGlobal ? `Global: ${globalRisk.maxConcurrentPositions}` : 'Whole number'
          }
        >
          <Input
            id="pair-risk-positions"
            type="number"
            min={1}
            max={50}
            step={1}
            disabled={numericDisabled}
            invalid={Boolean(errors.maxConcurrentPositions)}
            value={String(form.maxConcurrentPositions)}
            onChange={(event) => update('maxConcurrentPositions', Number(event.target.value))}
          />
        </Field>
      </div>

      <div className="rounded-lg border border-secondary-200 p-3 dark:border-secondary-800">
        <Toggle
          checked={form.sessions.enabled}
          onChange={(checked) => update('sessions', { ...form.sessions, enabled: checked })}
          disabled={numericDisabled}
          label="Restrict trading sessions"
          description="When enabled, only the selected sessions are eligible."
        />
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2">
          {SESSIONS.map((session) => (
            <InlineCheckbox
              key={session}
              checked={form.sessions.sessions.includes(session)}
              disabled={numericDisabled || !form.sessions.enabled}
              onChange={(checked) =>
                update('sessions', {
                  ...form.sessions,
                  sessions: checked
                    ? [...form.sessions.sessions, session]
                    : form.sessions.sessions.filter((candidate) => candidate !== session),
                })
              }
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-secondary-200 p-3 dark:border-secondary-800">
          <p className="mb-2 text-xs font-semibold text-secondary-800 dark:text-secondary-200">
            Stop loss
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mode" htmlFor="pair-stop-mode">
              <Select
                id="pair-stop-mode"
                value={form.stopLoss.mode}
                disabled={inputDisabled}
                onChange={(event) =>
                  update('stopLoss', {
                    ...form.stopLoss,
                    mode: event.target.value as StopLossMode,
                  })
                }
              >
                {Object.entries(STOP_LOSS_MODE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={form.stopLoss.mode === 'percentage' ? 'Value (%)' : 'Value'}
              htmlFor="pair-stop-value"
              error={errors.stopLoss}
            >
              <Input
                id="pair-stop-value"
                type="number"
                min={0.01}
                step={0.1}
                disabled={inputDisabled}
                invalid={Boolean(errors.stopLoss)}
                value={String(form.stopLoss.value)}
                onChange={(event) =>
                  update('stopLoss', {
                    ...form.stopLoss,
                    value: Number(event.target.value),
                  })
                }
              />
            </Field>
          </div>
        </div>

        <div className="rounded-lg border border-secondary-200 p-3 dark:border-secondary-800">
          <p className="mb-2 text-xs font-semibold text-secondary-800 dark:text-secondary-200">
            Take profit
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mode" htmlFor="pair-target-mode">
              <Select
                id="pair-target-mode"
                value={form.takeProfit.mode}
                disabled={inputDisabled}
                onChange={(event) =>
                  update('takeProfit', {
                    ...form.takeProfit,
                    mode: event.target.value as TakeProfitMode,
                  })
                }
              >
                {Object.entries(TAKE_PROFIT_MODE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={
                form.takeProfit.mode === 'risk_reward'
                  ? 'Ratio (R)'
                  : form.takeProfit.mode === 'percentage'
                    ? 'Value (%)'
                    : 'Value'
              }
              htmlFor="pair-target-value"
              error={errors.takeProfit}
            >
              <Input
                id="pair-target-value"
                type="number"
                min={0.1}
                step={0.1}
                disabled={inputDisabled}
                invalid={Boolean(errors.takeProfit)}
                value={String(form.takeProfit.value)}
                onChange={(event) =>
                  update('takeProfit', {
                    ...form.takeProfit,
                    value: Number(event.target.value),
                  })
                }
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-secondary-200 p-3 dark:border-secondary-800">
          <p className="mb-2 text-xs font-semibold text-secondary-800 dark:text-secondary-200">
            Position sizing
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mode" htmlFor="pair-sizing-mode">
              <Select
                id="pair-sizing-mode"
                value={form.positionSizing.mode}
                disabled={inputDisabled}
                onChange={(event) =>
                  update('positionSizing', {
                    ...form.positionSizing,
                    mode: event.target.value as PositionSizingMode,
                  })
                }
              >
                {Object.entries(POSITION_SIZING_MODE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={form.positionSizing.mode === 'risk_percent' ? 'Risk (%)' : 'Lots'}
              htmlFor="pair-sizing-value"
              error={errors.positionSizing}
            >
              <Input
                id="pair-sizing-value"
                type="number"
                min={0.01}
                step={0.01}
                disabled={inputDisabled}
                invalid={Boolean(errors.positionSizing)}
                value={String(form.positionSizing.value)}
                onChange={(event) =>
                  update('positionSizing', {
                    ...form.positionSizing,
                    value: Number(event.target.value),
                  })
                }
              />
            </Field>
          </div>
        </div>

        <div className="rounded-lg border border-secondary-200 p-3 dark:border-secondary-800">
          <Field
            label="Cooldown between operations"
            htmlFor="pair-cooldown"
            error={errors.cooldownMinutes}
            hint="Whole minutes; 0 disables the cooldown."
          >
            <Input
              id="pair-cooldown"
              type="number"
              min={0}
              max={10080}
              step={1}
              disabled={numericDisabled}
              invalid={Boolean(errors.cooldownMinutes)}
              value={String(form.cooldownMinutes)}
              onChange={(event) => update('cooldownMinutes', Number(event.target.value))}
            />
          </Field>
          <p className="mt-2 text-[10px] leading-4 text-secondary-500 dark:text-secondary-400">
            These settings configure the dashboard model. The backend must independently enforce
            risk limits before any real execution.
          </p>
        </div>
      </div>

      {!readOnly ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-secondary-200 pt-3 dark:border-secondary-800">
          <p className="flex items-center gap-1.5 text-[10px] text-secondary-500 dark:text-secondary-400">
            <Icon name="shieldCheck" size={12} />
            Pair overrides remain independent of global defaults.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleReset} disabled={saving}>
              Reset changes
            </Button>
            <Button size="sm" onClick={() => void handleSave()} loading={saving}>
              Save risk settings
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
