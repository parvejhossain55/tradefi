import { Button } from '@/components';

export function About(): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center max-w-2xl px-4">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">About</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          This is a production-grade React template built with TypeScript, Tailwind CSS, and best
          practices.
        </p>
        <Button>Learn More</Button>
      </div>
    </div>
  );
}
