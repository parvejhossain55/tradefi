import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-secondary-200 bg-white shadow-sm dark:border-secondary-800 dark:bg-secondary-900',
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function CardHeader({ title, description, actions, className }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-secondary-200 px-4 py-3.5 dark:border-secondary-800',
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-secondary-900 dark:text-white">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs leading-5 text-secondary-500 dark:text-secondary-400">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export function CardBody({ children, className }: CardBodyProps) {
  return <div className={cn('p-4', className)}>{children}</div>;
}
