import { describe, expect, it } from 'vitest';
import { createSeedDatabase } from '@/data/seed';
import type {
  GlobalRiskConfiguration,
  StrategyAssignment,
  StrategyDefinition,
  StrategyParameterDefinition,
  TradingPair,
} from '@/types/trading';
import {
  buildConfigurationOverrides,
  configurationValuesEqual,
  getAutomationStatus,
  normalizeIdentifier,
  normalizePairSymbol,
  validateConfiguration,
  validatePairForm,
  validateParameterValue,
} from '@/utils/trading';

const integerParameter: StrategyParameterDefinition = {
  key: 'swing_left_bars',
  label: 'Swing left bars',
  type: 'integer',
  required: true,
  defaultValue: 20,
  min: 2,
  max: 200,
};

const pairInput = {
  symbol: 'eurusd',
  displayName: 'Euro / US Dollar',
  marketType: 'Forex' as const,
  defaultTimeframe: 'M15' as const,
  automationEnabled: false,
};

describe('pair symbol normalization', () => {
  it('uppercases and strips separators', () => {
    expect(normalizePairSymbol(' eur/usd ')).toBe('EURUSD');
    expect(normalizePairSymbol('xau-usd')).toBe('XAUUSD');
  });

  it('normalizes strategy identifiers to snake_case', () => {
    expect(normalizeIdentifier('  Liquidity Sweep V2 ')).toBe('liquidity_sweep_v2');
  });

  it('rejects duplicate pair symbols regardless of input formatting', () => {
    const { pairs } = createSeedDatabase();
    const errors = validatePairForm({ ...pairInput, symbol: 'eur/usd' }, pairs);
    expect(errors.symbol).toContain('already exists');
  });

  it('allows the edited pair to keep its own symbol', () => {
    const { pairs } = createSeedDatabase();
    const eurusd = pairs.find((pair) => pair.symbol === 'EURUSD');
    expect(eurusd).toBeDefined();
    const errors = validatePairForm(pairInput, pairs, eurusd?.id);
    expect(errors.symbol).toBeUndefined();
  });
});

describe('configuration schemas', () => {
  it('stores only values that differ from defaults', () => {
    const overrides = buildConfigurationOverrides([integerParameter], {
      swing_left_bars: 35,
    });
    expect(overrides).toEqual({ swing_left_bars: 35 });
  });

  it('omits values equal to the default', () => {
    const overrides = buildConfigurationOverrides([integerParameter], {
      swing_left_bars: 20,
    });
    expect(overrides).toEqual({});
  });

  it('compares configuration values without JSON key-order sensitivity', () => {
    expect(configurationValuesEqual({ a: 1, b: 'M15' }, { b: 'M15', a: 1 })).toBe(true);
    expect(configurationValuesEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('validates min, max, integer, percentage, and select rules', () => {
    expect(validateParameterValue(integerParameter, 1)).toContain('at least');
    expect(validateParameterValue(integerParameter, 201)).toContain('at most');
    expect(validateParameterValue(integerParameter, 2.5)).toContain('whole number');
    expect(validateParameterValue(integerParameter, 10)).toBeNull();
    expect(
      validateParameterValue(
        {
          key: 'risk',
          label: 'Risk',
          type: 'percentage',
          required: true,
          defaultValue: 1,
        },
        120
      )
    ).toContain('between 0 and 100');
    expect(
      validateParameterValue(
        {
          key: 'mode',
          label: 'Mode',
          type: 'select',
          required: true,
          defaultValue: 'A',
          options: ['A', 'B'],
        },
        'C'
      )
    ).toContain('available options');
  });

  it('reports required fields before saving review', () => {
    const errors = validateConfiguration([integerParameter], {});
    expect(errors.swing_left_bars).toBe('This field is required.');
  });
});

describe('automation status', () => {
  const { pairs, strategies, assignments, globalRisk } = createSeedDatabase();
  const pair = pairs.find((candidate) => candidate.id === 'pair_eurusd') as TradingPair;
  const assignment = assignments.find(
    (candidate) => candidate.pairId === pair.id
  ) as StrategyAssignment;
  const strategy = strategies.find(
    (candidate) => candidate.id === assignment.strategyId
  ) as StrategyDefinition;

  it('marks a configured pair as active', () => {
    const status = getAutomationStatus(pair, assignment, strategy, globalRisk);
    expect(status.label).toBe('Active');
    expect(status.tone).toBe('success');
  });

  it('gives a global emergency halt priority over pair flags', () => {
    const halted: GlobalRiskConfiguration = {
      ...globalRisk,
      emergencyAutomationDisabled: true,
    };
    const status = getAutomationStatus(pair, assignment, strategy, halted);
    expect(status.label).toBe('Halted globally');
    expect(status.tone).toBe('danger');
  });

  it('reports a disabled strategy without changing the assignment', () => {
    const status = getAutomationStatus(
      pair,
      assignment,
      { ...strategy, enabled: false },
      globalRisk
    );
    expect(status.label).toBe('Strategy disabled');
    expect(assignment.configuration.swing_left_bars).toBe(30);
  });
});
