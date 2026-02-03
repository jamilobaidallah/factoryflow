import { renderHook, act } from '@testing-library/react';
import { useAsyncOperation } from '../use-async-operation';

// Mock error-handling (consolidated from error-handler)
jest.mock('../../error-handling', () => ({
  handleFirebaseErrorSimple: jest.fn((error) => ({
    title: 'Error',
    description: error.message || 'An error occurred',
    variant: 'destructive',
  })),
  logErrorSimple: jest.fn(),
}));

describe('useAsyncOperation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('starts with loading false', () => {
      const asyncFn = jest.fn();
      const { result } = renderHook(() => useAsyncOperation(asyncFn));

      expect(result.current.loading).toBe(false);
    });

    it('starts with data null', () => {
      const asyncFn = jest.fn();
      const { result } = renderHook(() => useAsyncOperation(asyncFn));

      expect(result.current.data).toBeNull();
    });

    it('starts with error null', () => {
      const asyncFn = jest.fn();
      const { result } = renderHook(() => useAsyncOperation(asyncFn));

      expect(result.current.error).toBeNull();
    });

    it('provides execute function', () => {
      const asyncFn = jest.fn();
      const { result } = renderHook(() => useAsyncOperation(asyncFn));

      expect(typeof result.current.execute).toBe('function');
    });

    it('provides reset function', () => {
      const asyncFn = jest.fn();
      const { result } = renderHook(() => useAsyncOperation(asyncFn));

      expect(typeof result.current.reset).toBe('function');
    });
  });

  describe('Successful Execution', () => {
    it('sets loading true during execution', async () => {
      let resolvePromise: (value: string) => void;
      const asyncFn = jest.fn(() => new Promise<string>((resolve) => {
        resolvePromise = resolve;
      }));

      const { result } = renderHook(() => useAsyncOperation(asyncFn));

      act(() => {
        result.current.execute();
      });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolvePromise!('success');
      });
    });

    it('sets loading false after completion', async () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const { result } = renderHook(() => useAsyncOperation(asyncFn));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.loading).toBe(false);
    });

    it('sets data after successful execution', async () => {
      const asyncFn = jest.fn().mockResolvedValue({ id: 1, name: 'Test' });
      const { result } = renderHook(() => useAsyncOperation(asyncFn));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.data).toEqual({ id: 1, name: 'Test' });
    });

    it('returns result from execute', async () => {
      const asyncFn = jest.fn().mockResolvedValue('result');
      const { result } = renderHook(() => useAsyncOperation<string>(asyncFn));

      let returnValue: string | undefined;
      await act(async () => {
        returnValue = await result.current.execute();
      });

      expect(returnValue).toBe('result');
    });

    it('calls onSuccess callback', async () => {
      const onSuccess = jest.fn();
      const asyncFn = jest.fn().mockResolvedValue('data');
      const { result } = renderHook(() =>
        useAsyncOperation(asyncFn, { onSuccess })
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(onSuccess).toHaveBeenCalledWith('data');
    });

    it('clears previous error on new execution', async () => {
      const asyncFn = jest.fn()
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce('success');

      const { result } = renderHook(() => useAsyncOperation(asyncFn));

      // First call fails
      await act(async () => {
        await result.current.execute();
      });
      expect(result.current.error).not.toBeNull();

      // Second call succeeds
      await act(async () => {
        await result.current.execute();
      });
      expect(result.current.error).toBeNull();
    });
  });

  describe('Failed Execution', () => {
    it('sets error on failure', async () => {
      const asyncFn = jest.fn().mockRejectedValue(new Error('Test error'));
      const { result } = renderHook(() => useAsyncOperation(asyncFn));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.description).toBe('Test error');
    });

    it('sets loading false on failure', async () => {
      const asyncFn = jest.fn().mockRejectedValue(new Error('Test error'));
      const { result } = renderHook(() => useAsyncOperation(asyncFn));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.loading).toBe(false);
    });

    it('sets data to null on failure', async () => {
      const asyncFn = jest.fn().mockRejectedValue(new Error('Test error'));
      const { result } = renderHook(() => useAsyncOperation(asyncFn));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.data).toBeNull();
    });

    it('returns undefined on failure', async () => {
      const asyncFn = jest.fn().mockRejectedValue(new Error('Test error'));
      const { result } = renderHook(() => useAsyncOperation(asyncFn));

      let returnValue: unknown;
      await act(async () => {
        returnValue = await result.current.execute();
      });

      expect(returnValue).toBeUndefined();
    });

    it('calls onError callback', async () => {
      const onError = jest.fn();
      const asyncFn = jest.fn().mockRejectedValue(new Error('Test error'));
      const { result } = renderHook(() =>
        useAsyncOperation(asyncFn, { onError })
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('Arguments', () => {
    it('passes arguments to async function', async () => {
      const asyncFn = jest.fn().mockResolvedValue('result');
      const { result } = renderHook(() => useAsyncOperation(asyncFn));

      await act(async () => {
        await result.current.execute('arg1', 'arg2', 123);
      });

      expect(asyncFn).toHaveBeenCalledWith('arg1', 'arg2', 123);
    });

    it('works with typed arguments', async () => {
      const asyncFn = jest.fn((id: string, count: number) =>
        Promise.resolve(`${id}-${count}`)
      );
      const { result } = renderHook(() =>
        useAsyncOperation<string, [string, number]>(asyncFn)
      );

      await act(async () => {
        await result.current.execute('test', 42);
      });

      expect(asyncFn).toHaveBeenCalledWith('test', 42);
      expect(result.current.data).toBe('test-42');
    });
  });

  describe('Reset', () => {
    it('resets data to null', async () => {
      const asyncFn = jest.fn().mockResolvedValue('data');
      const { result } = renderHook(() => useAsyncOperation(asyncFn));

      await act(async () => {
        await result.current.execute();
      });
      expect(result.current.data).toBe('data');

      act(() => {
        result.current.reset();
      });
      expect(result.current.data).toBeNull();
    });

    it('resets error to null', async () => {
      const asyncFn = jest.fn().mockRejectedValue(new Error('error'));
      const { result } = renderHook(() => useAsyncOperation(asyncFn));

      await act(async () => {
        await result.current.execute();
      });
      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.reset();
      });
      expect(result.current.error).toBeNull();
    });

    it('resets loading to false', async () => {
      const asyncFn = jest.fn().mockResolvedValue('data');
      const { result } = renderHook(() => useAsyncOperation(asyncFn));

      act(() => {
        result.current.reset();
      });
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Options', () => {
    it('uses default context when not provided', async () => {
      const { logErrorSimple: logError } = require('../../error-handling');
      const asyncFn = jest.fn().mockRejectedValue(new Error('error'));
      const { result } = renderHook(() => useAsyncOperation(asyncFn));

      await act(async () => {
        await result.current.execute();
      });

      expect(logError).toHaveBeenCalledWith('AsyncOperation', expect.any(Error));
    });

    it('uses custom context when provided', async () => {
      const { logErrorSimple: logError } = require('../../error-handling');
      const asyncFn = jest.fn().mockRejectedValue(new Error('error'));
      const { result } = renderHook(() =>
        useAsyncOperation(asyncFn, { context: 'CustomContext' })
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(logError).toHaveBeenCalledWith('CustomContext', expect.any(Error));
    });
  });
});
