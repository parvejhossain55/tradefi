import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { APP_NAME, getPageMeta } from '@/constants';
import { useTradingStore } from '@/store/tradingStore';
import { ErrorState, LoadingState } from '@/components/ui/Feedback';
import { Toaster } from '@/components/ui/Toaster';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function AdminLayout() {
  const location = useLocation();
  const status = useTradingStore((state) => state.status);
  const snapshot = useTradingStore((state) => state.snapshot);
  const error = useTradingStore((state) => state.error);
  const load = useTradingStore((state) => state.load);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === 'idle') {
      void load();
    }
  }, [load, status]);

  useEffect(() => {
    setSidebarOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    const appName = snapshot?.settings.appName ?? APP_NAME;
    document.title = `${getPageMeta(location.pathname).title} · ${appName}`;
  }, [location.pathname, snapshot?.settings.appName]);

  if (!snapshot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary-50 dark:bg-secondary-950">
        {status === 'error' ? (
          <ErrorState
            description={error ?? 'The demo workspace could not be loaded.'}
            onRetry={() => void load()}
          />
        ) : (
          <LoadingState />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary-50 text-secondary-900 dark:bg-secondary-950 dark:text-secondary-100">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-72">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  );
}
