import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { cn } from '@/utils/cn';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  backTo?: { to: string; label: string };
  className?: string;
}

export function PageHeader({ title, description, actions, backTo, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        {backTo ? (
          <Link
            to={backTo.to}
            className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium text-secondary-500 transition-colors hover:text-primary-600 dark:text-secondary-400 dark:hover:text-primary-400"
          >
            <Icon name="chevronLeft" size={13} />
            {backTo.label}
          </Link>
        ) : null}
        <h1 className="text-xl font-semibold tracking-tight text-secondary-900 dark:text-white">
          {title}
        </h1>
        {description ? (
          <div className="mt-1 max-w-3xl text-sm leading-6 text-secondary-500 dark:text-secondary-400">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
