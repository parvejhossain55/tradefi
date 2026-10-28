import { useId } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/utils/cn';

const controlClasses =
  'block w-full rounded-lg border border-secondary-300 bg-white px-3 py-2 text-sm text-secondary-900 shadow-sm transition-colors placeholder:text-secondary-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-secondary-50 disabled:text-secondary-500 dark:border-secondary-700 dark:bg-secondary-900 dark:text-secondary-100 dark:placeholder:text-secondary-500 dark:disabled:bg-secondary-900/60';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      className={cn(
        controlClasses,
        invalid &&
          'border-danger-400 focus:border-danger-500 focus:ring-danger-500/20 dark:border-danger-500/70',
        className
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export function Select({ className, invalid, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        controlClasses,
        'pr-8',
        invalid &&
          'border-danger-400 focus:border-danger-500 focus:ring-danger-500/20 dark:border-danger-500/70',
        className
      )}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ className, invalid, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        controlClasses,
        'min-h-[76px] resize-y',
        invalid &&
          'border-danger-400 focus:border-danger-500 focus:ring-danger-500/20 dark:border-danger-500/70',
        className
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

interface FieldProps {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, hint, error, required, children, className }: FieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="mb-1.5 block text-xs font-medium text-secondary-700 dark:text-secondary-300"
        >
          {label}
          {required ? <span className="ml-0.5 text-danger-500">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p
          role="alert"
          className="mt-1 text-[11px] font-medium text-danger-600 dark:text-danger-400"
        >
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-[11px] leading-4 text-secondary-500 dark:text-secondary-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
  ariaLabel,
}: ToggleProps) {
  const generatedId = useId();
  const labelId = `${id ?? generatedId}-label`;

  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={label ? labelId : undefined}
      aria-label={label ? undefined : (ariaLabel ?? 'Toggle setting')}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-secondary-900',
        checked ? 'bg-primary-600 dark:bg-primary-500' : 'bg-secondary-300 dark:bg-secondary-700'
      )}
    >
      <span
        className={cn(
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        )}
      />
    </button>
  );

  if (!label) return control;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p id={labelId} className="text-xs font-medium text-secondary-700 dark:text-secondary-300">
          {label}
        </p>
        {description ? (
          <p className="mt-0.5 text-[11px] leading-4 text-secondary-500 dark:text-secondary-400">
            {description}
          </p>
        ) : null}
      </div>
      {control}
    </div>
  );
}

interface InlineCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
}

export function InlineCheckbox({ checked, onChange, label, disabled }: InlineCheckboxProps) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-secondary-700 dark:text-secondary-300">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500 dark:border-secondary-600 dark:bg-secondary-900"
      />
      {label}
    </label>
  );
}
