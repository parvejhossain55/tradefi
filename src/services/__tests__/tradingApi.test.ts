import { beforeEach, describe, expect, it } from 'vitest';
import { tradingApi } from '@/services/tradingApi';
import type { StrategyInput } from '@/types/trading';
import { buildDefaultParameters, getEffectiveRisk, resolveConfiguration } from '@/utils/trading';

describe('tradingApi demo repository', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('seeds a demo workspace with assignments and simulated history', async () => {
    const snapshot = await tradingApi.getSnapshot();
    expect(snapshot.pairs.length).toBeGreaterThan(0);
    expect(snapshot.strategies.length).toBeGreaterThan(0);
    expect(snapshot.signals.length).toBeGreaterThan(0);
    expect(snapshot.executions.every((execution) => execution.mode === 'simulation')).toBe(true);
    expect(window.localStorage.length).toBeGreaterThan(0);
  });

  it('creates a pair with strategy defaults and rejects normalized duplicates', async () => {
    const created = await tradingApi.createPair({
      symbol: 'nzd/cad',
      displayName: 'New Zealand Dollar / Canadian Dollar',
      marketType: 'Forex',
      defaultTimeframe: 'M15',
      strategyId: 'strat_liquidity_sweep',
      automationEnabled: false,
    });
    const pair = created.pairs.find((candidate) => candidate.symbol === 'NZDCAD');
    expect(pair).toBeDefined();
    const assignment = created.assignments.find((candidate) => candidate.pairId === pair?.id);
    expect(assignment?.configuration).toEqual({});
    expect(assignment?.configurationVersion).toBe(1);
    expect(assignment?.strategyVersion).toBe('2.1.0');

    await expect(
      tradingApi.createPair({
        symbol: 'nzd cad',
        displayName: 'Duplicate',
        marketType: 'Forex',
        defaultTimeframe: 'M15',
        automationEnabled: false,
      })
    ).rejects.toThrow();
  });

  it('keeps configuration independent between pairs sharing a strategy', async () => {
    const before = await tradingApi.getSnapshot();
    const strategy = before.strategies.find(
      (candidate) => candidate.id === 'strat_liquidity_sweep'
    );
    const eurusdAssignment = before.assignments.find(
      (assignment) => assignment.pairId === 'pair_eurusd'
    );
    const xauusdAssignment = before.assignments.find(
      (assignment) => assignment.pairId === 'pair_xauusd'
    );
    expect(strategy).toBeDefined();
    expect(eurusdAssignment).toBeDefined();
    expect(xauusdAssignment).toBeDefined();
    if (!strategy || !eurusdAssignment || !xauusdAssignment) return;

    const eurusdValues = resolveConfiguration(
      strategy.parameterSchema,
      eurusdAssignment.configuration
    );
    const saved = await tradingApi.updateAssignmentConfiguration('pair_eurusd', {
      ...eurusdValues,
      swing_left_bars: 55,
    });
    const savedEurusd = saved.assignments.find((assignment) => assignment.pairId === 'pair_eurusd');
    const untouchedXauusd = saved.assignments.find(
      (assignment) => assignment.pairId === 'pair_xauusd'
    );
    expect(savedEurusd?.configuration.swing_left_bars).toBe(55);
    expect(savedEurusd?.configurationVersion).toBe(eurusdAssignment.configurationVersion + 1);
    expect(untouchedXauusd?.configuration).toEqual(xauusdAssignment.configuration);

    const updatedSchema = strategy.parameterSchema.map((parameter) =>
      parameter.key === 'swing_left_bars' ? { ...parameter, defaultValue: 25 } : parameter
    );
    const strategyInput: StrategyInput = {
      identifier: strategy.identifier,
      name: strategy.name,
      version: strategy.version,
      description: strategy.description,
      category: strategy.category,
      supportedMarkets: strategy.supportedMarkets,
      supportedTimeframes: strategy.supportedTimeframes,
      enabled: strategy.enabled,
      parameterSchema: updatedSchema,
      defaultParameters: buildDefaultParameters(updatedSchema),
    };
    const afterStrategyEdit = await tradingApi.updateStrategy(strategy.id, strategyInput);
    const preservedEurusd = afterStrategyEdit.assignments.find(
      (assignment) => assignment.pairId === 'pair_eurusd'
    );
    const preservedXauusd = afterStrategyEdit.assignments.find(
      (assignment) => assignment.pairId === 'pair_xauusd'
    );
    expect(preservedEurusd?.configuration.swing_left_bars).toBe(55);
    expect(preservedXauusd?.configuration).toEqual(xauusdAssignment.configuration);
    expect(
      afterStrategyEdit.strategies.find((candidate) => candidate.id === strategy.id)
        ?.defaultParameters.swing_left_bars
    ).toBe(25);
  });

  it('validates pair configuration against the strategy schema', async () => {
    const snapshot = await tradingApi.getSnapshot();
    const strategy = snapshot.strategies.find(
      (candidate) => candidate.id === 'strat_liquidity_sweep'
    );
    const assignment = snapshot.assignments.find((candidate) => candidate.pairId === 'pair_eurusd');
    if (!strategy || !assignment) throw new Error('Seed data missing');
    const values = resolveConfiguration(strategy.parameterSchema, assignment.configuration);
    await expect(
      tradingApi.updateAssignmentConfiguration('pair_eurusd', {
        ...values,
        swing_left_bars: 9999,
      })
    ).rejects.toThrow();
  });

  it('resets configuration when a strategy is reassigned', async () => {
    const snapshot = await tradingApi.assignStrategy('pair_xauusd', 'strat_momentum_breakout');
    const assignment = snapshot.assignments.find((candidate) => candidate.pairId === 'pair_xauusd');
    expect(assignment?.strategyId).toBe('strat_momentum_breakout');
    expect(assignment?.configuration).toEqual({});
    expect(assignment?.configurationVersion).toBe(1);
    expect(assignment?.strategyVersion).toBe('1.0.3');
  });

  it('archives a pair, disables its assignment, and retains history', async () => {
    const before = await tradingApi.getSnapshot();
    const signalCount = before.signals.length;
    const executionCount = before.executions.length;
    const archived = await tradingApi.setPairStatus('pair_eurusd', 'archived');
    const pair = archived.pairs.find((candidate) => candidate.id === 'pair_eurusd');
    const assignment = archived.assignments.find((candidate) => candidate.pairId === 'pair_eurusd');
    expect(pair?.status).toBe('archived');
    expect(pair?.automationEnabled).toBe(false);
    expect(assignment?.status).toBe('disabled');
    expect(archived.signals.length).toBe(signalCount);
    expect(archived.executions.length).toBe(executionCount);
  });

  it('does not overwrite pair risk overrides when global caps change', async () => {
    const before = await tradingApi.getSnapshot();
    expect(
      before.pairRiskConfigurations.find((risk) => risk.pairId === 'pair_eurusd')
    ).toBeDefined();
    const updated = await tradingApi.saveGlobalRisk({
      maxRiskPerTradePct: 0.45,
      maxExposurePct: 2,
      maxConcurrentPositions: 3,
      sessions: { enabled: true, sessions: ['London'] },
      cooldownMinutes: 20,
    });
    const pairOverride = updated.pairRiskConfigurations.find(
      (risk) => risk.pairId === 'pair_eurusd'
    );
    expect(updated.globalRisk.maxRiskPerTradePct).toBe(0.45);
    expect(pairOverride?.maxRiskPerTradePct).toBe(0.75);
    expect(pairOverride?.inheritGlobal).toBe(false);
    const effective = getEffectiveRisk(pairOverride!, updated.globalRisk);
    expect(effective.source).toBe('Pair override');
    expect(effective.maxRiskPerTradePct).toBe(0.75);
  });
});
