import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns initial value when no stored value exists', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    expect(result.current[0]).toBe('initial');
  });

  it('returns stored value when it exists', () => {
    localStorage.setItem('test-key', JSON.stringify('stored'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    expect(result.current[0]).toBe('stored');
  });

  it('updates localStorage when value changes', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    act(() => {
      result.current[1]('updated');
    });
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify('updated'));
  });

  it('handles complex objects', () => {
    const initialObj = { name: 'test', count: 0 };
    const { result } = renderHook(() => useLocalStorage('obj-key', initialObj));

    act(() => {
      result.current[1]({ ...initialObj, count: 1 });
    });

    expect(result.current[0]).toEqual({ name: 'test', count: 1 });
  });
});
