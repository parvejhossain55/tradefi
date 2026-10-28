import type { ReactNode } from 'react';
import { Button } from '@/components/Button';
import { Modal } from './Modal';
import { Icon } from './Icon';

interface ConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  icon?: 'alertTriangle' | 'shieldCheck' | 'archive' | 'pause' | 'play' | 'refresh';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  icon = 'alertTriangle',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      dismissible={!loading}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            tone === 'danger'
              ? 'bg-danger-50 text-danger-600 dark:bg-danger-500/10 dark:text-danger-400'
              : 'bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400'
          }`}
        >
          <Icon name={icon} size={18} />
        </span>
        <div className="min-w-0">
          {description ? (
            <div className="text-sm leading-6 text-secondary-600 dark:text-secondary-300">
              {description}
            </div>
          ) : null}
          {children ? <div className="mt-3">{children}</div> : null}
        </div>
      </div>
    </Modal>
  );
}
