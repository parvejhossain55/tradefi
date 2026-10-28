import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { useClickOutside } from '@/hooks/useClickOutside';
import { cn } from '@/utils/cn';

export interface DropdownAction {
  label: string;
  icon?: IconName;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  separatorBefore?: boolean;
}

interface DropdownMenuProps {
  actions: DropdownAction[];
  label?: string;
  align?: 'left' | 'right';
}

export function DropdownMenu({
  actions,
  label = 'Open actions',
  align = 'right',
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useClickOutside(containerRef, () => setOpen(false), open);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const visibleActions = actions.filter(Boolean);

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-secondary-500 transition-colors hover:bg-secondary-100 hover:text-secondary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-secondary-400 dark:hover:bg-secondary-800 dark:hover:text-secondary-100"
      >
        <Icon name="more" size={17} />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={label}
          className={cn(
            'absolute top-full z-40 mt-1 w-52 rounded-lg border border-secondary-200 bg-white p-1 shadow-medium dark:border-secondary-700 dark:bg-secondary-900',
            align === 'right' ? 'right-0' : 'left-0'
          )}
          onClick={(event) => event.stopPropagation()}
        >
          {visibleActions.map((action) => (
            <div key={action.label}>
              {action.separatorBefore ? (
                <div
                  role="separator"
                  className="my-1 border-t border-secondary-100 dark:border-secondary-800"
                />
              ) : null}
              <button
                type="button"
                role="menuitem"
                disabled={action.disabled}
                onClick={() => {
                  setOpen(false);
                  action.onSelect();
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-40',
                  action.tone === 'danger'
                    ? 'text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-500/10'
                    : 'text-secondary-700 hover:bg-secondary-100 dark:text-secondary-300 dark:hover:bg-secondary-800'
                )}
              >
                {action.icon ? <Icon name={action.icon} size={14} /> : null}
                {action.label}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
