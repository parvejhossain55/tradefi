import { Icon } from './Icon';
import { cn } from '@/utils/cn';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  ariaLabel = 'Search',
  className,
}: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Icon
        name="search"
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400"
      />
      <input
        type="search"
        value={value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) onChange('');
        }}
        className="block h-9 w-full rounded-lg border border-secondary-300 bg-white py-1.5 pl-9 pr-8 text-sm text-secondary-900 shadow-sm transition-colors placeholder:text-secondary-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-secondary-700 dark:bg-secondary-900 dark:text-secondary-100 dark:placeholder:text-secondary-500"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-secondary-400 transition-colors hover:text-secondary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:text-secondary-200"
        >
          <Icon name="close" size={13} />
        </button>
      ) : null}
    </div>
  );
}
