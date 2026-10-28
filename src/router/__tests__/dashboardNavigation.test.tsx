import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useTradingStore } from '@/store/tradingStore';
import { dashboardRoutes } from '@/router';

function renderApp(initialPath = '/') {
  const router = createMemoryRouter(dashboardRoutes, { initialEntries: [initialPath] });
  render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
  return router;
}

describe('dashboard navigation and forms', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.scrollTo = vi.fn();
    useTradingStore.setState({ snapshot: null, status: 'idle', error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders every dashboard route without errors', async () => {
    const router = renderApp();
    await waitFor(() => {
      expect(useTradingStore.getState().status).toBe('ready');
      expect(document.title).toContain('Overview');
    });

    const routes = [
      ['/trading-pairs', 'Trading Pairs'],
      ['/trading-pairs/pair_eurusd', 'Pair Details'],
      ['/strategies', 'Strategy Library'],
      ['/assignments', 'Strategy Assignments'],
      ['/monitor', 'Live Monitor'],
      ['/signals', 'Signals & Events'],
      ['/executions', 'Execution History'],
      ['/risk', 'Risk Management'],
      ['/settings', 'Global Settings'],
      ['/does-not-exist', 'Page not found'],
      ['/', 'Overview'],
    ] as const;

    for (const [path, title] of routes) {
      await act(async () => {
        await router.navigate(path);
      });
      await waitFor(() => expect(document.title).toContain(title));
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    }
  });

  it('creates a pair through the dialog and validates required fields', async () => {
    const user = userEvent.setup();
    renderApp('/trading-pairs');
    await waitFor(() => expect(document.title).toContain('Trading Pairs'));

    const listCount = useTradingStore.getState().snapshot?.pairs.length ?? 0;

    await user.click(screen.getByRole('button', { name: 'Create pair' }));
    let dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Create pair' }));
    expect(await within(dialog).findByText('Pair symbol is required.')).toBeInTheDocument();
    expect(within(dialog).getByText('Display name is required.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(useTradingStore.getState().snapshot?.pairs.length).toBe(listCount);

    await user.click(screen.getByRole('button', { name: 'Create pair' }));
    dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Pair symbol/), 'ZZTEST');
    await user.type(within(dialog).getByLabelText(/Display name/), 'Test Cross');
    await user.click(within(dialog).getByRole('button', { name: 'Create pair' }));

    await waitFor(() => {
      expect(
        useTradingStore.getState().snapshot?.pairs.some((pair) => pair.symbol === 'ZZTEST')
      ).toBe(true);
    });
    expect(await screen.findByText('Trading pair created')).toBeInTheDocument();
    expect(screen.getByText('ZZTEST')).toBeInTheDocument();
  });

  it('warns before discarding unsaved pair configuration changes', async () => {
    const user = userEvent.setup();
    renderApp('/trading-pairs/pair_eurusd?tab=configuration');
    await waitFor(() => expect(document.title).toContain('Pair Details'));
    expect(await screen.findByText('Pair-specific configuration')).toBeInTheDocument();

    const field = screen.getByRole('spinbutton', { name: /Swing left bars/ });
    await user.clear(field);
    await user.type(field, '31');

    await user.click(screen.getByRole('link', { name: /Back to trading pairs/ }));
    expect(await screen.findByText('Discard unsaved configuration?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stay on page' }));
    expect(screen.queryByText('Discard unsaved configuration?')).not.toBeInTheDocument();
    expect(document.title).toContain('Pair Details');

    await user.click(screen.getByRole('link', { name: /Back to trading pairs/ }));
    await screen.findByText('Discard unsaved configuration?');
    await user.click(screen.getByRole('button', { name: 'Discard and leave' }));
    await waitFor(() => expect(document.title).toContain('Trading Pairs'));
  });
});
