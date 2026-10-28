import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StrategyParameterFields } from '../StrategyParameterFields';
import type { StrategyParameterDefinition } from '@/types/trading';

const schema: StrategyParameterDefinition[] = [
  {
    key: 'swing_left_bars',
    label: 'Swing left bars',
    description: 'Bars to the left used for the swing.',
    type: 'integer',
    required: true,
    defaultValue: 20,
    min: 2,
    max: 200,
    group: 'Structure',
  },
  {
    key: 'confirmation_mode',
    label: 'Confirmation mode',
    type: 'select',
    required: true,
    defaultValue: 'Wick rejection',
    options: ['Wick rejection', 'Displacement'],
    group: 'Entry',
  },
  {
    key: 'use_break_even',
    label: 'Move to break-even',
    type: 'boolean',
    required: false,
    defaultValue: false,
    group: 'Risk',
  },
];

describe('StrategyParameterFields', () => {
  it('renders groups and field controls from the schema', () => {
    render(
      <StrategyParameterFields
        schema={schema}
        values={{ swing_left_bars: 30, confirmation_mode: 'Displacement', use_break_even: true }}
        customizedKeys={['swing_left_bars']}
        onChange={() => undefined}
      />
    );
    expect(screen.getByText('Structure')).toBeInTheDocument();
    expect(screen.getByText('Entry')).toBeInTheDocument();
    expect(screen.getByLabelText(/Swing left bars/)).toHaveValue(30);
    expect(screen.getByLabelText(/Confirmation mode/)).toHaveValue('Displacement');
    expect(screen.getByRole('switch', { name: 'Move to break-even' })).toBeChecked();
  });

  it('marks inherited and customized parameters distinctly', () => {
    render(
      <StrategyParameterFields
        schema={schema}
        values={{ swing_left_bars: 30, confirmation_mode: 'Wick rejection', use_break_even: false }}
        customizedKeys={['swing_left_bars']}
        onChange={() => undefined}
        onRevert={() => undefined}
      />
    );
    expect(screen.getByText('Customized')).toBeInTheDocument();
    expect(screen.getAllByText('Inherited').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Revert Swing left bars/ })).toBeInTheDocument();
  });

  it('emits typed numeric and boolean values', () => {
    const onChange = vi.fn();
    render(
      <StrategyParameterFields
        schema={schema}
        values={{ swing_left_bars: 20, confirmation_mode: 'Wick rejection', use_break_even: false }}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByLabelText(/Swing left bars/), { target: { value: '35' } });
    expect(onChange).toHaveBeenCalledWith('swing_left_bars', 35);
    fireEvent.click(screen.getByRole('switch', { name: 'Move to break-even' }));
    expect(onChange).toHaveBeenCalledWith('use_break_even', true);
  });

  it('renders validation errors and supports reverting an override', () => {
    const onRevert = vi.fn();
    render(
      <StrategyParameterFields
        schema={schema}
        values={{
          swing_left_bars: 999,
          confirmation_mode: 'Wick rejection',
          use_break_even: false,
        }}
        customizedKeys={['swing_left_bars']}
        errors={{ swing_left_bars: 'Must be at most 200.' }}
        onChange={() => undefined}
        onRevert={onRevert}
      />
    );
    expect(screen.getByText('Must be at most 200.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Revert Swing left bars/ }));
    expect(onRevert).toHaveBeenCalledWith('swing_left_bars');
  });
});
