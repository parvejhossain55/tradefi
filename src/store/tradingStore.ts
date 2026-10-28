import { create } from 'zustand';
import { tradingApi } from '@/services/tradingApi';
import type { GlobalRiskInput } from '@/services/tradingApi';
import type {
  AssignmentStatus,
  GlobalSettings,
  PairInput,
  PairRiskInput,
  PairStatus,
  StrategyInput,
  StrategyParameters,
  TradingSnapshot,
} from '@/types/trading';

type StoreStatus = 'idle' | 'loading' | 'ready' | 'error';

interface TradingState {
  snapshot: TradingSnapshot | null;
  status: StoreStatus;
  error: string | null;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  createPair: (input: PairInput) => Promise<TradingSnapshot>;
  updatePair: (pairId: string, input: PairInput) => Promise<TradingSnapshot>;
  setPairStatus: (pairId: string, status: PairStatus) => Promise<TradingSnapshot>;
  setPairAutomation: (pairId: string, enabled: boolean) => Promise<TradingSnapshot>;
  createStrategy: (input: StrategyInput) => Promise<TradingSnapshot>;
  updateStrategy: (strategyId: string, input: StrategyInput) => Promise<TradingSnapshot>;
  duplicateStrategy: (strategyId: string) => Promise<TradingSnapshot>;
  setStrategyEnabled: (strategyId: string, enabled: boolean) => Promise<TradingSnapshot>;
  assignStrategy: (pairId: string, strategyId: string) => Promise<TradingSnapshot>;
  updateAssignmentConfiguration: (
    pairId: string,
    values: StrategyParameters
  ) => Promise<TradingSnapshot>;
  setAssignmentStatus: (pairId: string, status: AssignmentStatus) => Promise<TradingSnapshot>;
  saveGlobalRisk: (input: GlobalRiskInput) => Promise<TradingSnapshot>;
  setEmergencyAutomationDisabled: (disabled: boolean) => Promise<TradingSnapshot>;
  savePairRisk: (pairId: string, input: PairRiskInput) => Promise<TradingSnapshot>;
  saveSettings: (input: Omit<GlobalSettings, 'updatedAt'>) => Promise<TradingSnapshot>;
  resetDemoData: () => Promise<TradingSnapshot>;
}

export const useTradingStore = create<TradingState>((set) => {
  const apply = async (operation: Promise<TradingSnapshot>) => {
    const snapshot = await operation;
    set({ snapshot, status: 'ready', error: null });
    return snapshot;
  };

  const loadWithState = async () => {
    set({ status: 'loading', error: null });
    try {
      const snapshot = await tradingApi.getSnapshot();
      set({ snapshot, status: 'ready', error: null });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unable to load the demo workspace.',
      });
    }
  };

  return {
    snapshot: null,
    status: 'idle',
    error: null,
    load: loadWithState,
    refresh: loadWithState,
    createPair: (input) => apply(tradingApi.createPair(input)),
    updatePair: (pairId, input) => apply(tradingApi.updatePair(pairId, input)),
    setPairStatus: (pairId, status) => apply(tradingApi.setPairStatus(pairId, status)),
    setPairAutomation: (pairId, enabled) => apply(tradingApi.setPairAutomation(pairId, enabled)),
    createStrategy: (input) => apply(tradingApi.createStrategy(input)),
    updateStrategy: (strategyId, input) => apply(tradingApi.updateStrategy(strategyId, input)),
    duplicateStrategy: (strategyId) => apply(tradingApi.duplicateStrategy(strategyId)),
    setStrategyEnabled: (strategyId, enabled) =>
      apply(tradingApi.setStrategyEnabled(strategyId, enabled)),
    assignStrategy: (pairId, strategyId) => apply(tradingApi.assignStrategy(pairId, strategyId)),
    updateAssignmentConfiguration: (pairId, values) =>
      apply(tradingApi.updateAssignmentConfiguration(pairId, values)),
    setAssignmentStatus: (pairId, status) => apply(tradingApi.setAssignmentStatus(pairId, status)),
    saveGlobalRisk: (input) => apply(tradingApi.saveGlobalRisk(input)),
    setEmergencyAutomationDisabled: (disabled) =>
      apply(tradingApi.setEmergencyAutomationDisabled(disabled)),
    savePairRisk: (pairId, input) => apply(tradingApi.savePairRisk(pairId, input)),
    saveSettings: (input) => apply(tradingApi.saveSettings(input)),
    resetDemoData: () => apply(tradingApi.resetDemoData()),
  };
});
