import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/Button';
import { Icon } from './Icon';
import { cn } from '@/utils/cn';

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  initialSort?: { key: string; direction: 'asc' | 'desc' };
  pageSize?: number;
  emptyState?: ReactNode;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  rowClassName?: (row: T) => string | undefined;
  className?: string;
  resetKey?: string;
}

const alignClasses = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export function DataTable<T>({
  data,
  columns,
  rowKey,
  initialSort,
  pageSize = 8,
  emptyState,
  loading = false,
  onRowClick,
  rowLabel,
  rowClassName,
  className,
  resetKey,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const sortedData = useMemo(() => {
    if (!sort) return data;
    const column = columns.find((candidate) => candidate.key === sort.key);
    if (!column?.sortValue) return data;
    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...data].sort((left, right) => {
      const leftValue = column.sortValue?.(left);
      const rightValue = column.sortValue?.(right);
      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return (leftValue - rightValue) * direction;
      }
      return (
        String(leftValue ?? '').localeCompare(String(rightValue ?? ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        }) * direction
      );
    });
  }, [columns, data, sort]);

  const pageCount = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleRows = sortedData.slice((safePage - 1) * pageSize, safePage * pageSize);
  const start = sortedData.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, sortedData.length);

  const toggleSort = (key: string) => {
    setSort((current) => {
      if (current?.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  return (
    <div className={cn('min-w-0', className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-secondary-200 text-sm dark:divide-secondary-800">
          <thead className="bg-secondary-50 dark:bg-secondary-950/40">
            <tr>
              {columns.map((column) => {
                const isSorted = sort?.key === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    className={cn(
                      'whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-secondary-500 dark:text-secondary-400',
                      alignClasses[column.align ?? 'left'],
                      column.headerClassName
                    )}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className={cn(
                          'inline-flex items-center gap-1 transition-colors hover:text-secondary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:text-secondary-100',
                          column.align === 'right' && 'flex-row-reverse'
                        )}
                      >
                        {column.header}
                        <Icon
                          name={isSorted ? 'chevronDown' : 'arrowUpDown'}
                          size={11}
                          className={cn(
                            isSorted
                              ? 'text-primary-600 dark:text-primary-400'
                              : 'text-secondary-400 opacity-60',
                            isSorted && sort.direction === 'asc' && 'rotate-180'
                          )}
                        />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-100 dark:divide-secondary-800">
            {loading ? (
              Array.from({ length: 5 }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`}>
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3">
                      <div className="h-3.5 w-full max-w-[120px] animate-pulse rounded bg-secondary-200 dark:bg-secondary-800" />
                    </td>
                  ))}
                </tr>
              ))
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10">
                  <div className="text-center text-sm text-secondary-500 dark:text-secondary-400">
                    {emptyState ?? 'No records found.'}
                  </div>
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const key = rowKey(row);
                return (
                  <tr
                    key={key}
                    tabIndex={onRowClick ? 0 : undefined}
                    aria-label={onRowClick ? rowLabel?.(row) : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      'transition-colors hover:bg-secondary-50/80 dark:hover:bg-secondary-800/40',
                      onRowClick &&
                        'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500',
                      rowClassName?.(row)
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          'px-4 py-2.5 align-middle text-secondary-700 dark:text-secondary-300',
                          alignClasses[column.align ?? 'left'],
                          column.className
                        )}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {!loading && sortedData.length > pageSize ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-secondary-200 px-4 py-2.5 dark:border-secondary-800">
          <p className="text-[11px] tabular-nums text-secondary-500 dark:text-secondary-400">
            Showing {start}–{end} of {sortedData.length}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] tabular-nums text-secondary-500 dark:text-secondary-400">
              Page {safePage} of {pageCount}
            </span>
            <Button
              variant="secondary"
              size="xs"
              icon="chevronLeft"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
            >
              Prev
            </Button>
            <Button
              variant="secondary"
              size="xs"
              iconRight="chevronRight"
              disabled={safePage >= pageCount}
              onClick={() => setPage(safePage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
