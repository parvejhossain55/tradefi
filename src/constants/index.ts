/// <reference types="vite/client" />
import type { IconName } from '@/components/ui/Icon';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const APP_NAME = 'TradeFi Ops';
export const APP_VERSION = '0.1.0 · demo';

export const ROUTES = {
  OVERVIEW: '/',
  PAIRS: '/trading-pairs',
  PAIR_DETAILS: '/trading-pairs/:pairId',
  STRATEGIES: '/strategies',
  ASSIGNMENTS: '/assignments',
  MONITOR: '/monitor',
  SIGNALS: '/signals',
  EXECUTIONS: '/executions',
  RISK: '/risk',
  SETTINGS: '/settings',
} as const;

export interface NavItem {
  label: string;
  to: string;
  icon: IconName;
  end?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'Overview', to: ROUTES.OVERVIEW, icon: 'dashboard', end: true },
      { label: 'Trading Pairs', to: ROUTES.PAIRS, icon: 'pairs' },
      { label: 'Strategy Library', to: ROUTES.STRATEGIES, icon: 'strategies' },
      { label: 'Strategy Assignments', to: ROUTES.ASSIGNMENTS, icon: 'assignments' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Live Monitor', to: ROUTES.MONITOR, icon: 'monitor' },
      { label: 'Signals & Events', to: ROUTES.SIGNALS, icon: 'signals' },
      { label: 'Execution History', to: ROUTES.EXECUTIONS, icon: 'executions' },
    ],
  },
  {
    label: 'Control',
    items: [
      { label: 'Risk Management', to: ROUTES.RISK, icon: 'risk' },
      { label: 'Global Settings', to: ROUTES.SETTINGS, icon: 'settings' },
    ],
  },
];

export interface PageMeta {
  title: string;
  parent?: { label: string; to: string };
}

export const PAGE_META: Record<string, PageMeta> = {
  [ROUTES.OVERVIEW]: { title: 'Overview' },
  [ROUTES.PAIRS]: { title: 'Trading Pairs' },
  [ROUTES.STRATEGIES]: { title: 'Strategy Library' },
  [ROUTES.ASSIGNMENTS]: { title: 'Strategy Assignments' },
  [ROUTES.MONITOR]: { title: 'Live Monitor' },
  [ROUTES.SIGNALS]: { title: 'Signals & Events' },
  [ROUTES.EXECUTIONS]: { title: 'Execution History' },
  [ROUTES.RISK]: { title: 'Risk Management' },
  [ROUTES.SETTINGS]: { title: 'Global Settings' },
};

export function getPageMeta(pathname: string): PageMeta {
  if (pathname.startsWith('/trading-pairs/')) {
    return {
      title: 'Pair Details',
      parent: { label: 'Trading Pairs', to: ROUTES.PAIRS },
    };
  }
  return PAGE_META[pathname] ?? { title: 'Page not found' };
}
