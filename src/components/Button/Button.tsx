import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { buttonClasses, type ButtonSize, type ButtonVariant } from '@/utils/button';
import { Icon, type IconName } from '@/components/ui/Icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  className,
  children,
  type = 'button',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Icon name="refresh" size={15} className="animate-spin" />
      ) : icon ? (
        <Icon name={icon} size={15} />
      ) : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={15} /> : null}
    </button>
  );
}

interface IconButtonProps extends Omit<ButtonProps, 'children' | 'icon'> {
  icon: IconName;
  label: string;
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'sm',
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={buttonClasses(variant, size, cn('px-2', className))}
      {...props}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}
