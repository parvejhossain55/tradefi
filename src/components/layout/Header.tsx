import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getPageMeta, ROUTES } from '@/constants';
import { useTheme } from '@/contexts/ThemeContext';
import { useClickOutside } from '@/hooks/useClickOutside';
import { notify } from '@/store/toastStore';
import { useTradingStore } from '@/store/tradingStore';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/Button';
import { formatRelativeTime } from '@/utils/trading';
import { cn } from '@/utils/cn';
import { GlobalSearch } from './GlobalSearch';

interface HeaderProps {
  onOpenSidebar: () => void;
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const snapshot = useTradingStore((state) => state.snapshot);
  const meta = getPageMeta(location.pathname);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsReadAt, setNotificationsReadAt] = useState<string | null>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useClickOutside(notificationsRef, () => setNotificationsOpen(false), notificationsOpen);
  useClickOutside(profileRef, () => setProfileOpen(false), profileOpen);

  useEffect(() => {
    if (!notificationsOpen && !profileOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [notificationsOpen, profileOpen]);

  const alerts = useMemo(
    () =>
      (snapshot?.events ?? [])
        .filter((event) => event.level === 'warning' || event.level === 'error')
        .slice(0, 7),
    [snapshot]
  );

  const unreadCount = alerts.filter(
    (event) => !notificationsReadAt || event.timestamp > notificationsReadAt
  ).length;

  const closeAll = () => {
    setNotificationsOpen(false);
    setProfileOpen(false);
  };

  const handleProfileAction = (action: () => void) => {
    closeAll();
    action();
  };

  return (
    <header className="sticky top-0 z-30 border-b border-secondary-200 bg-white/95 backdrop-blur dark:border-secondary-800 dark:bg-secondary-900/95">
      <div className="flex h-14 items-center gap-2 px-4 sm:px-6 lg:px-8">
        <div className="lg:hidden">
          <IconButton icon="menu" label="Open navigation" onClick={onOpenSidebar} />
        </div>

        <div className="min-w-0 flex-1">
          <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-[10px] sm:flex">
            <Link
              to={ROUTES.OVERVIEW}
              className="font-medium text-secondary-500 transition-colors hover:text-primary-600 dark:text-secondary-400 dark:hover:text-primary-400"
            >
              Workspace
            </Link>
            <Icon
              name="chevronRight"
              size={10}
              className="text-secondary-300 dark:text-secondary-600"
            />
            {meta.parent ? (
              <>
                <Link
                  to={meta.parent.to}
                  className="font-medium text-secondary-500 transition-colors hover:text-primary-600 dark:text-secondary-400 dark:hover:text-primary-400"
                >
                  {meta.parent.label}
                </Link>
                <Icon
                  name="chevronRight"
                  size={10}
                  className="text-secondary-300 dark:text-secondary-600"
                />
              </>
            ) : null}
            <span
              aria-current="page"
              className="truncate font-medium text-secondary-400 dark:text-secondary-500"
            >
              {meta.title}
            </span>
          </nav>
          <h1 className="truncate text-sm font-semibold tracking-tight text-secondary-900 dark:text-white">
            {meta.title}
          </h1>
        </div>

        <div className="hidden w-64 lg:block xl:w-80">
          <GlobalSearch />
        </div>

        <Link
          to={ROUTES.SETTINGS}
          title={
            snapshot?.settings.dataSource.note ??
            'Demo mode: no broker, feed, or backend is connected.'
          }
          className="hidden items-center gap-1.5 rounded-full border border-warning-200 bg-warning-50 px-2.5 py-1 text-[11px] font-medium text-warning-700 transition-colors hover:bg-warning-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-500 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-300 dark:hover:bg-warning-500/20 sm:inline-flex"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-warning-500" />
          </span>
          Demo mode
        </Link>

        <IconButton
          icon={isDark ? 'sun' : 'moon'}
          label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-pressed={isDark}
          onClick={toggleTheme}
        />

        <div ref={notificationsRef} className="relative">
          <button
            type="button"
            aria-label="Notifications"
            aria-haspopup="menu"
            aria-expanded={notificationsOpen}
            onClick={() => {
              setNotificationsOpen((current) => !current);
              setProfileOpen(false);
            }}
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-secondary-500 transition-colors hover:bg-secondary-100 hover:text-secondary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-secondary-400 dark:hover:bg-secondary-800 dark:hover:text-secondary-100"
          >
            <Icon name="bell" size={17} />
            {unreadCount > 0 ? (
              <span className="absolute right-0.5 top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-danger-500 px-1 text-[9px] font-semibold leading-none text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : null}
          </button>
          {notificationsOpen ? (
            <div
              role="menu"
              aria-label="Notifications"
              className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-secondary-200 bg-white shadow-medium dark:border-secondary-700 dark:bg-secondary-900"
            >
              <div className="flex items-center justify-between border-b border-secondary-200 px-3.5 py-2.5 dark:border-secondary-800">
                <div>
                  <p className="text-xs font-semibold text-secondary-900 dark:text-white">
                    Notifications
                  </p>
                  <p className="text-[10px] text-secondary-500 dark:text-secondary-400">
                    Warnings and errors from the demo workspace
                  </p>
                </div>
                <span className="rounded-full bg-secondary-100 px-1.5 py-0.5 text-[10px] tabular-nums text-secondary-600 dark:bg-secondary-800 dark:text-secondary-300">
                  {unreadCount} unread
                </span>
              </div>
              {alerts.length === 0 ? (
                <div className="px-4 py-7 text-center">
                  <Icon name="checkCircle" size={20} className="mx-auto text-success-500" />
                  <p className="mt-1.5 text-xs font-medium text-secondary-700 dark:text-secondary-300">
                    No warnings or errors
                  </p>
                </div>
              ) : (
                <ul className="max-h-80 overflow-y-auto">
                  {alerts.map((event) => (
                    <li
                      key={event.id}
                      className="border-b border-secondary-100 last:border-0 dark:border-secondary-800"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() =>
                          handleProfileAction(() => {
                            navigate(ROUTES.MONITOR);
                          })
                        }
                        className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-secondary-50 dark:hover:bg-secondary-800/60"
                      >
                        <span
                          className={cn(
                            'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                            event.level === 'error' ? 'bg-danger-500' : 'bg-warning-500'
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 block text-[11px] leading-4 text-secondary-700 dark:text-secondary-300">
                            {event.message}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-secondary-400 dark:text-secondary-500">
                            {event.category} · {formatRelativeTime(event.timestamp)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center justify-between border-t border-secondary-200 px-3.5 py-2 dark:border-secondary-800">
                <button
                  type="button"
                  disabled={unreadCount === 0}
                  onClick={() => setNotificationsReadAt(new Date().toISOString())}
                  className="text-[10px] font-medium text-secondary-500 transition-colors hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-secondary-400 dark:hover:text-primary-400"
                >
                  Mark all as read
                </button>
                <Link
                  to={ROUTES.MONITOR}
                  onClick={closeAll}
                  className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary-600 hover:underline dark:text-primary-400"
                >
                  Open monitor
                  <Icon name="chevronRight" size={11} />
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mx-1 hidden h-6 w-px bg-secondary-200 dark:bg-secondary-700 sm:block" />

        <div ref={profileRef} className="relative">
          <button
            type="button"
            aria-label="Admin profile menu"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            onClick={() => {
              setProfileOpen((current) => !current);
              setNotificationsOpen(false);
            }}
            className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-secondary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-secondary-800"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-semibold text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
              AD
            </span>
            <span className="hidden text-left xl:block">
              <span className="block text-[11px] font-semibold leading-4 text-secondary-800 dark:text-secondary-100">
                Admin Operator
              </span>
              <span className="block text-[10px] leading-3 text-secondary-500 dark:text-secondary-400">
                Demo workspace
              </span>
            </span>
            <Icon name="chevronDown" size={12} className="hidden text-secondary-400 sm:block" />
          </button>
          {profileOpen ? (
            <div
              role="menu"
              aria-label="Admin profile"
              className="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-lg border border-secondary-200 bg-white shadow-medium dark:border-secondary-700 dark:bg-secondary-900"
            >
              <div className="border-b border-secondary-200 px-3.5 py-2.5 dark:border-secondary-800">
                <p className="text-xs font-semibold text-secondary-900 dark:text-white">
                  Admin Operator
                </p>
                <p className="mt-0.5 text-[10px] text-secondary-500 dark:text-secondary-400">
                  Local demo session · no authentication
                </p>
              </div>
              <div className="p-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleProfileAction(() => navigate(ROUTES.SETTINGS))}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-secondary-700 transition-colors hover:bg-secondary-100 dark:text-secondary-300 dark:hover:bg-secondary-800"
                >
                  <Icon name="settings" size={14} />
                  Global settings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleProfileAction(() => navigate(ROUTES.RISK))}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-secondary-700 transition-colors hover:bg-secondary-100 dark:text-secondary-300 dark:hover:bg-secondary-800"
                >
                  <Icon name="risk" size={14} />
                  Risk controls
                </button>
                <div className="my-1 border-t border-secondary-100 dark:border-secondary-800" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    handleProfileAction(() =>
                      notify({
                        tone: 'info',
                        title: 'Authentication is not connected',
                        description:
                          'This frontend demo has no user session or backend sign-out endpoint.',
                      })
                    )
                  }
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-secondary-700 transition-colors hover:bg-secondary-100 dark:text-secondary-300 dark:hover:bg-secondary-800"
                >
                  <Icon name="logout" size={14} />
                  Sign out (demo)
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
