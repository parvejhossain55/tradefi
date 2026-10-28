import { Button } from '@/components/Button';
import { Icon } from './Icon';
import { cn } from '@/utils/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded bg-secondary-200 dark:bg-secondary-800', className)}
    />
  );
}

export function LoadingState({ label = 'Loading workspace…' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <Icon
        name="refresh"
        size={22}
        className="animate-spin text-primary-600 dark:text-primary-400"
      />
      <p className="text-sm text-secondary-500 dark:text-secondary-400">{label}</p>
    </div>
  );
}

export function ErrorState({
  title = 'Unable to load workspace',
  description,
  onRetry,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-50 text-danger-600 dark:bg-danger-500/10 dark:text-danger-400">
        <Icon name="alertTriangle" size={20} />
      </span>
      <h2 className="mt-3 text-base font-semibold text-secondary-900 dark:text-white">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-secondary-500 dark:text-secondary-400">
        {description}
      </p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
