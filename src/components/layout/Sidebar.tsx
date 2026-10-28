import { NavLink } from 'react-router-dom';
import { APP_NAME, NAV_SECTIONS } from '@/constants';
import { useTradingStore } from '@/store/tradingStore';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/utils/cn';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const appName = useTradingStore((state) => state.snapshot?.settings.appName) ?? APP_NAME;
  const emergencyHalt = useTradingStore(
    (state) => state.snapshot?.globalRisk.emergencyAutomationDisabled ?? false
  );

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-secondary-950/40 backdrop-blur-[1px] transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-secondary-200 bg-white transition-transform duration-200 dark:border-secondary-800 dark:bg-secondary-900 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full invisible lg:visible'
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-secondary-200 px-4 dark:border-secondary-800">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary-900 text-white dark:bg-white dark:text-secondary-900">
              <Icon name="logo" size={18} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-secondary-900 dark:text-white">
                {appName}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-secondary-400 dark:text-secondary-500">
                Trading operations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-lg p-1.5 text-secondary-500 hover:bg-secondary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-secondary-800 lg:hidden"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mb-5 last:mb-0">
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-secondary-400 dark:text-secondary-500">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                          isActive
                            ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                            : 'text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900 dark:text-secondary-400 dark:hover:bg-secondary-800/70 dark:hover:text-secondary-100'
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive ? (
                            <span
                              className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary-600 dark:bg-primary-400"
                              aria-hidden="true"
                            />
                          ) : null}
                          <Icon name={item.icon} size={16} className="shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 p-3 ">
          {emergencyHalt ? (
            <div className="mb-2 flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 px-2.5 py-2 dark:border-danger-500/20 dark:bg-danger-500/10">
              <Icon
                name="alertTriangle"
                size={14}
                className="mt-0.5 shrink-0 text-danger-600 dark:text-danger-400"
              />
              <div>
                <p className="text-[11px] font-semibold text-danger-700 dark:text-danger-300">
                  Emergency halt active
                </p>
                <p className="mt-0.5 text-[10px] leading-4 text-danger-600/80 dark:text-danger-300/70">
                  Automation is blocked for every pair.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
