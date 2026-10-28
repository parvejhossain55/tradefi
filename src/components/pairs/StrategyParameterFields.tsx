import { useId } from 'react';
import type {
  ConfigValue,
  StrategyParameterDefinition,
  StrategyParameters,
  Timeframe,
} from '@/types/trading';
import { TIMEFRAMES } from '@/types/trading';
import { Badge } from '@/components/ui/Badge';
import { Input, Select, Textarea, Toggle } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/utils/cn';

interface StrategyParameterFieldsProps {
  schema: StrategyParameterDefinition[];
  values: StrategyParameters;
  customizedKeys?: string[];
  errors?: Record<string, string>;
  onChange: (key: string, value: ConfigValue) => void;
  onRevert?: (key: string) => void;
  disabled?: boolean;
  supportedTimeframes?: Timeframe[];
}

function formatDefault(parameter: StrategyParameterDefinition): string {
  if (typeof parameter.defaultValue === 'boolean') {
    return parameter.defaultValue ? 'On' : 'Off';
  }
  if (parameter.type === 'percentage') return `${parameter.defaultValue}%`;
  if (parameter.type === 'duration') return `${parameter.defaultValue} min`;
  return String(parameter.defaultValue);
}

function ParameterControl({
  parameter,
  id,
  value,
  invalid,
  disabled,
  supportedTimeframes,
  onChange,
}: {
  parameter: StrategyParameterDefinition;
  id: string;
  value: ConfigValue | undefined;
  invalid: boolean;
  disabled?: boolean;
  supportedTimeframes: Timeframe[];
  onChange: (value: ConfigValue) => void;
}) {
  if (parameter.type === 'boolean') {
    return (
      <Toggle
        checked={value === true}
        onChange={onChange}
        disabled={disabled}
        ariaLabel={parameter.label}
      />
    );
  }

  if (parameter.type === 'select') {
    return (
      <Select
        id={id}
        value={String(value ?? '')}
        invalid={invalid}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {parameter.options?.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    );
  }

  if (parameter.type === 'timeframe') {
    return (
      <Select
        id={id}
        value={String(value ?? '')}
        invalid={invalid}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {TIMEFRAMES.filter(
          (timeframe) => supportedTimeframes.length === 0 || supportedTimeframes.includes(timeframe)
        ).map((timeframe) => (
          <option key={timeframe} value={timeframe}>
            {timeframe}
          </option>
        ))}
      </Select>
    );
  }

  if (parameter.type === 'text') {
    return (
      <Textarea
        id={id}
        value={String(value ?? '')}
        invalid={invalid}
        disabled={disabled}
        maxLength={parameter.maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  const suffix = parameter.unit ?? (parameter.type === 'percentage' ? '%' : undefined);
  const step =
    parameter.step ?? (parameter.type === 'integer' || parameter.type === 'duration' ? 1 : 0.1);

  return (
    <div className="relative">
      <Input
        id={id}
        type="number"
        inputMode={
          parameter.type === 'integer' || parameter.type === 'duration' ? 'numeric' : 'decimal'
        }
        value={value === undefined ? '' : String(value)}
        invalid={invalid}
        disabled={disabled}
        min={parameter.min}
        max={parameter.max}
        step={step}
        className={cn('tabular-nums', suffix && 'pr-12')}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === '') {
            onChange('');
            return;
          }
          const parsed = Number(raw);
          onChange(Number.isNaN(parsed) ? raw : parsed);
        }}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-secondary-400">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

export function StrategyParameterFields({
  schema,
  values,
  customizedKeys = [],
  errors = {},
  onChange,
  onRevert,
  disabled = false,
  supportedTimeframes = [],
}: StrategyParameterFieldsProps) {
  const baseId = useId().replace(/:/g, '');

  const groups: { name: string; parameters: StrategyParameterDefinition[] }[] = [];
  schema.forEach((parameter) => {
    const groupName = parameter.group?.trim() || 'Parameters';
    const existing = groups.find((group) => group.name === groupName);
    if (existing) existing.parameters.push(parameter);
    else groups.push({ name: groupName, parameters: [parameter] });
  });

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <fieldset key={group.name}>
          <legend className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-secondary-400 dark:text-secondary-500">
            {group.name}
          </legend>
          <div className="grid gap-2.5 md:grid-cols-2">
            {group.parameters.map((parameter) => {
              const id = `${baseId}-${parameter.key}`;
              const customized = customizedKeys.includes(parameter.key);
              const error = errors[parameter.key];
              const value = values[parameter.key];

              return (
                <div
                  key={parameter.key}
                  className={cn(
                    'rounded-lg border p-3 transition-colors',
                    customized
                      ? 'border-primary-200 bg-primary-50/30 dark:border-primary-500/20 dark:bg-primary-500/5'
                      : 'border-secondary-200 bg-white dark:border-secondary-800 dark:bg-secondary-900'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {parameter.type === 'boolean' ? (
                        <span className="block text-xs font-medium text-secondary-800 dark:text-secondary-200">
                          {parameter.label}
                          {parameter.required ? (
                            <span className="ml-0.5 text-danger-500">*</span>
                          ) : null}
                        </span>
                      ) : (
                        <label
                          htmlFor={id}
                          className="block text-xs font-medium text-secondary-800 dark:text-secondary-200"
                        >
                          {parameter.label}
                          {parameter.required ? (
                            <span className="ml-0.5 text-danger-500">*</span>
                          ) : null}
                        </label>
                      )}
                      <p className="mt-0.5 text-[10px] tabular-nums text-secondary-400 dark:text-secondary-500">
                        Default: {formatDefault(parameter)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge tone={customized ? 'info' : 'neutral'}>
                        {customized ? 'Customized' : 'Inherited'}
                      </Badge>
                      {customized && onRevert && !disabled ? (
                        <button
                          type="button"
                          onClick={() => onRevert(parameter.key)}
                          title={`Revert ${parameter.label} to default`}
                          aria-label={`Revert ${parameter.label} to default`}
                          className="rounded p-0.5 text-secondary-400 transition-colors hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:text-primary-400"
                        >
                          <Icon name="refresh" size={12} />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-2">
                    <ParameterControl
                      parameter={parameter}
                      id={id}
                      value={value}
                      invalid={Boolean(error)}
                      disabled={disabled}
                      supportedTimeframes={supportedTimeframes}
                      onChange={(nextValue) => onChange(parameter.key, nextValue)}
                    />
                  </div>

                  {parameter.description ? (
                    <p className="mt-1.5 text-[10px] leading-4 text-secondary-500 dark:text-secondary-400">
                      {parameter.description}
                    </p>
                  ) : null}

                  {error ? (
                    <p
                      role="alert"
                      className="mt-1.5 text-[10px] font-medium text-danger-600 dark:text-danger-400"
                    >
                      {error}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
