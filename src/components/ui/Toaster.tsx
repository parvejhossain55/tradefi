import { createPortal } from 'react-dom';
import { useToastStore } from '@/store/toastStore';
import type { ToastTone } from '@/store/toastStore';
import { Icon, type IconName } from './Icon';
import { cn } from '@/utils/cn';

const toneStyles: Record<ToastTone, { icon: IconName; iconClass: string; barClass: string }> = {
  success: {
    icon: 'checkCircle',
    iconClass: 'text-success-600 dark:text-success-400',
    barClass: 'bg-success-500',
  },
  error: {
    icon: 'xCircle',
    iconClass: 'text-danger-600 dark:text-danger-400',
    barClass: 'bg-danger-500',
  },
  warning: {
    icon: 'alertTriangle',
    iconClass: 'text-warning-600 dark:text-warning-400',
    barClass: 'bg-warning-500',
  },
  info: {
    icon: 'info',
    iconClass: 'text-primary-600 dark:text-primary-400',
    barClass: 'bg-primary-500',
  },
};

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
    >
      {toasts.map((toastItem) => {
        const tone = toneStyles[toastItem.tone];
        return (
          <div
            key={toastItem.id}
            role={toastItem.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto relative flex gap-3 overflow-hidden rounded-lg border border-secondary-200 bg-white p-3 shadow-medium animate-slide-up dark:border-secondary-700 dark:bg-secondary-900"
          >
            <span className={cn('absolute inset-y-0 left-0 w-0.5', tone.barClass)} />
            <Icon name={tone.icon} size={18} className={cn('mt-0.5 shrink-0', tone.iconClass)} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-secondary-900 dark:text-white">
                {toastItem.title}
              </p>
              {toastItem.description ? (
                <p className="mt-0.5 break-words text-[11px] leading-4 text-secondary-500 dark:text-secondary-400">
                  {toastItem.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => removeToast(toastItem.id)}
              className="shrink-0 rounded p-0.5 text-secondary-400 transition-colors hover:text-secondary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:text-secondary-200"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
}
