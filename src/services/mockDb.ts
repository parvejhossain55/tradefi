import { createSeedDatabase } from '@/data/seed';
import type { TradingDatabase } from '@/types/trading';

export const MOCK_DB_KEY = 'tradefi.admin.db.v1';
const SCHEMA_VERSION = 1;

function isTradingDatabase(value: unknown): value is TradingDatabase {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TradingDatabase>;
  return (
    candidate.version === SCHEMA_VERSION &&
    Array.isArray(candidate.pairs) &&
    Array.isArray(candidate.strategies) &&
    Array.isArray(candidate.assignments) &&
    Array.isArray(candidate.pairRiskConfigurations) &&
    Array.isArray(candidate.signals) &&
    Array.isArray(candidate.executions) &&
    Array.isArray(candidate.events) &&
    typeof candidate.settings === 'object' &&
    typeof candidate.globalRisk === 'object'
  );
}

export function readDatabase(): TradingDatabase {
  const fallback = createSeedDatabase();
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(MOCK_DB_KEY);
    if (!raw) {
      writeDatabase(fallback);
      return fallback;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isTradingDatabase(parsed)) {
      writeDatabase(fallback);
      return fallback;
    }
    return parsed;
  } catch {
    writeDatabase(fallback);
    return fallback;
  }
}

export function writeDatabase(database: TradingDatabase): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MOCK_DB_KEY, JSON.stringify(database));
  } catch {
    // Storage can be unavailable (private mode / quota). The in-memory store
    // still works for the current session, so the dashboard remains usable.
  }
}

export function resetDatabase(): TradingDatabase {
  const fresh = createSeedDatabase();
  writeDatabase(fresh);
  return fresh;
}
