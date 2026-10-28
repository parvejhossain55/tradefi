import { create } from 'zustand';
import { createId } from '@/utils/trading';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (input: ToastInput) => string;
  removeToast: (id: string) => void;
}

const AUTO_DISMISS_MS = 4500;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  addToast: (input) => {
    const id = createId('toast');
    set((state) => ({
      toasts: [
        ...state.toasts.slice(-3),
        {
          id,
          title: input.title,
          description: input.description,
          tone: input.tone ?? 'success',
        },
      ],
    }));
    window.setTimeout(() => get().removeToast(id), AUTO_DISMISS_MS);
    return id;
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toastItem) => toastItem.id !== id) })),
}));

export function notify(input: ToastInput): string {
  return useToastStore.getState().addToast(input);
}

export function notifyError(error: unknown, fallback = 'Something went wrong.'): void {
  notify({
    tone: 'error',
    title: 'Action not completed',
    description: error instanceof Error && error.message ? error.message : fallback,
  });
}
