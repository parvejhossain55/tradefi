import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({
  icon = 'info',
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={
        compact
          ? 'flex flex-col items-center justify-center px-4 py-6 text-center'
          : 'flex flex-col items-center justify-center px-4 py-12 text-center'
      }
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-100 text-secondary-500 dark:bg-secondary-800 dark:text-secondary-400">
        <Icon name={icon} size={18} />
      </span>
      <p className="mt-2.5 text-sm font-medium text-secondary-800 dark:text-secondary-200">
        {title}
      </p>
      {description ? (
        <div className="mt-1 max-w-sm text-xs leading-5 text-secondary-500 dark:text-secondary-400">
          {description}
        </div>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
