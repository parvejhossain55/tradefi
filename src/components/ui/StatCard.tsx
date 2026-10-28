import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { cn } from '@/utils/cn';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: IconName;
  tone?: 'primary' | 'success' | 'warning' | 'neutral' | 'danger';
  loading?: boolean;
}

const iconTones = {
  primary: 'bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400',
  success: 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400',
  warning: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-400',
  neutral: 'bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-300',
  danger: 'bg-danger-50 text-danger-600 dark:bg-danger-500/10 dark:text-danger-400',
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  loading = false,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-secondary-200 bg-white p-4 shadow-sm dark:border-secondary-800 dark:bg-secondary-900">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-secondary-500 dark:text-secondary-400">{label}</p>
        <span
          className={cn('flex h-7 w-7 items-center justify-center rounded-lg', iconTones[tone])}
        >
          <Icon name={icon} size={15} />
        </span>
      </div>
      {loading ? (
        <div className="mt-2 h-7 w-20 animate-pulse rounded bg-secondary-200 dark:bg-secondary-800" />
      ) : (
        <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-secondary-900 dark:text-white">
          {value}
        </p>
      )}
      {hint ? (
        <div className="mt-1 text-[11px] leading-4 text-secondary-500 dark:text-secondary-400">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
