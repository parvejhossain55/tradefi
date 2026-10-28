import { readDatabase, resetDatabase, writeDatabase } from './mockDb';
import type {
  ApplicationEvent,
  AssignmentStatus,
  EventCategory,
  EventLevel,
  GlobalRiskConfiguration,
  GlobalSettings,
  PairInput,
  PairRiskConfiguration,
  PairRiskInput,
  PairStatus,
  StrategyAssignment,
  StrategyInput,
  StrategyParameters,
  TradingDatabase,
  TradingSnapshot,
} from '@/types/trading';
import {
  buildConfigurationOverrides,
  buildDefaultParameters,
  createId,
  normalizeIdentifier,
  normalizePairSymbol,
  validateConfiguration,
  validatePairForm,
  validatePairRiskValues,
  validateRiskValues,
  validateStrategyDraft,
} from '@/utils/trading';

const MUTATION_DELAY_MS = import.meta.env.MODE === 'test' ? 0 : 130;

export type GlobalRiskInput = Omit<
  GlobalRiskConfiguration,
  'updatedAt' | 'emergencyAutomationDisabled'
>;

export class TradingApiError extends Error {
  fieldErrors?: Record<string, string>;

  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'TradingApiError';
    this.fieldErrors = fieldErrors;
  }
}

function delay(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, MUTATION_DELAY_MS);
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

function toSnapshot(database: TradingDatabase): TradingSnapshot {
  return {
    pairs: database.pairs,
    strategies: database.strategies,
    assignments: database.assignments,
    pairRiskConfigurations: database.pairRiskConfigurations,
    globalRisk: database.globalRisk,
    signals: database.signals,
    executions: database.executions,
    events: database.events,
    settings: database.settings,
    heartbeatAt: database.heartbeatAt,
    seededAt: database.seededAt,
  };
}

function addEvent(
  database: TradingDatabase,
  event: {
    level: EventLevel;
    category: EventCategory;
    message: string;
    pairId?: string;
    strategyId?: string;
    actor?: ApplicationEvent['actor'];
  }
): void {
  database.events.unshift({
    id: createId('evt'),
    timestamp: nowIso(),
    level: event.level,
    category: event.category,
    message: event.message,
    pairId: event.pairId,
    strategyId: event.strategyId,
    actor: event.actor ?? 'admin',
  });
}

function getPair(database: TradingDatabase, pairId: string) {
  const pair = database.pairs.find((candidate) => candidate.id === pairId);
  if (!pair) throw new TradingApiError('Trading pair was not found.');
  return pair;
}

function getStrategy(database: TradingDatabase, strategyId: string) {
  const strategy = database.strategies.find((candidate) => candidate.id === strategyId);
  if (!strategy) throw new TradingApiError('Strategy definition was not found.');
  return strategy;
}

function getAssignment(database: TradingDatabase, pairId: string) {
  return database.assignments.find((candidate) => candidate.pairId === pairId);
}

function assertAutomationAllowed(database: TradingDatabase, pairId: string): void {
  const pair = getPair(database, pairId);
  if (pair.status === 'archived') {
    throw new TradingApiError('Archived pairs cannot run automation.');
  }
  if (pair.status === 'disabled') {
    throw new TradingApiError('Enable the pair before enabling automation.');
  }
  if (database.globalRisk.emergencyAutomationDisabled) {
    throw new TradingApiError(
      'Emergency automation halt is active. Lift the halt in Risk Management first.'
    );
  }
  const assignment = getAssignment(database, pairId);
  if (!assignment) {
    throw new TradingApiError('Assign a strategy before enabling automation.');
  }
  if (assignment.status !== 'active') {
    throw new TradingApiError('The strategy assignment is disabled.');
  }
  const strategy = getStrategy(database, assignment.strategyId);
  if (!strategy.enabled) {
    throw new TradingApiError('The assigned strategy is disabled.');
  }
}

function disableAutomationForPairs(
  database: TradingDatabase,
  predicate: (pairId: string) => boolean
): void {
  const timestamp = nowIso();
  database.pairs.forEach((pair) => {
    if (predicate(pair.id) && pair.automationEnabled) {
      pair.automationEnabled = false;
      pair.updatedAt = timestamp;
    }
  });
}

function sanitizeStrategyInput(input: StrategyInput) {
  const schema = input.parameterSchema.map((parameter) => ({
    ...parameter,
    key: normalizeIdentifier(parameter.key),
    label: parameter.label.trim(),
    description: parameter.description?.trim() || undefined,
    group: parameter.group?.trim() || undefined,
    options: parameter.options?.map((option) => option.trim()).filter(Boolean),
  }));
  return {
    ...input,
    identifier: normalizeIdentifier(input.identifier),
    name: input.name.trim(),
    description: input.description.trim(),
    version: input.version.trim(),
    parameterSchema: schema,
    defaultParameters: buildDefaultParameters(schema),
  };
}

async function mutate(
  mutation: (database: TradingDatabase) => void | Promise<void>
): Promise<TradingSnapshot> {
  await delay();
  const database = readDatabase();
  await mutation(database);
  writeDatabase(database);
  return toSnapshot(database);
}

export const tradingApi = {
  async getSnapshot(): Promise<TradingSnapshot> {
    await delay();
    return toSnapshot(readDatabase());
  },

  async resetDemoData(): Promise<TradingSnapshot> {
    await delay();
    return toSnapshot(resetDatabase());
  },

  async createPair(input: PairInput): Promise<TradingSnapshot> {
    return mutate((database) => {
      const normalizedInput = { ...input, symbol: normalizePairSymbol(input.symbol) };
      const errors = validatePairForm(normalizedInput, database.pairs);
      if (Object.keys(errors).length > 0) {
        throw new TradingApiError('Pair details are invalid.', errors);
      }

      const strategy = input.strategyId ? getStrategy(database, input.strategyId) : undefined;
      if (input.automationEnabled && !strategy) {
        throw new TradingApiError('Assign a strategy before enabling automation.', {
          automationEnabled: 'Select an initial strategy to enable automation.',
        });
      }
      if (input.automationEnabled && strategy && !strategy.enabled) {
        throw new TradingApiError('The selected strategy is disabled.', {
          automationEnabled: 'Choose an enabled strategy or leave automation off.',
        });
      }
      if (input.automationEnabled && database.globalRisk.emergencyAutomationDisabled) {
        throw new TradingApiError(
          'Emergency automation halt is active. Automation cannot be enabled.',
          { automationEnabled: 'Lift the emergency halt in Risk Management first.' }
        );
      }

      const timestamp = nowIso();
      const pairId = createId('pair');
      database.pairs.push({
        id: pairId,
        symbol: normalizedInput.symbol,
        displayName: input.displayName.trim(),
        marketType: input.marketType,
        broker: input.broker?.trim() || undefined,
        defaultTimeframe: input.defaultTimeframe,
        notes: input.notes?.trim() || undefined,
        status: 'enabled',
        automationEnabled: Boolean(input.automationEnabled && strategy?.enabled),
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      database.pairRiskConfigurations.push({
        pairId,
        inheritGlobal: true,
        maxRiskPerTradePct: database.globalRisk.maxRiskPerTradePct,
        maxExposurePct: database.globalRisk.maxExposurePct,
        maxConcurrentPositions: database.globalRisk.maxConcurrentPositions,
        stopLoss: { mode: 'swing_extreme', value: 1.5 },
        takeProfit: { mode: 'risk_reward', value: 2 },
        positionSizing: { mode: 'risk_percent', value: 0.5 },
        sessions: {
          enabled: database.globalRisk.sessions.enabled,
          sessions: [...database.globalRisk.sessions.sessions],
        },
        cooldownMinutes: database.globalRisk.cooldownMinutes,
        updatedAt: timestamp,
      });

      if (strategy) {
        database.assignments.push({
          id: createId('assign'),
          pairId,
          strategyId: strategy.id,
          strategyVersion: strategy.version,
          status: 'active',
          configuration: {},
          configurationVersion: 1,
          assignedAt: timestamp,
          updatedAt: timestamp,
        });
      }

      addEvent(database, {
        level: 'success',
        category: 'pair',
        message: `${normalizedInput.symbol} created${
          strategy ? ` with ${strategy.name} assigned at default parameters` : ' without a strategy'
        }.`,
        pairId,
        strategyId: strategy?.id,
      });
    });
  },

  async updatePair(pairId: string, input: PairInput): Promise<TradingSnapshot> {
    return mutate((database) => {
      const pair = getPair(database, pairId);
      const normalizedInput = { ...input, symbol: normalizePairSymbol(input.symbol) };
      const errors = validatePairForm(normalizedInput, database.pairs, pairId);
      if (Object.keys(errors).length > 0) {
        throw new TradingApiError('Pair details are invalid.', errors);
      }
      const enablingAutomation = Boolean(input.automationEnabled && !pair.automationEnabled);
      if (enablingAutomation) assertAutomationAllowed(database, pairId);

      const previousSymbol = pair.symbol;
      pair.symbol = normalizedInput.symbol;
      pair.displayName = input.displayName.trim();
      pair.marketType = input.marketType;
      pair.broker = input.broker?.trim() || undefined;
      pair.defaultTimeframe = input.defaultTimeframe;
      pair.notes = input.notes?.trim() || undefined;
      pair.automationEnabled = Boolean(input.automationEnabled);
      pair.updatedAt = nowIso();

      addEvent(database, {
        level: 'info',
        category: 'pair',
        message:
          previousSymbol === pair.symbol
            ? `${pair.symbol} details updated.`
            : `${previousSymbol} renamed to ${pair.symbol}; strategy configuration was preserved.`,
        pairId,
      });
    });
  },

  async setPairStatus(pairId: string, status: PairStatus): Promise<TradingSnapshot> {
    return mutate((database) => {
      const pair = getPair(database, pairId);
      if (pair.status === status) return;
      if (pair.status === 'archived' && status !== 'archived') {
        throw new TradingApiError('Archived pairs cannot be restored. Create a new pair instead.');
      }

      const timestamp = nowIso();
      pair.status = status;
      pair.updatedAt = timestamp;
      pair.automationEnabled = false;

      const assignment = getAssignment(database, pairId);
      if (status === 'archived' && assignment) {
        assignment.status = 'disabled';
        assignment.updatedAt = timestamp;
      }

      addEvent(database, {
        level: status === 'archived' ? 'warning' : status === 'disabled' ? 'warning' : 'success',
        category: 'pair',
        message:
          status === 'archived'
            ? `${pair.symbol} archived. Its assignment was disabled; historical records were retained.`
            : status === 'disabled'
              ? `${pair.symbol} disabled. Automation was switched off.`
              : `${pair.symbol} enabled. Automation remains off until manually enabled.`,
        pairId,
        strategyId: assignment?.strategyId,
      });
    });
  },

  async setPairAutomation(pairId: string, enabled: boolean): Promise<TradingSnapshot> {
    return mutate((database) => {
      const pair = getPair(database, pairId);
      if (enabled) assertAutomationAllowed(database, pairId);
      pair.automationEnabled = enabled;
      pair.updatedAt = nowIso();
      addEvent(database, {
        level: 'info',
        category: 'pair',
        message: `${pair.symbol} automation ${enabled ? 'enabled' : 'disabled'}.`,
        pairId,
        strategyId: getAssignment(database, pairId)?.strategyId,
      });
    });
  },

  async createStrategy(input: StrategyInput): Promise<TradingSnapshot> {
    return mutate((database) => {
      const validation = validateStrategyDraft(input, database.strategies);
      if (!validation.valid) {
        throw new TradingApiError('Strategy details are invalid.', validation.fieldErrors);
      }
      const sanitized = sanitizeStrategyInput(input);
      const timestamp = nowIso();
      const strategyId = createId('strat');
      database.strategies.push({
        id: strategyId,
        identifier: sanitized.identifier,
        name: sanitized.name,
        version: sanitized.version,
        description: sanitized.description,
        category: input.category,
        supportedMarkets: [...input.supportedMarkets],
        supportedTimeframes: [...input.supportedTimeframes],
        parameterSchema: sanitized.parameterSchema,
        defaultParameters: sanitized.defaultParameters,
        enabled: input.enabled,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      addEvent(database, {
        level: 'success',
        category: 'strategy',
        message: `Strategy ${sanitized.name} (v${sanitized.version}) created as a reusable definition.`,
        strategyId,
      });
    });
  },

  async updateStrategy(strategyId: string, input: StrategyInput): Promise<TradingSnapshot> {
    return mutate((database) => {
      const strategy = getStrategy(database, strategyId);
      const validation = validateStrategyDraft(input, database.strategies, strategyId);
      if (!validation.valid) {
        throw new TradingApiError('Strategy details are invalid.', validation.fieldErrors);
      }
      const sanitized = sanitizeStrategyInput(input);
      const assignmentCount = database.assignments.filter(
        (assignment) => assignment.strategyId === strategyId
      ).length;
      const wasEnabled = strategy.enabled;
      const timestamp = nowIso();

      strategy.identifier = sanitized.identifier;
      strategy.name = sanitized.name;
      strategy.version = sanitized.version;
      strategy.description = sanitized.description;
      strategy.category = input.category;
      strategy.supportedMarkets = [...input.supportedMarkets];
      strategy.supportedTimeframes = [...input.supportedTimeframes];
      strategy.parameterSchema = sanitized.parameterSchema;
      strategy.defaultParameters = sanitized.defaultParameters;
      strategy.enabled = input.enabled;
      strategy.updatedAt = timestamp;

      if (wasEnabled && !input.enabled) {
        disableAutomationForPairs(database, (pairId) =>
          database.assignments.some(
            (assignment) => assignment.pairId === pairId && assignment.strategyId === strategyId
          )
        );
      }

      addEvent(database, {
        level: input.enabled ? 'success' : 'warning',
        category: 'strategy',
        message: `Strategy ${strategy.name} updated to v${strategy.version}. ${assignmentCount} pair configuration${
          assignmentCount === 1 ? '' : 's'
        } left unchanged.`,
        strategyId,
      });
    });
  },

  async duplicateStrategy(strategyId: string): Promise<TradingSnapshot> {
    return mutate((database) => {
      const source = getStrategy(database, strategyId);
      const timestamp = nowIso();
      const baseIdentifier = `${source.identifier}_copy`;
      let identifier = baseIdentifier;
      let suffix = 2;
      while (database.strategies.some((strategy) => strategy.identifier === identifier)) {
        identifier = `${baseIdentifier}_${suffix}`;
        suffix += 1;
      }
      const duplicateId = createId('strat');
      database.strategies.push({
        ...structuredClone(source),
        id: duplicateId,
        identifier,
        name: `${source.name} (Copy)`,
        enabled: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      addEvent(database, {
        level: 'info',
        category: 'strategy',
        message: `Strategy ${source.name} duplicated as ${source.name} (Copy). The copy starts disabled.`,
        strategyId: duplicateId,
      });
    });
  },

  async setStrategyEnabled(strategyId: string, enabled: boolean): Promise<TradingSnapshot> {
    return mutate((database) => {
      const strategy = getStrategy(database, strategyId);
      if (strategy.enabled === enabled) return;
      strategy.enabled = enabled;
      strategy.updatedAt = nowIso();
      if (!enabled) {
        disableAutomationForPairs(database, (pairId) =>
          database.assignments.some(
            (assignment) => assignment.pairId === pairId && assignment.strategyId === strategyId
          )
        );
      }
      addEvent(database, {
        level: enabled ? 'success' : 'warning',
        category: 'strategy',
        message: enabled
          ? `${strategy.name} enabled. Pair automation still needs to be enabled individually.`
          : `${strategy.name} disabled. Automation was switched off for assigned pairs; configurations were preserved.`,
        strategyId,
      });
    });
  },

  async assignStrategy(
    pairId: string,
    strategyId: string,
    resetConfiguration = true
  ): Promise<TradingSnapshot> {
    return mutate((database) => {
      const pair = getPair(database, pairId);
      if (pair.status === 'archived') {
        throw new TradingApiError('Archived pairs cannot receive new strategy assignments.');
      }
      const strategy = getStrategy(database, strategyId);
      const timestamp = nowIso();
      const existingIndex = database.assignments.findIndex(
        (assignment) => assignment.pairId === pairId
      );

      if (existingIndex >= 0) {
        const existing = database.assignments[existingIndex];
        if (existing.strategyId === strategyId) return;
        const previousStrategy = database.strategies.find(
          (candidate) => candidate.id === existing.strategyId
        );
        const nextAssignment: StrategyAssignment = {
          ...existing,
          strategyId,
          strategyVersion: strategy.version,
          status: 'active',
          configuration: resetConfiguration ? {} : existing.configuration,
          configurationVersion: resetConfiguration ? 1 : existing.configurationVersion + 1,
          assignedAt: timestamp,
          updatedAt: timestamp,
        };
        database.assignments[existingIndex] = nextAssignment;
        if (!strategy.enabled) pair.automationEnabled = false;
        pair.updatedAt = timestamp;
        addEvent(database, {
          level: 'warning',
          category: 'assignment',
          message: `${pair.symbol} strategy changed from ${previousStrategy?.name ?? 'an unknown strategy'} to ${
            strategy.name
          }. Configuration was reset to defaults.`,
          pairId,
          strategyId,
        });
        return;
      }

      database.assignments.push({
        id: createId('assign'),
        pairId,
        strategyId,
        strategyVersion: strategy.version,
        status: 'active',
        configuration: {},
        configurationVersion: 1,
        assignedAt: timestamp,
        updatedAt: timestamp,
      });
      if (!strategy.enabled) pair.automationEnabled = false;
      pair.updatedAt = timestamp;
      addEvent(database, {
        level: 'success',
        category: 'assignment',
        message: `${strategy.name} assigned to ${pair.symbol} with default configuration.`,
        pairId,
        strategyId,
      });
    });
  },

  async updateAssignmentConfiguration(
    pairId: string,
    values: StrategyParameters
  ): Promise<TradingSnapshot> {
    return mutate((database) => {
      const pair = getPair(database, pairId);
      const assignment = getAssignment(database, pairId);
      if (!assignment) throw new TradingApiError('This pair has no strategy assignment.');
      const strategy = getStrategy(database, assignment.strategyId);
      const errors = validateConfiguration(strategy.parameterSchema, values);
      const firstError = Object.values(errors)[0];
      if (firstError) {
        throw new TradingApiError(firstError, errors);
      }
      const overrides = buildConfigurationOverrides(strategy.parameterSchema, values);
      const timestamp = nowIso();
      assignment.configuration = overrides;
      assignment.configurationVersion += 1;
      assignment.strategyVersion = strategy.version;
      assignment.updatedAt = timestamp;
      pair.updatedAt = timestamp;
      const count = Object.keys(overrides).length;
      addEvent(database, {
        level: 'success',
        category: 'assignment',
        message: `${pair.symbol} configuration saved as version ${assignment.configurationVersion} (${count} customized parameter${
          count === 1 ? '' : 's'
        }).`,
        pairId,
        strategyId: strategy.id,
      });
    });
  },

  async setAssignmentStatus(pairId: string, status: AssignmentStatus): Promise<TradingSnapshot> {
    return mutate((database) => {
      const pair = getPair(database, pairId);
      const assignment = getAssignment(database, pairId);
      if (!assignment) throw new TradingApiError('This pair has no strategy assignment.');
      if (status === 'active' && pair.status === 'archived') {
        throw new TradingApiError('Assignments cannot be enabled for archived pairs.');
      }
      const timestamp = nowIso();
      assignment.status = status;
      assignment.updatedAt = timestamp;
      if (status === 'disabled') {
        pair.automationEnabled = false;
      }
      pair.updatedAt = timestamp;
      addEvent(database, {
        level: status === 'active' ? 'success' : 'warning',
        category: 'assignment',
        message: `${pair.symbol} assignment ${status === 'active' ? 'enabled' : 'disabled'}.`,
        pairId,
        strategyId: assignment.strategyId,
      });
    });
  },

  async saveGlobalRisk(input: GlobalRiskInput): Promise<TradingSnapshot> {
    return mutate((database) => {
      const errors = validateRiskValues(input);
      if (Object.keys(errors).length > 0) {
        throw new TradingApiError('Global risk settings are invalid.', errors);
      }
      const exceedingOverrides = database.pairRiskConfigurations.filter(
        (configuration) =>
          !configuration.inheritGlobal &&
          (configuration.maxRiskPerTradePct > input.maxRiskPerTradePct ||
            configuration.maxExposurePct > input.maxExposurePct ||
            configuration.maxConcurrentPositions > input.maxConcurrentPositions)
      ).length;
      database.globalRisk = {
        ...input,
        sessions: {
          enabled: input.sessions.enabled,
          sessions: [...input.sessions.sessions],
        },
        emergencyAutomationDisabled: database.globalRisk.emergencyAutomationDisabled,
        updatedAt: nowIso(),
      };
      addEvent(database, {
        level: exceedingOverrides > 0 ? 'warning' : 'success',
        category: 'risk',
        message:
          exceedingOverrides > 0
            ? `Global risk defaults saved. ${exceedingOverrides} pair override${
                exceedingOverrides === 1 ? '' : 's'
              } exceed the new caps and were left unchanged.`
            : 'Global risk defaults saved.',
      });
    });
  },

  async setEmergencyAutomationDisabled(disabled: boolean): Promise<TradingSnapshot> {
    return mutate((database) => {
      if (database.globalRisk.emergencyAutomationDisabled === disabled) return;
      database.globalRisk.emergencyAutomationDisabled = disabled;
      database.globalRisk.updatedAt = nowIso();
      addEvent(database, {
        level: disabled ? 'error' : 'success',
        category: 'risk',
        message: disabled
          ? 'Emergency automation halt enabled. Effective automation is blocked for every pair in this demo workspace.'
          : 'Emergency automation halt lifted. Individual pair automation flags were not changed.',
      });
    });
  },

  async savePairRisk(pairId: string, input: PairRiskInput): Promise<TradingSnapshot> {
    return mutate((database) => {
      const pair = getPair(database, pairId);
      const errors = validatePairRiskValues(input, database.globalRisk);
      if (Object.keys(errors).length > 0) {
        throw new TradingApiError('Pair risk settings are invalid.', errors);
      }
      const timestamp = nowIso();
      const existingIndex = database.pairRiskConfigurations.findIndex(
        (configuration) => configuration.pairId === pairId
      );
      const nextConfiguration: PairRiskConfiguration = input.inheritGlobal
        ? {
            pairId,
            inheritGlobal: true,
            maxRiskPerTradePct: database.globalRisk.maxRiskPerTradePct,
            maxExposurePct: database.globalRisk.maxExposurePct,
            maxConcurrentPositions: database.globalRisk.maxConcurrentPositions,
            stopLoss: input.stopLoss,
            takeProfit: input.takeProfit,
            positionSizing: input.positionSizing,
            sessions: {
              enabled: database.globalRisk.sessions.enabled,
              sessions: [...database.globalRisk.sessions.sessions],
            },
            cooldownMinutes: database.globalRisk.cooldownMinutes,
            updatedAt: timestamp,
          }
        : {
            pairId,
            inheritGlobal: false,
            maxRiskPerTradePct: input.maxRiskPerTradePct,
            maxExposurePct: input.maxExposurePct,
            maxConcurrentPositions: input.maxConcurrentPositions,
            stopLoss: input.stopLoss,
            takeProfit: input.takeProfit,
            positionSizing: input.positionSizing,
            sessions: {
              enabled: input.sessions.enabled,
              sessions: [...input.sessions.sessions],
            },
            cooldownMinutes: input.cooldownMinutes,
            updatedAt: timestamp,
          };
      if (existingIndex >= 0) {
        database.pairRiskConfigurations[existingIndex] = nextConfiguration;
      } else {
        database.pairRiskConfigurations.push(nextConfiguration);
      }
      pair.updatedAt = timestamp;
      addEvent(database, {
        level: 'success',
        category: 'risk',
        message: `${pair.symbol} risk settings saved using ${
          input.inheritGlobal ? 'global defaults' : 'pair-level overrides'
        }.`,
        pairId,
      });
    });
  },

  async saveSettings(input: Omit<GlobalSettings, 'updatedAt'>): Promise<TradingSnapshot> {
    return mutate((database) => {
      if (input.defaultStrategyId) getStrategy(database, input.defaultStrategyId);
      database.settings = {
        ...input,
        notifications: { ...input.notifications },
        // The demo data source can never be marked as a live connection.
        dataSource: {
          ...input.dataSource,
          mode: 'mock',
          status: 'mock',
          provider: input.dataSource.provider.trim() || 'Local mock data',
        },
        updatedAt: nowIso(),
      };
      addEvent(database, {
        level: 'success',
        category: 'system',
        message: 'Global settings saved.',
      });
    });
  },
};
