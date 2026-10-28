import {
  SESSIONS,
  TIMEFRAMES,
  type ConfigValue,
  type GlobalRiskConfiguration,
  type PairRiskConfiguration,
  type PairRiskInput,
  type PairStatus,
  type SessionRestriction,
  type SignalEvent,
  type StatusTone,
  type StrategyAssignment,
  type StrategyDefinition,
  type StrategyInput,
  type StrategyParameterDefinition,
  type StrategyParameters,
  type TradingPair,
} from '@/types/trading';

export interface PairFormInput {
  symbol: string;
  displayName: string;
  marketType: TradingPair['marketType'];
  broker?: string;
  defaultTimeframe: TradingPair['defaultTimeframe'];
  automationEnabled: boolean;
  notes?: string;
  strategyId?: string | null;
}

export interface RiskValidationInput {
  maxRiskPerTradePct: number;
  maxExposurePct: number;
  maxConcurrentPositions: number;
  cooldownMinutes: number;
  sessions: SessionRestriction;
}

/** Symbols are compared and stored as uppercase alphanumeric strings only. */
export function normalizePairSymbol(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function normalizeIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function createId(prefix: string): string {
  const cryptoApi = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined;
  const suffix =
    cryptoApi && typeof cryptoApi.randomUUID === 'function'
      ? cryptoApi.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}_${suffix}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatShortDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '—';
  const diffSeconds = Math.round((now - time) / 1000);
  if (diffSeconds < 45) return 'just now';
  if (diffSeconds < 3600) return `${Math.max(1, Math.round(diffSeconds / 60))}m ago`;
  if (diffSeconds < 86400) return `${Math.round(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 604800) return `${Math.round(diffSeconds / 86400)}d ago`;
  return formatShortDateTime(iso);
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return 'Off';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}

export function formatLatency(latencyMs?: number): string {
  if (latencyMs === undefined) return '—';
  return `${latencyMs} ms`;
}

export function getAssignmentForPair(
  assignments: StrategyAssignment[],
  pairId: string
): StrategyAssignment | undefined {
  return assignments.find((assignment) => assignment.pairId === pairId);
}

export function getStrategyById(
  strategies: StrategyDefinition[],
  strategyId?: string | null
): StrategyDefinition | undefined {
  if (!strategyId) return undefined;
  return strategies.find((strategy) => strategy.id === strategyId);
}

export function getParameterDefault(parameter: StrategyParameterDefinition): ConfigValue {
  return parameter.defaultValue;
}

export function resolveParameterValue(
  parameter: StrategyParameterDefinition,
  configuration: StrategyParameters
): ConfigValue {
  const override = configuration[parameter.key];
  return override === undefined ? parameter.defaultValue : override;
}

export function isParameterCustomized(
  parameter: StrategyParameterDefinition,
  configuration: StrategyParameters
): boolean {
  return configuration[parameter.key] !== undefined;
}

export function buildDefaultParameters(schema: StrategyParameterDefinition[]): StrategyParameters {
  return schema.reduce<StrategyParameters>((accumulator, parameter) => {
    accumulator[parameter.key] = parameter.defaultValue;
    return accumulator;
  }, {});
}

function valuesEqual(left: ConfigValue, right: ConfigValue): boolean {
  if (typeof left === 'number' && typeof right === 'number') {
    return Math.abs(left - right) < Number.EPSILON * 100;
  }
  return String(left) === String(right);
}

export function configurationValuesEqual(
  left: StrategyParameters,
  right: StrategyParameters
): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    const leftValue = left[key];
    const rightValue = right[key];
    if (leftValue === undefined || rightValue === undefined) {
      if (leftValue !== rightValue) return false;
      continue;
    }
    if (!valuesEqual(leftValue, rightValue)) return false;
  }
  return true;
}

export function resolveConfiguration(
  schema: StrategyParameterDefinition[],
  configuration: StrategyParameters
): StrategyParameters {
  return schema.reduce<StrategyParameters>((accumulator, parameter) => {
    accumulator[parameter.key] = resolveParameterValue(parameter, configuration);
    return accumulator;
  }, {});
}

/** Returns only values that differ from the strategy defaults. */
export function buildConfigurationOverrides(
  schema: StrategyParameterDefinition[],
  values: StrategyParameters
): StrategyParameters {
  return schema.reduce<StrategyParameters>((accumulator, parameter) => {
    const value = values[parameter.key];
    if (value === undefined) return accumulator;
    if (!valuesEqual(value, parameter.defaultValue)) {
      accumulator[parameter.key] = value;
    }
    return accumulator;
  }, {});
}

export type ConfigurationState = 'unassigned' | 'defaults' | 'customized';

export function getConfigurationState(assignment?: StrategyAssignment): ConfigurationState {
  if (!assignment) return 'unassigned';
  return Object.keys(assignment.configuration).length > 0 ? 'customized' : 'defaults';
}

export function getConfigurationStatus(assignment?: StrategyAssignment): {
  label: string;
  tone: StatusTone;
} {
  const state = getConfigurationState(assignment);
  if (state === 'unassigned') return { label: 'Unassigned', tone: 'neutral' };
  if (state === 'customized') return { label: 'Customized', tone: 'info' };
  return { label: 'Defaults', tone: 'neutral' };
}

export interface AutomationStatus {
  label: string;
  tone: StatusTone;
  detail: string;
}

export function getAutomationStatus(
  pair: TradingPair,
  assignment: StrategyAssignment | undefined,
  strategy: StrategyDefinition | undefined,
  globalRisk: GlobalRiskConfiguration
): AutomationStatus {
  if (pair.status === 'archived') {
    return {
      label: 'Archived',
      tone: 'neutral',
      detail: 'Pair is archived and excluded from automation.',
    };
  }
  if (globalRisk.emergencyAutomationDisabled) {
    return {
      label: 'Halted globally',
      tone: 'danger',
      detail: 'Emergency automation halt is active in Risk Management.',
    };
  }
  if (pair.status === 'disabled') {
    return { label: 'Pair disabled', tone: 'neutral', detail: 'Pair is disabled.' };
  }
  if (!assignment) {
    return {
      label: 'Unassigned',
      tone: 'neutral',
      detail: 'No strategy is assigned to this pair.',
    };
  }
  if (assignment.status === 'disabled') {
    return {
      label: 'Assignment off',
      tone: 'warning',
      detail: 'The strategy assignment is disabled.',
    };
  }
  if (!strategy) {
    return {
      label: 'Strategy missing',
      tone: 'danger',
      detail: 'The assigned strategy no longer exists.',
    };
  }
  if (!strategy.enabled) {
    return {
      label: 'Strategy disabled',
      tone: 'warning',
      detail: 'The assigned strategy definition is disabled.',
    };
  }
  if (!pair.automationEnabled) {
    return {
      label: 'Automation off',
      tone: 'neutral',
      detail: 'Configuration is complete but automation is switched off for this pair.',
    };
  }
  return {
    label: 'Active',
    tone: 'success',
    detail: 'Pair is enabled, configured, and automation is on.',
  };
}

export function getPairStatusTone(status: PairStatus): StatusTone {
  if (status === 'enabled') return 'success';
  if (status === 'disabled') return 'warning';
  return 'neutral';
}

export function createPairRiskFallback(
  pairId: string,
  globalRisk: GlobalRiskConfiguration
): PairRiskConfiguration {
  return {
    pairId,
    inheritGlobal: true,
    maxRiskPerTradePct: globalRisk.maxRiskPerTradePct,
    maxExposurePct: globalRisk.maxExposurePct,
    maxConcurrentPositions: globalRisk.maxConcurrentPositions,
    stopLoss: { mode: 'swing_extreme', value: 1.5 },
    takeProfit: { mode: 'risk_reward', value: 2 },
    positionSizing: { mode: 'risk_percent', value: 0.5 },
    sessions: {
      enabled: globalRisk.sessions.enabled,
      sessions: [...globalRisk.sessions.sessions],
    },
    cooldownMinutes: globalRisk.cooldownMinutes,
    updatedAt: new Date().toISOString(),
  };
}

export function getEffectiveRisk(
  pairRisk: PairRiskConfiguration,
  globalRisk: GlobalRiskConfiguration
) {
  if (!pairRisk.inheritGlobal) {
    return {
      source: 'Pair override' as const,
      maxRiskPerTradePct: pairRisk.maxRiskPerTradePct,
      maxExposurePct: pairRisk.maxExposurePct,
      maxConcurrentPositions: pairRisk.maxConcurrentPositions,
      sessions: pairRisk.sessions,
      cooldownMinutes: pairRisk.cooldownMinutes,
      stopLoss: pairRisk.stopLoss,
      takeProfit: pairRisk.takeProfit,
      positionSizing: pairRisk.positionSizing,
    };
  }
  return {
    source: 'Global defaults' as const,
    maxRiskPerTradePct: globalRisk.maxRiskPerTradePct,
    maxExposurePct: globalRisk.maxExposurePct,
    maxConcurrentPositions: globalRisk.maxConcurrentPositions,
    sessions: globalRisk.sessions,
    cooldownMinutes: globalRisk.cooldownMinutes,
    stopLoss: pairRisk.stopLoss,
    takeProfit: pairRisk.takeProfit,
    positionSizing: pairRisk.positionSizing,
  };
}

export function validateParameterValue(
  parameter: StrategyParameterDefinition,
  value: ConfigValue | undefined
): string | null {
  if (value === undefined || value === null || value === '') {
    return parameter.required ? 'This field is required.' : null;
  }

  if (parameter.type === 'boolean') {
    return typeof value === 'boolean' ? null : 'Choose on or off.';
  }

  if (parameter.type === 'text') {
    if (typeof value !== 'string') return 'Enter text.';
    if (parameter.maxLength && value.length > parameter.maxLength) {
      return `Keep this under ${parameter.maxLength} characters.`;
    }
    return null;
  }

  if (parameter.type === 'select') {
    if (!parameter.options?.includes(String(value))) {
      return 'Choose one of the available options.';
    }
    return null;
  }

  if (parameter.type === 'timeframe') {
    if (!TIMEFRAMES.includes(String(value) as (typeof TIMEFRAMES)[number])) {
      return 'Choose a supported timeframe.';
    }
    return null;
  }

  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) return 'Enter a valid number.';

  if (parameter.type === 'integer' || parameter.type === 'duration') {
    if (!Number.isInteger(numericValue)) return 'Enter a whole number.';
  }
  if (parameter.type === 'percentage') {
    if (numericValue < 0 || numericValue > 100) return 'Enter a percentage between 0 and 100.';
  }
  if (parameter.min !== undefined && numericValue < parameter.min) {
    return `Must be at least ${parameter.min}${parameter.unit ? ` ${parameter.unit}` : ''}.`;
  }
  if (parameter.max !== undefined && numericValue > parameter.max) {
    return `Must be at most ${parameter.max}${parameter.unit ? ` ${parameter.unit}` : ''}.`;
  }
  return null;
}

export function validateConfiguration(
  schema: StrategyParameterDefinition[],
  values: StrategyParameters
): Record<string, string> {
  return schema.reduce<Record<string, string>>((errors, parameter) => {
    const error = validateParameterValue(parameter, values[parameter.key]);
    if (error) errors[parameter.key] = error;
    return errors;
  }, {});
}

export function validateSessionRestriction(sessions: SessionRestriction): string | null {
  if (!sessions.enabled) return null;
  if (sessions.sessions.length === 0) return 'Select at least one trading session.';
  const invalid = sessions.sessions.some(
    (session) => !SESSIONS.includes(session as (typeof SESSIONS)[number])
  );
  return invalid ? 'Select valid trading sessions.' : null;
}

export function validateRiskValues(input: RiskValidationInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (
    !Number.isFinite(input.maxRiskPerTradePct) ||
    input.maxRiskPerTradePct <= 0 ||
    input.maxRiskPerTradePct > 10
  ) {
    errors.maxRiskPerTradePct = 'Enter a risk limit above 0 and at most 10%.';
  }
  if (
    !Number.isFinite(input.maxExposurePct) ||
    input.maxExposurePct <= 0 ||
    input.maxExposurePct > 100
  ) {
    errors.maxExposurePct = 'Enter exposure above 0 and at most 100%.';
  }
  if (
    !Number.isInteger(input.maxConcurrentPositions) ||
    input.maxConcurrentPositions < 1 ||
    input.maxConcurrentPositions > 50
  ) {
    errors.maxConcurrentPositions = 'Enter a whole number between 1 and 50.';
  }
  if (
    !Number.isInteger(input.cooldownMinutes) ||
    input.cooldownMinutes < 0 ||
    input.cooldownMinutes > 10080
  ) {
    errors.cooldownMinutes = 'Enter whole minutes between 0 and 10080 (one week).';
  }
  const sessionError = validateSessionRestriction(input.sessions);
  if (sessionError) errors.sessions = sessionError;
  return errors;
}

export function validatePairRiskValues(
  input: PairRiskInput,
  globalRisk: GlobalRiskConfiguration
): Record<string, string> {
  const errors: Record<string, string> = input.inheritGlobal ? {} : validateRiskValues(input);

  if (
    !input.inheritGlobal &&
    Number.isFinite(input.maxRiskPerTradePct) &&
    input.maxRiskPerTradePct > globalRisk.maxRiskPerTradePct
  ) {
    errors.maxRiskPerTradePct = `Cannot exceed the global limit of ${globalRisk.maxRiskPerTradePct}%.`;
  }
  if (
    !input.inheritGlobal &&
    Number.isFinite(input.maxExposurePct) &&
    input.maxExposurePct > globalRisk.maxExposurePct
  ) {
    errors.maxExposurePct = `Cannot exceed the global limit of ${globalRisk.maxExposurePct}%.`;
  }
  if (
    !input.inheritGlobal &&
    Number.isInteger(input.maxConcurrentPositions) &&
    input.maxConcurrentPositions > globalRisk.maxConcurrentPositions
  ) {
    errors.maxConcurrentPositions = `Cannot exceed the global limit of ${globalRisk.maxConcurrentPositions} positions.`;
  }
  if (!Number.isFinite(input.stopLoss.value) || input.stopLoss.value <= 0) {
    errors.stopLoss = 'Stop-loss value must be greater than 0.';
  } else if (input.stopLoss.mode === 'percentage' && input.stopLoss.value > 100) {
    errors.stopLoss = 'Stop-loss percentage cannot exceed 100%.';
  }
  if (!Number.isFinite(input.takeProfit.value) || input.takeProfit.value <= 0) {
    errors.takeProfit = 'Take-profit value must be greater than 0.';
  } else if (input.takeProfit.mode === 'risk_reward' && input.takeProfit.value < 0.1) {
    errors.takeProfit = 'Risk / reward ratio must be at least 0.1.';
  }
  if (!Number.isFinite(input.positionSizing.value) || input.positionSizing.value <= 0) {
    errors.positionSizing = 'Position size must be greater than 0.';
  } else if (
    input.positionSizing.mode === 'risk_percent' &&
    input.positionSizing.value > globalRisk.maxRiskPerTradePct
  ) {
    errors.positionSizing = `Risk per position cannot exceed ${globalRisk.maxRiskPerTradePct}%.`;
  }
  return errors;
}

export function validatePairForm(
  input: PairFormInput,
  pairs: TradingPair[],
  editingId?: string
): Record<string, string> {
  const errors: Record<string, string> = {};
  const symbol = normalizePairSymbol(input.symbol);

  if (!symbol) {
    errors.symbol = 'Pair symbol is required.';
  } else if (!/^[A-Z][A-Z0-9]{2,19}$/.test(symbol)) {
    errors.symbol = 'Use 3–20 letters or digits, starting with a letter.';
  } else if (pairs.some((pair) => pair.id !== editingId && pair.symbol === symbol)) {
    errors.symbol =
      'This symbol already exists. Symbols are normalized to uppercase letters and digits.';
  }

  if (!input.displayName.trim()) {
    errors.displayName = 'Display name is required.';
  } else if (input.displayName.trim().length > 60) {
    errors.displayName = 'Keep the display name under 60 characters.';
  }
  if (!input.marketType) errors.marketType = 'Choose a market type.';
  if (!input.defaultTimeframe) errors.defaultTimeframe = 'Choose a default timeframe.';
  if (input.broker && input.broker.length > 60) {
    errors.broker = 'Keep the broker or data source under 60 characters.';
  }
  if (input.notes && input.notes.length > 500) {
    errors.notes = 'Keep notes under 500 characters.';
  }
  return errors;
}

export interface StrategyValidationResult {
  fieldErrors: Record<string, string>;
  parameterErrors: Record<number, string>;
  normalizedIdentifier: string;
  valid: boolean;
}

export function validateStrategyDraft(
  input: StrategyInput,
  strategies: StrategyDefinition[],
  editingId?: string
): StrategyValidationResult {
  const fieldErrors: Record<string, string> = {};
  const parameterErrors: Record<number, string> = {};
  const identifier = normalizeIdentifier(input.identifier);

  if (!input.name.trim()) fieldErrors.name = 'Strategy name is required.';
  if (!identifier) {
    fieldErrors.identifier = 'Identifier is required.';
  } else if (!/^[a-z][a-z0-9_]{2,39}$/.test(identifier)) {
    fieldErrors.identifier = 'Use 3–40 lowercase letters, numbers, or underscores.';
  } else if (
    strategies.some((strategy) => strategy.id !== editingId && strategy.identifier === identifier)
  ) {
    fieldErrors.identifier = 'This identifier is already used by another strategy.';
  }

  if (!input.description.trim()) fieldErrors.description = 'A short description is required.';
  if (!/^\d+\.\d+\.\d+$/.test(input.version.trim())) {
    fieldErrors.version = 'Use semantic versioning, for example 1.0.0.';
  }
  if (input.supportedMarkets.length === 0) {
    fieldErrors.supportedMarkets = 'Select at least one market.';
  }
  if (input.supportedTimeframes.length === 0) {
    fieldErrors.supportedTimeframes = 'Select at least one timeframe.';
  }
  if (input.parameterSchema.length === 0) {
    fieldErrors.schema = 'Add at least one configuration parameter.';
  }

  const seenKeys = new Set<string>();
  input.parameterSchema.forEach((parameter, index) => {
    const key = normalizeIdentifier(parameter.key);
    let error: string | undefined;
    if (!key) {
      error = 'Parameter key is required.';
    } else if (!/^[a-z][a-z0-9_]{1,39}$/.test(key)) {
      error = 'Use 2–40 lowercase letters, numbers, or underscores.';
    } else if (seenKeys.has(key)) {
      error = 'Parameter keys must be unique.';
    } else if (!parameter.label.trim()) {
      error = 'Parameter label is required.';
    } else if (
      parameter.type === 'select' &&
      (!parameter.options || parameter.options.length < 1)
    ) {
      error = 'Add at least one select option.';
    } else if (
      parameter.min !== undefined &&
      parameter.max !== undefined &&
      parameter.min > parameter.max
    ) {
      error = 'Minimum cannot be greater than maximum.';
    } else {
      const defaultError = validateParameterValue(parameter, parameter.defaultValue);
      if (defaultError) error = `Default value: ${defaultError}`;
    }
    seenKeys.add(key);
    if (error) parameterErrors[index] = error;
  });

  return {
    fieldErrors,
    parameterErrors,
    normalizedIdentifier: identifier,
    valid: Object.keys(fieldErrors).length === 0 && Object.keys(parameterErrors).length === 0,
  };
}

export interface PairActivity {
  signals: SignalEvent[];
}

export function sortByDateDescending<T>(items: T[], getDate: (item: T) => string): T[] {
  return [...items].sort(
    (left, right) => new Date(getDate(right)).getTime() - new Date(getDate(left)).getTime()
  );
}
