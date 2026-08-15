import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import ErrorBoundary from '../../components/ErrorBoundary';

function Bomb() {
  throw new Error('kaboom');
}

describe('ErrorBoundary', () => {
  it('catches render errors and shows a friendly message with retry', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    act(() => {
      root.render(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>
      );
    });
    expect(container.textContent).toContain('Something went wrong');
    expect(container.textContent).toContain('kaboom');
    expect(container.querySelector('button')?.textContent).toBe('Retry');

    consoleSpy.mockRestore();
    document.body.removeChild(container);
  });
});
