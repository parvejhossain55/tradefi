import { cn } from '@/utils/cn';

export interface ChartDatum {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  items: ChartDatum[];
  centerLabel: string;
  centerValue?: string;
  ariaLabel?: string;
  showLegend?: boolean;
}

export function DonutChart({
  items,
  centerLabel,
  centerValue,
  ariaLabel,
  showLegend = true,
}: DonutChartProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative h-32 w-32 shrink-0">
        <svg
          viewBox="0 0 140 140"
          className="h-full w-full"
          role="img"
          aria-label={
            ariaLabel ??
            `${items.map((item) => `${item.label}: ${item.value}`).join(', ')}. Total ${total}.`
          }
        >
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            strokeWidth="15"
            className="stroke-secondary-100 dark:stroke-secondary-800"
          />
          {total > 0
            ? items.map((item) => {
                const dash = (item.value / total) * circumference;
                const element = (
                  <circle
                    key={item.label}
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="15"
                    strokeLinecap="butt"
                    strokeDasharray={`${Math.max(dash - 2, 0)} ${circumference - Math.max(dash - 2, 0)}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 70 70)"
                  />
                );
                offset += dash;
                return element;
              })
            : null}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold tabular-nums text-secondary-900 dark:text-white">
            {centerValue ?? total}
          </span>
          <span className="mt-0.5 max-w-[76px] text-center text-[10px] leading-3 text-secondary-500 dark:text-secondary-400">
            {centerLabel}
          </span>
        </div>
      </div>
      {showLegend ? (
        <ul className="min-w-[130px] flex-1 space-y-1.5">
          {items.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-center gap-2 text-secondary-600 dark:text-secondary-300">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="font-medium tabular-nums text-secondary-900 dark:text-white">
                {item.value}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 border-t border-secondary-100 pt-1.5 text-xs dark:border-secondary-800">
            <span className="text-secondary-500 dark:text-secondary-400">Total</span>
            <span className="font-medium tabular-nums text-secondary-900 dark:text-white">
              {total}
            </span>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  colorClass?: string;
  hint?: string;
}

interface BarListProps {
  items: BarDatum[];
  emptyMessage?: string;
}

export function BarList({ items, emptyMessage = 'No usage data yet.' }: BarListProps) {
  const max = Math.max(...items.map((item) => item.value), 0);

  if (items.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-secondary-500 dark:text-secondary-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-end justify-between gap-3">
            <span className="truncate text-xs font-medium text-secondary-700 dark:text-secondary-300">
              {item.label}
            </span>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-secondary-900 dark:text-white">
              {item.value}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary-100 dark:bg-secondary-800">
            <div
              className={cn('h-full rounded-full bg-primary-500', item.colorClass)}
              style={{ width: `${max > 0 ? (item.value / max) * 100 : 0}%` }}
            />
          </div>
          {item.hint ? (
            <p className="mt-1 text-[10px] text-secondary-500 dark:text-secondary-400">
              {item.hint}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
