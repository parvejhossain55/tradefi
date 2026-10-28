import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button, IconButton } from '@/components/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, InlineCheckbox, Input, Select, Textarea, Toggle } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { notify, notifyError } from '@/store/toastStore';
import { useTradingStore } from '@/store/tradingStore';
import { TradingApiError } from '@/services/tradingApi';
import type {
  ConfigValue,
  MarketType,
  ParameterType,
  StrategyCategory,
  StrategyDefinition,
  StrategyInput,
  StrategyParameterDefinition,
  Timeframe,
} from '@/types/trading';
import {
  MARKET_TYPES,
  PARAMETER_TYPE_LABELS,
  STRATEGY_CATEGORIES,
  TIMEFRAMES,
} from '@/types/trading';
import {
  buildDefaultParameters,
  normalizeIdentifier,
  validateParameterValue,
  validateStrategyDraft,
} from '@/utils/trading';

interface StrategyFormDialogProps {
  open: boolean;
  onClose: () => void;
  strategy?: StrategyDefinition | null;
  onSaved?: (strategyId?: string) => void;
}

interface StrategyFormState {
  name: string;
  identifier: string;
  version: string;
  description: string;
  category: StrategyCategory;
  supportedMarkets: MarketType[];
  supportedTimeframes: Timeframe[];
  enabled: boolean;
  parameterSchema: StrategyParameterDefinition[];
}

const emptyParameter = (index: number): StrategyParameterDefinition => ({
  key: `parameter_${index + 1}`,
  label: '',
  description: '',
  type: 'integer',
  required: true,
  defaultValue: 0,
  min: 0,
  max: 100,
  step: 1,
  group: 'Parameters',
});

const emptyForm = (): StrategyFormState => ({
  name: '',
  identifier: '',
  version: '1.0.0',
  description: '',
  category: 'Liquidity',
  supportedMarkets: ['Forex'],
  supportedTimeframes: ['M15'],
  enabled: true,
  parameterSchema: [],
});

function initialDefaultForType(type: ParameterType): ConfigValue {
  if (type === 'boolean') return false;
  if (type === 'timeframe') return 'M15';
  if (type === 'select') return 'Option 1';
  if (type === 'text') return '';
  return 0;
}

function formatParameterDefault(parameter: StrategyParameterDefinition): string {
  if (typeof parameter.defaultValue === 'boolean') return parameter.defaultValue ? 'On' : 'Off';
  if (parameter.type === 'duration') return `${parameter.defaultValue} min`;
  if (parameter.type === 'percentage') return `${parameter.defaultValue}%`;
  return String(parameter.defaultValue);
}

export function StrategyFormDialog({ open, onClose, strategy, onSaved }: StrategyFormDialogProps) {
  const snapshot = useTradingStore((state) => state.snapshot);
  const createStrategy = useTradingStore((state) => state.createStrategy);
  const updateStrategy = useTradingStore((state) => state.updateStrategy);
  const [form, setForm] = useState<StrategyFormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [parameterErrors, setParameterErrors] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const editing = Boolean(strategy);
  const assignmentCount = strategy
    ? (snapshot?.assignments.filter((assignment) => assignment.strategyId === strategy.id).length ??
      0)
    : 0;

  useEffect(() => {
    if (!open) return;
    setFieldErrors({});
    setParameterErrors({});
    setExpanded(null);
    setSaving(false);
    if (strategy) {
      setForm({
        name: strategy.name,
        identifier: strategy.identifier,
        version: strategy.version,
        description: strategy.description,
        category: strategy.category,
        supportedMarkets: [...strategy.supportedMarkets],
        supportedTimeframes: [...strategy.supportedTimeframes],
        enabled: strategy.enabled,
        parameterSchema: strategy.parameterSchema.map((parameter) => ({
          ...parameter,
          options: parameter.options ? [...parameter.options] : undefined,
        })),
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, strategy]);

  const clearFieldError = (field: string) => {
    setFieldErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const updateForm = <K extends keyof StrategyFormState>(key: K, value: StrategyFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    clearFieldError(key);
  };

  const updateParameter = (index: number, patch: Partial<StrategyParameterDefinition>) => {
    setForm((current) => ({
      ...current,
      parameterSchema: current.parameterSchema.map((parameter, parameterIndex) =>
        parameterIndex === index ? { ...parameter, ...patch } : parameter
      ),
    }));
    setParameterErrors((current) => {
      if (!(index in current)) return current;
      const next = { ...current };
      delete next[index];
      return next;
    });
  };

  const changeParameterType = (index: number, type: ParameterType) => {
    updateParameter(index, {
      type,
      defaultValue: initialDefaultForType(type),
      options: type === 'select' ? ['Option 1', 'Option 2'] : undefined,
    });
  };

  const addParameter = () => {
    setForm((current) => {
      let counter = current.parameterSchema.length + 1;
      while (
        current.parameterSchema.some((parameter) => parameter.key === `parameter_${counter}`)
      ) {
        counter += 1;
      }
      return {
        ...current,
        parameterSchema: [...current.parameterSchema, emptyParameter(counter - 1)],
      };
    });
    setExpanded(form.parameterSchema.length);
    clearFieldError('schema');
  };

  const removeParameter = (index: number) => {
    setForm((current) => ({
      ...current,
      parameterSchema: current.parameterSchema.filter(
        (_, parameterIndex) => parameterIndex !== index
      ),
    }));
    setExpanded(null);
    setParameterErrors({});
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot) return;

    const input: StrategyInput = {
      name: form.name.trim(),
      identifier: normalizeIdentifier(form.identifier),
      version: form.version.trim(),
      description: form.description.trim(),
      category: form.category,
      supportedMarkets: form.supportedMarkets,
      supportedTimeframes: form.supportedTimeframes,
      enabled: form.enabled,
      parameterSchema: form.parameterSchema.map((parameter) => ({
        ...parameter,
        key: normalizeIdentifier(parameter.key),
        label: parameter.label.trim(),
        description: parameter.description?.trim() || undefined,
        group: parameter.group?.trim() || undefined,
        options: parameter.options?.map((option) => option.trim()).filter(Boolean),
      })),
      defaultParameters: buildDefaultParameters(
        form.parameterSchema.map((parameter) => ({
          ...parameter,
          key: normalizeIdentifier(parameter.key),
        }))
      ),
    };

    const validation = validateStrategyDraft(input, snapshot.strategies, strategy?.id);
    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors);
      setParameterErrors(validation.parameterErrors);
      const firstParameterError = Object.keys(validation.parameterErrors)[0];
      if (firstParameterError !== undefined) setExpanded(Number(firstParameterError));
      return;
    }

    setSaving(true);
    try {
      if (strategy) {
        await updateStrategy(strategy.id, input);
        notify({
          tone: 'success',
          title: 'Strategy updated',
          description: `${input.name} was saved. Existing pair-specific configurations were left untouched.`,
        });
        onSaved?.(strategy.id);
      } else {
        const updatedSnapshot = await createStrategy(input);
        const created = updatedSnapshot.strategies.find(
          (candidate) => candidate.identifier === input.identifier
        );
        notify({
          tone: 'success',
          title: 'Strategy created',
          description: `${input.name} is available as a reusable strategy definition.`,
        });
        onSaved?.(created?.id);
      }
      onClose();
    } catch (error) {
      if (error instanceof TradingApiError && error.fieldErrors) {
        setFieldErrors((current) => ({ ...current, ...error.fieldErrors }));
      }
      notifyError(error, 'The strategy could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${strategy?.name}` : 'Create strategy definition'}
      description="Definitions are reusable configuration templates. They do not execute trading logic in this frontend."
      size="xl"
      dismissible={!saving}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="strategy-form" size="sm" loading={saving}>
            {editing ? 'Save strategy' : 'Create strategy'}
          </Button>
        </>
      }
    >
      <form id="strategy-form" className="space-y-5" onSubmit={handleSubmit}>
        {editing ? (
          <div className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2.5 dark:border-warning-500/20 dark:bg-warning-500/5">
            <div className="flex gap-2">
              <Icon
                name="alertTriangle"
                size={15}
                className="mt-0.5 shrink-0 text-warning-600 dark:text-warning-400"
              />
              <div>
                <p className="text-[11px] font-semibold text-warning-800 dark:text-warning-300">
                  Existing pair configurations are protected
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-warning-700/80 dark:text-warning-300/70">
                  {assignmentCount} assigned pair{assignmentCount === 1 ? '' : 's'} keep their
                  current override values when this definition changes. Removed parameters simply
                  stop rendering for those pairs.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Strategy name" htmlFor="strategy-name" required error={fieldErrors.name}>
            <Input
              id="strategy-name"
              value={form.name}
              invalid={Boolean(fieldErrors.name)}
              placeholder="Liquidity Sweep"
              onChange={(event) => updateForm('name', event.target.value)}
            />
          </Field>
          <Field
            label="Unique identifier"
            htmlFor="strategy-identifier"
            required
            error={fieldErrors.identifier}
            hint="Lowercase snake_case, unique across all definitions."
          >
            <Input
              id="strategy-identifier"
              value={form.identifier}
              invalid={Boolean(fieldErrors.identifier)}
              placeholder="liquidity_sweep"
              onChange={(event) =>
                updateForm('identifier', normalizeIdentifier(event.target.value))
              }
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Version" htmlFor="strategy-version" required error={fieldErrors.version}>
            <Input
              id="strategy-version"
              value={form.version}
              invalid={Boolean(fieldErrors.version)}
              placeholder="1.0.0"
              onChange={(event) => updateForm('version', event.target.value)}
            />
          </Field>
          <Field label="Category" htmlFor="strategy-category">
            <Select
              id="strategy-category"
              value={form.category}
              onChange={(event) => updateForm('category', event.target.value as StrategyCategory)}
            >
              {STRATEGY_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end pb-2">
            <Toggle
              checked={form.enabled}
              onChange={(checked) => updateForm('enabled', checked)}
              label="Strategy enabled"
              description="Disabled definitions cannot run automation."
            />
          </div>
        </div>

        <Field
          label="Description"
          htmlFor="strategy-description"
          required
          error={fieldErrors.description}
        >
          <Textarea
            id="strategy-description"
            value={form.description}
            invalid={Boolean(fieldErrors.description)}
            placeholder="Explain the setup this configuration model represents."
            onChange={(event) => updateForm('description', event.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-medium text-secondary-700 dark:text-secondary-300">
              Supported markets
              <span className="ml-0.5 text-danger-500">*</span>
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-secondary-200 p-2.5 dark:border-secondary-800">
              {MARKET_TYPES.map((market) => (
                <InlineCheckbox
                  key={market}
                  checked={form.supportedMarkets.includes(market)}
                  onChange={(checked) =>
                    updateForm(
                      'supportedMarkets',
                      checked
                        ? [...form.supportedMarkets, market]
                        : form.supportedMarkets.filter((candidate) => candidate !== market)
                    )
                  }
                  label={market}
                />
              ))}
            </div>
            {fieldErrors.supportedMarkets ? (
              <p role="alert" className="mt-1 text-[11px] text-danger-600 dark:text-danger-400">
                {fieldErrors.supportedMarkets}
              </p>
            ) : null}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-secondary-700 dark:text-secondary-300">
              Supported timeframes
              <span className="ml-0.5 text-danger-500">*</span>
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-secondary-200 p-2.5 dark:border-secondary-800">
              {TIMEFRAMES.map((timeframe) => (
                <InlineCheckbox
                  key={timeframe}
                  checked={form.supportedTimeframes.includes(timeframe)}
                  onChange={(checked) =>
                    updateForm(
                      'supportedTimeframes',
                      checked
                        ? [...form.supportedTimeframes, timeframe]
                        : form.supportedTimeframes.filter((candidate) => candidate !== timeframe)
                    )
                  }
                  label={timeframe}
                />
              ))}
            </div>
            {fieldErrors.supportedTimeframes ? (
              <p role="alert" className="mt-1 text-[11px] text-danger-600 dark:text-danger-400">
                {fieldErrors.supportedTimeframes}
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-secondary-800 dark:text-secondary-200">
                Configuration schema
              </p>
              <p className="text-[10px] text-secondary-500 dark:text-secondary-400">
                The pair configuration form is generated from these parameter definitions.
              </p>
            </div>
            <Button variant="secondary" size="xs" icon="plus" onClick={addParameter}>
              Add parameter
            </Button>
          </div>

          {form.parameterSchema.length === 0 ? (
            <div className="rounded-lg border border-dashed border-secondary-300 px-4 py-6 text-center dark:border-secondary-700">
              <p className="text-xs font-medium text-secondary-700 dark:text-secondary-300">
                No parameters defined
              </p>
              <p className="mt-1 text-[11px] text-secondary-500 dark:text-secondary-400">
                Add at least one parameter so pairs can be configured from this strategy.
              </p>
              {fieldErrors.schema ? (
                <p role="alert" className="mt-1 text-[11px] text-danger-600 dark:text-danger-400">
                  {fieldErrors.schema}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              {form.parameterSchema.map((parameter, index) => {
                const isExpanded = expanded === index;
                const error = parameterErrors[index];
                const defaultError = validateParameterValue(parameter, parameter.defaultValue);
                return (
                  <div
                    key={`${parameter.key}-${index}`}
                    className="overflow-hidden rounded-lg border border-secondary-200 dark:border-secondary-800"
                  >
                    <div className="flex items-center gap-2 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setExpanded(isExpanded ? null : index)}
                        aria-expanded={isExpanded}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      >
                        <Icon
                          name="chevronRight"
                          size={13}
                          className={`shrink-0 text-secondary-400 transition-transform ${
                            isExpanded ? 'rotate-90' : ''
                          }`}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-secondary-800 dark:text-secondary-200">
                            {parameter.label || (
                              <span className="italic text-secondary-400">Untitled parameter</span>
                            )}
                            {parameter.required ? (
                              <span className="ml-0.5 text-danger-500">*</span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-secondary-400 dark:text-secondary-500">
                            <code className="rounded bg-secondary-100 px-1 py-0.5 dark:bg-secondary-800">
                              {parameter.key || 'no_key'}
                            </code>
                            <span>{PARAMETER_TYPE_LABELS[parameter.type]}</span>
                            <span>Default: {formatParameterDefault(parameter)}</span>
                            {parameter.group ? <span>Group: {parameter.group}</span> : null}
                          </span>
                        </span>
                        {error || defaultError ? (
                          <Icon
                            name="alertCircle"
                            size={14}
                            className="ml-auto shrink-0 text-danger-500"
                            title={error ?? defaultError ?? undefined}
                          />
                        ) : null}
                      </button>
                      <Badge tone={parameter.required ? 'primary' : 'neutral'}>
                        {parameter.required ? 'Required' : 'Optional'}
                      </Badge>
                      <IconButton
                        icon="trash"
                        label={`Remove ${parameter.label || 'parameter'}`}
                        onClick={() => removeParameter(index)}
                        className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10"
                      />
                    </div>

                    {isExpanded ? (
                      <div className="space-y-3 border-t border-secondary-200 bg-secondary-50/50 p-3 dark:border-secondary-800 dark:bg-secondary-950/30">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field label="Label" htmlFor={`param-${index}-label`} required>
                            <Input
                              id={`param-${index}-label`}
                              value={parameter.label}
                              placeholder="Signal timeframe"
                              onChange={(event) =>
                                updateParameter(index, { label: event.target.value })
                              }
                            />
                          </Field>
                          <Field
                            label="Key"
                            htmlFor={`param-${index}-key`}
                            required
                            hint="snake_case, stable across versions"
                          >
                            <Input
                              id={`param-${index}-key`}
                              value={parameter.key}
                              placeholder="signal_timeframe"
                              onChange={(event) =>
                                updateParameter(index, {
                                  key: normalizeIdentifier(event.target.value),
                                })
                              }
                            />
                          </Field>
                          <Field label="Data type" htmlFor={`param-${index}-type`}>
                            <Select
                              id={`param-${index}-type`}
                              value={parameter.type}
                              onChange={(event) =>
                                changeParameterType(index, event.target.value as ParameterType)
                              }
                            >
                              {Object.entries(PARAMETER_TYPE_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </Select>
                          </Field>
                        </div>

                        <Field label="Description" htmlFor={`param-${index}-description`}>
                          <Input
                            id={`param-${index}-description`}
                            value={parameter.description ?? ''}
                            placeholder="Explain how this parameter is used."
                            onChange={(event) =>
                              updateParameter(index, { description: event.target.value })
                            }
                          />
                        </Field>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field label="Default value" htmlFor={`param-${index}-default`} required>
                            {parameter.type === 'boolean' ? (
                              <Select
                                id={`param-${index}-default`}
                                value={parameter.defaultValue ? 'true' : 'false'}
                                onChange={(event) =>
                                  updateParameter(index, {
                                    defaultValue: event.target.value === 'true',
                                  })
                                }
                              >
                                <option value="false">Off</option>
                                <option value="true">On</option>
                              </Select>
                            ) : parameter.type === 'timeframe' ? (
                              <Select
                                id={`param-${index}-default`}
                                value={String(parameter.defaultValue)}
                                onChange={(event) =>
                                  updateParameter(index, { defaultValue: event.target.value })
                                }
                              >
                                {TIMEFRAMES.map((timeframe) => (
                                  <option key={timeframe} value={timeframe}>
                                    {timeframe}
                                  </option>
                                ))}
                              </Select>
                            ) : parameter.type === 'select' ? (
                              <Select
                                id={`param-${index}-default`}
                                value={String(parameter.defaultValue)}
                                onChange={(event) =>
                                  updateParameter(index, { defaultValue: event.target.value })
                                }
                              >
                                {parameter.options?.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                                {parameter.options?.includes(
                                  String(parameter.defaultValue)
                                ) ? null : (
                                  <option value={String(parameter.defaultValue)}>
                                    {String(parameter.defaultValue) || 'Choose a value'}
                                  </option>
                                )}
                              </Select>
                            ) : parameter.type === 'text' ? (
                              <Input
                                id={`param-${index}-default`}
                                value={String(parameter.defaultValue)}
                                onChange={(event) =>
                                  updateParameter(index, { defaultValue: event.target.value })
                                }
                              />
                            ) : (
                              <Input
                                id={`param-${index}-default`}
                                type="number"
                                value={String(parameter.defaultValue)}
                                step={
                                  parameter.type === 'integer' || parameter.type === 'duration'
                                    ? 1
                                    : 0.1
                                }
                                onChange={(event) =>
                                  updateParameter(index, {
                                    defaultValue:
                                      event.target.value === '' ? 0 : Number(event.target.value),
                                  })
                                }
                              />
                            )}
                          </Field>
                          <Field label="Group" htmlFor={`param-${index}-group`}>
                            <Input
                              id={`param-${index}-group`}
                              value={parameter.group ?? ''}
                              placeholder="Entry"
                              onChange={(event) =>
                                updateParameter(index, { group: event.target.value })
                              }
                            />
                          </Field>
                          <div className="flex items-end pb-2">
                            <InlineCheckbox
                              checked={parameter.required}
                              onChange={(checked) => updateParameter(index, { required: checked })}
                              label="Required parameter"
                            />
                          </div>
                        </div>

                        {parameter.type === 'select' ? (
                          <Field
                            label="Allowed options"
                            htmlFor={`param-${index}-options`}
                            hint="Comma-separated. The default value must be one of these options."
                          >
                            <Input
                              id={`param-${index}-options`}
                              value={(parameter.options ?? []).join(', ')}
                              placeholder="Any, London, New York"
                              onChange={(event) =>
                                updateParameter(index, {
                                  options: event.target.value
                                    .split(',')
                                    .map((option) => option.trim())
                                    .filter(Boolean),
                                })
                              }
                            />
                          </Field>
                        ) : null}

                        {['integer', 'decimal', 'percentage', 'duration'].includes(
                          parameter.type
                        ) ? (
                          <div className="grid gap-3 sm:grid-cols-4">
                            <Field label="Minimum" htmlFor={`param-${index}-min`}>
                              <Input
                                id={`param-${index}-min`}
                                type="number"
                                value={parameter.min ?? ''}
                                onChange={(event) =>
                                  updateParameter(index, {
                                    min:
                                      event.target.value === ''
                                        ? undefined
                                        : Number(event.target.value),
                                  })
                                }
                              />
                            </Field>
                            <Field label="Maximum" htmlFor={`param-${index}-max`}>
                              <Input
                                id={`param-${index}-max`}
                                type="number"
                                value={parameter.max ?? ''}
                                onChange={(event) =>
                                  updateParameter(index, {
                                    max:
                                      event.target.value === ''
                                        ? undefined
                                        : Number(event.target.value),
                                  })
                                }
                              />
                            </Field>
                            <Field label="Step" htmlFor={`param-${index}-step`}>
                              <Input
                                id={`param-${index}-step`}
                                type="number"
                                value={parameter.step ?? ''}
                                onChange={(event) =>
                                  updateParameter(index, {
                                    step:
                                      event.target.value === ''
                                        ? undefined
                                        : Number(event.target.value),
                                  })
                                }
                              />
                            </Field>
                            <Field label="Unit" htmlFor={`param-${index}-unit`}>
                              <Input
                                id={`param-${index}-unit`}
                                value={parameter.unit ?? ''}
                                placeholder="min"
                                onChange={(event) =>
                                  updateParameter(index, {
                                    unit: event.target.value || undefined,
                                  })
                                }
                              />
                            </Field>
                          </div>
                        ) : null}

                        {error ? (
                          <p
                            role="alert"
                            className="rounded-md bg-danger-50 px-2 py-1.5 text-[11px] font-medium text-danger-700 dark:bg-danger-500/10 dark:text-danger-300"
                          >
                            {error}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          {fieldErrors.schema && form.parameterSchema.length > 0 ? (
            <p role="alert" className="mt-1 text-[11px] text-danger-600 dark:text-danger-400">
              {fieldErrors.schema}
            </p>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
