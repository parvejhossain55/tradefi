import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/AdminLayout';
import {
  Assignments,
  ExecutionHistory,
  GlobalSettings,
  LiveMonitor,
  NotFound,
  Overview,
  PairDetails,
  RiskManagement,
  Signals,
  StrategyLibrary,
  TradingPairs,
} from '@/pages';

export const dashboardRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Overview /> },
      { path: 'trading-pairs', element: <TradingPairs /> },
      { path: 'trading-pairs/:pairId', element: <PairDetails /> },
      { path: 'strategies', element: <StrategyLibrary /> },
      { path: 'assignments', element: <Assignments /> },
      { path: 'monitor', element: <LiveMonitor /> },
      { path: 'signals', element: <Signals /> },
      { path: 'executions', element: <ExecutionHistory /> },
      { path: 'risk', element: <RiskManagement /> },
      { path: 'settings', element: <GlobalSettings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(dashboardRoutes);
