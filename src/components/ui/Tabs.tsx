import { useId } from 'react';
import { cn } from '@/utils/cn';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  panelId?: string;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
  className?: string;
}

export function Tabs({ items, value, onChange, ariaLabel, className }: TabsProps) {
  const baseId = useId();

  const activate = (index: number) => {
    const item = items[index];
    if (!item) return;
    onChange(item.id);
    document.getElementById(`${baseId}-${item.id}`)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex gap-1 overflow-x-auto border-b border-secondary-200 dark:border-secondary-800',
        className
      )}
    >
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            id={`${baseId}-${item.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={item.panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') {
                event.preventDefault();
                activate((index + 1) % items.length);
              } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                activate((index - 1 + items.length) % items.length);
              } else if (event.key === 'Home') {
                event.preventDefault();
                activate(0);
              } else if (event.key === 'End') {
                event.preventDefault();
                activate(items.length - 1);
              }
            }}
            className={cn(
              '-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-secondary-900',
              selected
                ? 'border-primary-600 text-primary-700 dark:border-primary-400 dark:text-primary-300'
                : 'border-transparent text-secondary-500 hover:border-secondary-300 hover:text-secondary-800 dark:text-secondary-400 dark:hover:border-secondary-700 dark:hover:text-secondary-200'
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                  selected
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                    : 'bg-secondary-100 text-secondary-500 dark:bg-secondary-800 dark:text-secondary-400'
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
