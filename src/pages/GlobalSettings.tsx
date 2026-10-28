import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select, Toggle } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { notify, notifyError } from '@/store/toastStore';
import { useTradingStore } from '@/store/tradingStore';
import type {
  GlobalSettings,
  MarketType,
  NotificationPreferences,
  Timeframe,
} from '@/types/trading';
import { MARKET_TYPES, TIMEFRAMES } from '@/types/trading';
import { formatMinutes } from '@/utils/trading';

interface SettingsFormState {
  appName: string;
  timezone: string;
  defaultMarket: MarketType;
  defaultTimeframe: Timeframe;
  defaultStrategyId: string;
  notifications: NotificationPreferences;
}

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'Europe/London',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Sydney',
];

function toSettingsForm(settings?: GlobalSettings): SettingsFormState {
  return {
    appName: settings?.appName ?? 'TradeFi Ops',
    timezone: settings?.timezone ?? 'UTC',
    defaultMarket: settings?.defaultMarket ?? 'Forex',
    defaultTimeframe: settings?.defaultTimeframe ?? 'M15',
    defaultStrategyId: settings?.defaultStrategyId ?? '',
    notifications: {
      signalAlerts: settings?.notifications.signalAlerts ?? true,
      executionAlerts: settings?.notifications.executionAlerts ?? true,
      riskAlerts: settings?.notifications.riskAlerts ?? true,
      dailyDigest: settings?.notifications.dailyDigest ?? false,
    },
  };
}

export function GlobalSettings() {
  const snapshot = useTradingStore((state) => state.snapshot);
  const saveSettings = useTradingStore((state) => state.saveSettings);
  const resetDemoData = useTradingStore((state) => state.resetDemoData);
  const [form, setForm] = useState<SettingsFormState>(() => toSettingsForm(snapshot?.settings));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const lastSavedSignatureRef = useRef('');

  const savedForm = useMemo<SettingsFormState | null>(
    () => (snapshot ? toSettingsForm(snapshot.settings) : null),
    [snapshot]
  );
  const savedSignature = snapshot
    ? `${snapshot.settings.updatedAt}|${JSON.stringify(savedForm)}`
    : '';

  useEffect(() => {
    if (!snapshot || !savedForm) return;
    if (savedSignature === lastSavedSignatureRef.current) return;
    lastSavedSignatureRef.current = savedSignature;
    setForm(toSettingsForm(snapshot.settings));
    setErrors({});
  }, [savedForm, savedSignature, snapshot]);

  const dirty = Boolean(savedForm && JSON.stringify(form) !== JSON.stringify(savedForm));
  const unsavedGuard = useUnsavedChanges(dirty);

  const update = <K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const updateNotification = (key: keyof NotificationPreferences, value: boolean) => {
    setForm((current) => ({
      ...current,
      notifications: { ...current.notifications, [key]: value },
    }));
  };

  const handleSave = async () => {
    if (!snapshot) return;
    const nextErrors: Record<string, string> = {};
    if (!form.appName.trim()) nextErrors.appName = 'Application name is required.';
    if (form.appName.trim().length > 50) {
      nextErrors.appName = 'Keep the application name under 50 characters.';
    }
    if (!TIMEZONES.includes(form.timezone)) nextErrors.timezone = 'Choose a supported timezone.';
    if (
      form.defaultStrategyId &&
      !snapshot.strategies.some((strategy) => strategy.id === form.defaultStrategyId)
    ) {
      nextErrors.defaultStrategyId = 'Choose an existing strategy definition.';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      await saveSettings({
        ...snapshot.settings,
        appName: form.appName.trim(),
        timezone: form.timezone,
        defaultMarket: form.defaultMarket,
        defaultTimeframe: form.defaultTimeframe,
        defaultStrategyId: form.defaultStrategyId || null,
        notifications: form.notifications,
      });
      notify({
        tone: 'success',
        title: 'Global settings saved',
        description:
          'Defaults apply to new pairs and forms. Existing pair configurations were not modified.',
      });
    } catch (error) {
      notifyError(error, 'Global settings could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDemo = async () => {
    setResetting(true);
    try {
      const resetSnapshot = await resetDemoData();
      setForm(toSettingsForm(resetSnapshot.settings));
      setResetOpen(false);
      notify({
        tone: 'success',
        title: 'Demo workspace reset',
        description: 'Seed pairs, strategies, assignments, risk, and history were restored.',
      });
    } catch (error) {
      notifyError(error, 'The demo workspace could not be reset.');
    } finally {
      setResetting(false);
    }
  };

  if (!snapshot) return null;

  const globalRisk = snapshot.globalRisk;
  const defaultStrategy = snapshot.strategies.find(
    (strategy) => strategy.id === form.defaultStrategyId
  );

  return (
    <div>
      <PageHeader
        title="Global Settings"
        description="Workspace preferences, defaults, notification choices, and read-only integration placeholders. Credentials are never stored in this frontend."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              disabled={!dirty || saving}
              onClick={() => {
                setForm(toSettingsForm(snapshot.settings));
                setErrors({});
              }}
            >
              Reset changes
            </Button>
            <Button type="submit" form="settings-form" size="sm" loading={saving} disabled={!dirty}>
              Save settings
            </Button>
          </>
        }
      />

      <form
        id="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
      >
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              title="General preferences"
              description="Application identity and default pair values."
              actions={
                dirty ? (
                  <Badge tone="warning" dot>
                    Unsaved changes
                  </Badge>
                ) : null
              }
            />
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Application name"
                  htmlFor="settings-app-name"
                  required
                  error={errors.appName}
                  hint="Shown in the sidebar and browser title."
                >
                  <Input
                    id="settings-app-name"
                    value={form.appName}
                    maxLength={60}
                    invalid={Boolean(errors.appName)}
                    onChange={(event) => update('appName', event.target.value)}
                  />
                </Field>
                <Field
                  label="Timezone"
                  htmlFor="settings-timezone"
                  error={errors.timezone}
                  hint="Display label for operational timestamps. Demo records remain ISO timestamps."
                >
                  <Select
                    id="settings-timezone"
                    value={form.timezone}
                    invalid={Boolean(errors.timezone)}
                    onChange={(event) => update('timezone', event.target.value)}
                  >
                    {TIMEZONES.map((timezone) => (
                      <option key={timezone} value={timezone}>
                        {timezone}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="border-t border-secondary-200 pt-4 dark:border-secondary-800">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary-400 dark:text-secondary-500">
                  Default pair configuration
                </p>
                <div className="mt-2 grid gap-4 sm:grid-cols-3">
                  <Field label="Default market" htmlFor="settings-market">
                    <Select
                      id="settings-market"
                      value={form.defaultMarket}
                      onChange={(event) =>
                        update('defaultMarket', event.target.value as MarketType)
                      }
                    >
                      {MARKET_TYPES.map((market) => (
                        <option key={market} value={market}>
                          {market}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Default timeframe" htmlFor="settings-timeframe">
                    <Select
                      id="settings-timeframe"
                      value={form.defaultTimeframe}
                      onChange={(event) =>
                        update('defaultTimeframe', event.target.value as Timeframe)
                      }
                    >
                      {TIMEFRAMES.map((timeframe) => (
                        <option key={timeframe} value={timeframe}>
                          {timeframe}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Default strategy"
                    htmlFor="settings-strategy"
                    error={errors.defaultStrategyId}
                    hint="Prefills new pair forms only."
                  >
                    <Select
                      id="settings-strategy"
                      value={form.defaultStrategyId}
                      invalid={Boolean(errors.defaultStrategyId)}
                      onChange={(event) => update('defaultStrategyId', event.target.value)}
                    >
                      <option value="">No default strategy</option>
                      {snapshot.strategies.map((strategy) => (
                        <option key={strategy.id} value={strategy.id}>
                          {strategy.name}
                          {strategy.enabled ? '' : ' (disabled)'}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                {defaultStrategy && !defaultStrategy.enabled ? (
                  <p className="mt-2 text-[10px] text-warning-600 dark:text-warning-400">
                    The selected default strategy is disabled. New pair forms will show it but
                    automation cannot be enabled with it.
                  </p>
                ) : (
                  <p className="mt-2 text-[10px] leading-4 text-secondary-500 dark:text-secondary-400">
                    Default values prefill creation forms. They do not assign strategies to existing
                    pairs or rewrite any pair configuration.
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Risk defaults"
              description="Global caps live in Risk Management so overrides stay auditable."
              actions={
                <Link
                  to="/risk"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:underline dark:text-primary-400"
                >
                  Manage
                  <Icon name="chevronRight" size={12} />
                </Link>
              }
            />
            <CardBody>
              <dl className="space-y-2 text-[11px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-secondary-500 dark:text-secondary-400">
                    Max risk / operation
                  </dt>
                  <dd className="font-medium tabular-nums text-secondary-800 dark:text-secondary-200">
                    {globalRisk.maxRiskPerTradePct}%
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-secondary-500 dark:text-secondary-400">Max exposure</dt>
                  <dd className="font-medium tabular-nums text-secondary-800 dark:text-secondary-200">
                    {globalRisk.maxExposurePct}%
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-secondary-500 dark:text-secondary-400">Max positions</dt>
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
                  <dt className="text-secondary-500 dark:text-secondary-400">Emergency halt</dt>
                  <dd>
                    <Badge tone={globalRisk.emergencyAutomationDisabled ? 'danger' : 'success'} dot>
                      {globalRisk.emergencyAutomationDisabled ? 'Active' : 'Inactive'}
                    </Badge>
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-[10px] leading-4 text-secondary-500 dark:text-secondary-400">
                Risk settings are edited with validation and confirmation in Risk Management.
              </p>
            </CardBody>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Notification preferences"
              description="Local preferences only. No email, push, or webhook delivery is connected."
            />
            <CardBody className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-secondary-200 p-3 dark:border-secondary-800">
                  <Toggle
                    checked={form.notifications.signalAlerts}
                    onChange={(checked) => updateNotification('signalAlerts', checked)}
                    label="Signal alerts"
                    description="Notify when simulated signals are generated."
                  />
                </div>
                <div className="rounded-lg border border-secondary-200 p-3 dark:border-secondary-800">
                  <Toggle
                    checked={form.notifications.executionAlerts}
                    onChange={(checked) => updateNotification('executionAlerts', checked)}
                    label="Execution alerts"
                    description="Notify about simulated execution processing."
                  />
                </div>
                <div className="rounded-lg border border-secondary-200 p-3 dark:border-secondary-800">
                  <Toggle
                    checked={form.notifications.riskAlerts}
                    onChange={(checked) => updateNotification('riskAlerts', checked)}
                    label="Risk alerts"
                    description="Highlight blocked or failed risk checks."
                  />
                </div>
                <div className="rounded-lg border border-secondary-200 p-3 dark:border-secondary-800">
                  <Toggle
                    checked={form.notifications.dailyDigest}
                    onChange={(checked) => updateNotification('dailyDigest', checked)}
                    label="Daily digest"
                    description="Request a daily demo activity summary (not delivered)."
                  />
                </div>
              </div>
              <p className="flex items-center gap-1.5 text-[10px] text-secondary-500 dark:text-secondary-400">
                <Icon name="mail" size={12} />
                Preferences are stored in local mock data. No notification service is configured.
              </p>
            </CardBody>
          </Card>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-secondary-200 bg-white px-4 py-3 dark:border-secondary-800 dark:bg-secondary-900">
          <p className="text-[11px] text-secondary-500 dark:text-secondary-400">
            {dirty
              ? 'Unsaved settings changes. Save to persist them in local mock data.'
              : 'All settings are saved. Data is local to this browser.'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!dirty || saving}
              onClick={() => {
                setForm(toSettingsForm(snapshot.settings));
                setErrors({});
              }}
            >
              Reset changes
            </Button>
            <Button type="submit" size="sm" loading={saving} disabled={!dirty}>
              Save settings
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={resetOpen}
        title="Reset the demo workspace?"
        description="This restores the original seed data for pairs, strategies, assignments, risk configurations, settings, signals, executions, and events. Any local changes you made will be lost."
        confirmLabel="Reset demo data"
        tone="danger"
        icon="refresh"
        loading={resetting}
        onCancel={() => setResetOpen(false)}
        onConfirm={() => void handleResetDemo()}
      />

      <ConfirmDialog
        open={unsavedGuard.blocked}
        title="Discard unsaved settings?"
        description="You have unsaved global settings changes. Leaving now will discard them."
        confirmLabel="Discard and leave"
        cancelLabel="Stay on page"
        tone="danger"
        onCancel={unsavedGuard.reset}
        onConfirm={unsavedGuard.proceed}
      />
    </div>
  );
}
