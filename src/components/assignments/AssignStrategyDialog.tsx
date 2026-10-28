import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { notify, notifyError } from '@/store/toastStore';
import { useTradingStore } from '@/store/tradingStore';
import { cn } from '@/utils/cn';

interface AssignStrategyDialogProps {
  open: boolean;
  onClose: () => void;
  pairId: string;
  onAssigned?: () => void;
}

export function AssignStrategyDialog({
  open,
  onClose,
  pairId,
  onAssigned,
}: AssignStrategyDialogProps) {
  const snapshot = useTradingStore((state) => state.snapshot);
  const assignStrategy = useTradingStore((state) => state.assignStrategy);
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);

  const pair = snapshot?.pairs.find((candidate) => candidate.id === pairId);
  const assignment = useMemo(
    () => snapshot?.assignments.find((candidate) => candidate.pairId === pairId),
    [pairId, snapshot?.assignments]
  );
  const currentStrategy = snapshot?.strategies.find(
    (strategy) => strategy.id === assignment?.strategyId
  );
  const selectedStrategy = snapshot?.strategies.find((strategy) => strategy.id === selectedId);
  const customizedCount = assignment ? Object.keys(assignment.configuration).length : 0;
  const isChange = Boolean(assignment?.strategyId);
  const sameStrategy = assignment?.strategyId === selectedId;

  useEffect(() => {
    if (!open) return;
    setSelectedId(assignment?.strategyId ?? '');
    setSaving(false);
  }, [open, assignment?.strategyId]);

  const handleSubmit = async () => {
    if (!pair || !selectedStrategy || sameStrategy) return;
    setSaving(true);
    try {
      await assignStrategy(pairId, selectedId);
      notify({
        tone: 'success',
        title: isChange ? 'Strategy reassigned' : 'Strategy assigned',
        description: `${selectedStrategy.name} is now assigned to ${pair.symbol} with default parameters.`,
      });
      onAssigned?.();
      onClose();
    } catch (error) {
      notifyError(error, 'The strategy assignment could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isChange ? 'Change assigned strategy' : 'Assign a strategy'}
      description={
        pair
          ? `${pair.symbol} · ${pair.marketType} · ${pair.defaultTimeframe}. Editing a strategy definition never changes existing pair overrides.`
          : undefined
      }
      size="lg"
      dismissible={!saving}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            loading={saving}
            disabled={!selectedStrategy || sameStrategy}
          >
            {isChange ? 'Confirm strategy change' : 'Assign strategy'}
          </Button>
        </>
      }
    >
      {pair?.status === 'archived' ? (
        <div className="mb-4 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-[11px] text-danger-700 dark:border-danger-500/20 dark:bg-danger-500/10 dark:text-danger-300">
          Archived pairs cannot receive new assignments.
        </div>
      ) : null}

      {isChange ? (
        <div className="mb-4 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2.5 dark:border-warning-500/20 dark:bg-warning-500/5">
          <div className="flex gap-2">
            <Icon
              name="alertTriangle"
              size={15}
              className="mt-0.5 shrink-0 text-warning-600 dark:text-warning-400"
            />
            <div>
              <p className="text-[11px] font-semibold text-warning-800 dark:text-warning-300">
                This replaces the current assignment
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-warning-700/80 dark:text-warning-300/70">
                {currentStrategy ? `${currentStrategy.name} will be unassigned. ` : ''}
                {customizedCount > 0
                  ? `${customizedCount} pair-specific override${
                      customizedCount === 1 ? '' : 's'
                    } will be discarded. `
                  : 'Current default configuration will be replaced. '}
                The new strategy loads its declared defaults.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="mb-4 text-xs leading-5 text-secondary-500 dark:text-secondary-400">
          A new assignment record is created for this pair. The strategy&apos;s declared default
          parameters are loaded, and all values remain independently editable afterwards.
        </p>
      )}

      <div
        role="radiogroup"
        aria-label="Choose a strategy"
        className="max-h-[46vh] space-y-2 overflow-y-auto pr-1"
      >
        {(snapshot?.strategies ?? []).map((strategy) => {
          const selected = selectedId === strategy.id;
          const current = assignment?.strategyId === strategy.id;
          return (
            <label
              key={strategy.id}
              className={cn(
                'block cursor-pointer rounded-lg border p-3 transition-colors',
                selected
                  ? 'border-primary-400 bg-primary-50/50 ring-1 ring-primary-500/20 dark:border-primary-500/50 dark:bg-primary-500/5'
                  : 'border-secondary-200 bg-white hover:border-secondary-300 dark:border-secondary-800 dark:bg-secondary-900 dark:hover:border-secondary-700',
                !strategy.enabled && 'cursor-not-allowed opacity-70'
              )}
            >
              <div className="flex items-start gap-2.5">
                <input
                  type="radio"
                  name="strategy"
                  value={strategy.id}
                  checked={selected}
                  disabled={!strategy.enabled}
                  onChange={() => setSelectedId(strategy.id)}
                  className="mt-0.5 h-4 w-4 border-secondary-300 text-primary-600 focus:ring-primary-500 dark:border-secondary-600 dark:bg-secondary-900"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-secondary-900 dark:text-white">
                      {strategy.name}
                    </span>
                    <span className="text-[10px] tabular-nums text-secondary-400 dark:text-secondary-500">
                      v{strategy.version}
                    </span>
                    <Badge tone={strategy.enabled ? 'success' : 'neutral'}>
                      {strategy.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    {current ? <Badge tone="primary">Current</Badge> : null}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-secondary-500 dark:text-secondary-400">
                    {strategy.description}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-secondary-400 dark:text-secondary-500">
                    <span>{strategy.category}</span>
                    <span>{strategy.parameterSchema.length} parameters</span>
                    <span>{strategy.supportedMarkets.join(', ')}</span>
                    <span>{strategy.supportedTimeframes.join(', ')}</span>
                  </span>
                  {selected &&
                  (!strategy.supportedMarkets.includes(pair?.marketType ?? 'Forex') ||
                    !strategy.supportedTimeframes.includes(pair?.defaultTimeframe ?? 'M15')) ? (
                    <span className="mt-1 flex items-start gap-1 text-[10px] leading-4 text-warning-600 dark:text-warning-400">
                      <Icon name="alertTriangle" size={11} className="mt-0.5 shrink-0" />
                      This pair&apos;s market or default timeframe is outside the strategy&apos;s
                      declared support. Review the configuration before automation.
                    </span>
                  ) : null}
                </span>
              </div>
            </label>
          );
        })}
      </div>

      {sameStrategy ? (
        <p className="mt-3 text-[10px] text-secondary-500 dark:text-secondary-400">
          This strategy is already assigned. Choose a different definition to reassign.
        </p>
      ) : null}
    </Modal>
  );
}
