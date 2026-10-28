export const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const MARKET_TYPES = ['Forex', 'Metals', 'Indices', 'Crypto'] as const;
export type MarketType = (typeof MARKET_TYPES)[number];

export const STRATEGY_CATEGORIES = [
  'Liquidity',
  'Price Action',
  'Momentum',
  'Mean Reversion',
  'Breakout',
] as const;
export type StrategyCategory = (typeof STRATEGY_CATEGORIES)[number];

export const SESSIONS = ['Asian', 'London', 'New York', 'Sydney'] as const;
export type SessionName = (typeof SESSIONS)[number];

export type PairStatus = 'enabled' | 'disabled' | 'archived';
export type AssignmentStatus = 'active' | 'disabled';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

export type ConfigValue = string | number | boolean;
export type StrategyParameters = Record<string, ConfigValue>;

export type ParameterType =
  'integer' | 'decimal' | 'boolean' | 'select' | 'text' | 'timeframe' | 'percentage' | 'duration';

export interface StrategyParameterDefinition {
  key: string;
  label: string;
  description?: string;
  type: ParameterType;
  required: boolean;
  defaultValue: ConfigValue;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  group?: string;
  unit?: string;
  maxLength?: number;
}

export interface StrategyDefinition {
  id: string;
  identifier: string;
  name: string;
  version: string;
  description: string;
  category: StrategyCategory;
  supportedMarkets: MarketType[];
  supportedTimeframes: Timeframe[];
  parameterSchema: StrategyParameterDefinition[];
  defaultParameters: StrategyParameters;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TradingPair {
  id: string;
  symbol: string;
  displayName: string;
  marketType: MarketType;
  broker?: string;
  defaultTimeframe: Timeframe;
  notes?: string;
  status: PairStatus;
  automationEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * `configuration` stores explicit pair-level overrides only. Values that are
 * absent inherit the strategy definition's defaults, so editing a strategy
 * default never rewrites an individual pair override.
 */
export interface StrategyAssignment {
  id: string;
  pairId: string;
  strategyId: string;
  strategyVersion: string;
  status: AssignmentStatus;
  configuration: StrategyParameters;
  configurationVersion: number;
  assignedAt: string;
  updatedAt: string;
}

export interface SessionRestriction {
  enabled: boolean;
  sessions: SessionName[];
}

export const STOP_LOSS_MODES = [
  'swing_extreme',
  'atr_multiple',
  'fixed_points',
  'percentage',
] as const;
export type StopLossMode = (typeof STOP_LOSS_MODES)[number];

export const TAKE_PROFIT_MODES = ['risk_reward', 'fixed_points', 'percentage'] as const;
export type TakeProfitMode = (typeof TAKE_PROFIT_MODES)[number];

export const POSITION_SIZING_MODES = ['risk_percent', 'fixed_lot'] as const;
export type PositionSizingMode = (typeof POSITION_SIZING_MODES)[number];

export interface StopLossConfiguration {
  mode: StopLossMode;
  value: number;
}

export interface TakeProfitConfiguration {
  mode: TakeProfitMode;
  value: number;
}

export interface PositionSizingConfiguration {
  mode: PositionSizingMode;
  value: number;
}

export interface GlobalRiskConfiguration {
  maxRiskPerTradePct: number;
  maxExposurePct: number;
  maxConcurrentPositions: number;
  sessions: SessionRestriction;
  cooldownMinutes: number;
  emergencyAutomationDisabled: boolean;
  updatedAt: string;
}

export interface PairRiskConfiguration {
  pairId: string;
  inheritGlobal: boolean;
  maxRiskPerTradePct: number;
  maxExposurePct: number;
  maxConcurrentPositions: number;
  stopLoss: StopLossConfiguration;
  takeProfit: TakeProfitConfiguration;
  positionSizing: PositionSizingConfiguration;
  sessions: SessionRestriction;
  cooldownMinutes: number;
  updatedAt: string;
}

export type SignalType = 'buy' | 'sell' | 'exit' | 'info';
export type SignalStatus = 'simulated' | 'filtered' | 'expired';

export interface SignalEvent {
  id: string;
  timestamp: string;
  pairId: string;
  strategyId: string;
  type: SignalType;
  timeframe: Timeframe;
  status: SignalStatus;
  detail: string;
}

export type ExecutionStatus = 'success' | 'failed' | 'skipped';
export type ExecutionEventType =
  'signal_processed' | 'risk_check' | 'order_simulated' | 'position_closed' | 'heartbeat';

export interface ExecutionRecord {
  id: string;
  timestamp: string;
  pairId: string;
  strategyId: string;
  mode: 'simulation';
  eventType: ExecutionEventType;
  status: ExecutionStatus;
  latencyMs?: number;
  error?: string;
}

export type EventLevel = 'info' | 'success' | 'warning' | 'error';
export type EventCategory = 'system' | 'pair' | 'strategy' | 'assignment' | 'risk' | 'monitor';

export interface ApplicationEvent {
  id: string;
  timestamp: string;
  level: EventLevel;
  category: EventCategory;
  message: string;
  pairId?: string;
  strategyId?: string;
  actor: 'admin' | 'system';
}

export interface NotificationPreferences {
  signalAlerts: boolean;
  executionAlerts: boolean;
  riskAlerts: boolean;
  dailyDigest: boolean;
}

export type DataSourceStatus = 'mock' | 'disconnected';

export interface DataSourceSettings {
  provider: string;
  mode: 'mock';
  status: DataSourceStatus;
  note: string;
}

export interface GlobalSettings {
  appName: string;
  timezone: string;
  defaultMarket: MarketType;
  defaultTimeframe: Timeframe;
  defaultStrategyId: string | null;
  notifications: NotificationPreferences;
  dataSource: DataSourceSettings;
  updatedAt: string;
}

export interface TradingSnapshot {
  pairs: TradingPair[];
  strategies: StrategyDefinition[];
  assignments: StrategyAssignment[];
  pairRiskConfigurations: PairRiskConfiguration[];
  globalRisk: GlobalRiskConfiguration;
  signals: SignalEvent[];
  executions: ExecutionRecord[];
  events: ApplicationEvent[];
  settings: GlobalSettings;
  heartbeatAt: string;
  seededAt: string;
}

export interface TradingDatabase extends TradingSnapshot {
  version: number;
}

export interface PairInput {
  symbol: string;
  displayName: string;
  marketType: MarketType;
  broker?: string;
  defaultTimeframe: Timeframe;
  automationEnabled: boolean;
  notes?: string;
  strategyId?: string | null;
}

export interface StrategyInput {
  identifier: string;
  name: string;
  description: string;
  category: StrategyCategory;
  supportedMarkets: MarketType[];
  supportedTimeframes: Timeframe[];
  version: string;
  parameterSchema: StrategyParameterDefinition[];
  defaultParameters: StrategyParameters;
  enabled: boolean;
}

export interface PairRiskInput {
  inheritGlobal: boolean;
  maxRiskPerTradePct: number;
  maxExposurePct: number;
  maxConcurrentPositions: number;
  stopLoss: StopLossConfiguration;
  takeProfit: TakeProfitConfiguration;
  positionSizing: PositionSizingConfiguration;
  sessions: SessionRestriction;
  cooldownMinutes: number;
}

export const PAIR_STATUS_LABELS: Record<PairStatus, string> = {
  enabled: 'Enabled',
  disabled: 'Disabled',
  archived: 'Archived',
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  active: 'Active',
  disabled: 'Disabled',
};

export const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  buy: 'Buy',
  sell: 'Sell',
  exit: 'Exit',
  info: 'Info',
};

export const SIGNAL_STATUS_LABELS: Record<SignalStatus, string> = {
  simulated: 'Simulated',
  filtered: 'Filtered',
  expired: 'Expired',
};

export const EXECUTION_STATUS_LABELS: Record<ExecutionStatus, string> = {
  success: 'Success',
  failed: 'Failed',
  skipped: 'Skipped',
};

export const EXECUTION_EVENT_LABELS: Record<ExecutionEventType, string> = {
  signal_processed: 'Signal processed',
  risk_check: 'Risk check',
  order_simulated: 'Order simulated',
  position_closed: 'Position closed (simulated)',
  heartbeat: 'Heartbeat',
};

export const STOP_LOSS_MODE_LABELS: Record<StopLossMode, string> = {
  swing_extreme: 'Swing extreme',
  atr_multiple: 'ATR multiple',
  fixed_points: 'Fixed points',
  percentage: 'Percentage',
};

export const TAKE_PROFIT_MODE_LABELS: Record<TakeProfitMode, string> = {
  risk_reward: 'Risk / reward ratio',
  fixed_points: 'Fixed points',
  percentage: 'Percentage',
};

export const POSITION_SIZING_MODE_LABELS: Record<PositionSizingMode, string> = {
  risk_percent: 'Risk % of equity',
  fixed_lot: 'Fixed lot size',
};

export const PARAMETER_TYPE_LABELS: Record<ParameterType, string> = {
  integer: 'Integer',
  decimal: 'Decimal',
  boolean: 'Boolean',
  select: 'Select',
  text: 'Text',
  timeframe: 'Timeframe',
  percentage: 'Percentage',
  duration: 'Duration (minutes)',
};
