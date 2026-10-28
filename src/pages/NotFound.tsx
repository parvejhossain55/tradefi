import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { buttonClasses } from '@/utils/button';

export function NotFound() {
  return (
    <div>
      <PageHeader title="Page not found" />
      <Card>
        <EmptyState
          icon="alertCircle"
          title="404 — this page does not exist"
          description="The requested route is not part of this demo workspace. Return to the overview to continue."
          action={
            <Link to="/" className={buttonClasses('primary', 'sm')}>
              Back to overview
            </Link>
          }
        />
      </Card>
    </div>
  );
}
