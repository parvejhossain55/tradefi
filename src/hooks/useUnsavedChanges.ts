import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

export interface UnsavedChangesGuard {
  blocked: boolean;
  proceed: () => void;
  reset: () => void;
}

/**
 * Warns before client-side navigation and browser unload while a form has
 * unsaved changes. The rendered confirmation is owned by the page so it can
 * match the surrounding design.
 */
export function useUnsavedChanges(when: boolean): UnsavedChangesGuard {
  const blocker = useBlocker(when);

  useEffect(() => {
    if (!when) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [when]);

  return {
    blocked: blocker.state === 'blocked',
    proceed: () => {
      if (blocker.state === 'blocked') blocker.proceed();
    },
    reset: () => {
      if (blocker.state === 'blocked') blocker.reset();
    },
  };
}
