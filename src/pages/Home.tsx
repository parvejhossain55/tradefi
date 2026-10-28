import { Button } from '@/components';

export function Home(): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Welcome to React Template
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          A production-grade React template with TypeScript, Tailwind CSS, and best practices
        </p>
        <Button>Get Started</Button>
      </div>
    </div>
  );
}
