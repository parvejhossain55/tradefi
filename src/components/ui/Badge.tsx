import type { ReactNode } from 'react';
import type { StatusTone } from '@/types/trading';
import { cn } from '@/utils/cn';

const toneClasses: Record<StatusTone, string> = {
  success:
    'bg-success-50 text-success-700 ring-success-600/20 dark:bg-success-500/10 dark:text-success-300 dark:ring-success-400/20',
  warning:
    'bg-warning-50 text-warning-700 ring-warning-600/20 dark:bg-warning-500/10 dark:text-warning-300 dark:ring-warning-400/20',
  danger:
    'bg-danger-50 text-danger-700 ring-danger-600/20 dark:bg-danger-500/10 dark:text-danger-300 dark:ring-danger-400/20',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20',
  neutral:
    'bg-secondary-100 text-secondary-600 ring-secondary-500/20 dark:bg-secondary-800 dark:text-secondary-300 dark:ring-secondary-500/20',
  primary:
    'bg-primary-50 text-primary-700 ring-primary-600/20 dark:bg-primary-500/10 dark:text-primary-300 dark:ring-primary-400/20',
};

interface BadgeProps {
  tone?: StatusTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}

export function Badge({ tone = 'neutral', children, dot = false, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        toneClasses[tone],
        className
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
