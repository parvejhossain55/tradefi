import { Button } from '@/components';

export function Contact(): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center max-w-2xl px-4">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Contact</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Get in touch with us for any questions or feedback.
        </p>
        <Button>Send Message</Button>
      </div>
    </div>
  );
}
