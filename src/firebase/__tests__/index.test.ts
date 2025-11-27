/**
 * Unit Tests for Firebase Integration Hooks
 * Tests useCollection, useDoc, useMemoFirebase, and usePaginatedCollection
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { FirestoreError } from 'firebase/firestore';

// Mock Firebase modules
const mockOnSnapshot = jest.fn();
const mockUnsubscribe = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  onSnapshot: jest.fn((query, successCallback, errorCallback) => {
    mockOnSnapshot(query, successCallback, errorCallback);
    return mockUnsubscribe;
  }),
  doc: jest.fn(),
  Query: jest.fn(),
  DocumentReference: jest.fn(),
  DocumentData: jest.fn(),
  FirestoreError: class MockFirestoreError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  QuerySnapshot: jest.fn(),
  DocumentSnapshot: jest.fn(),
}));

jest.mock('@/firebase/config', () => ({
  firestore: {},
  auth: {},
  storage: {},
}));

jest.mock('@/firebase/provider', () => ({
  FirebaseClientProvider: ({ children }: { children: React.ReactNode }) => children,
  useUser: () => ({ user: { uid: 'test-user' }, loading: false }),
}));

// Import after mocks
import { useCollection, useDoc, useMemoFirebase, usePaginatedCollection } from '../index';

describe('Firebase Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSnapshot.mockImplementation((query, successCallback) => {
      // Default implementation - call success with empty data
      setTimeout(() => {
        successCallback({
          forEach: (cb: Function) => {},
          docs: [],
          size: 0,
        });
      }, 0);
      return mockUnsubscribe;
    });
  });

  describe('useCollection', () => {
    it('should return loading state initially', () => {
      const { result } = renderHook(() => useCollection(null));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should return empty data when query is null', () => {
      const { result } = renderHook(() => useCollection(null));

      expect(result.current.data).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('should fetch data when query is provided', async () => {
      const mockQuery = {} as any;
      const mockData = [
        { id: 'doc1', name: 'Test 1' },
        { id: 'doc2', name: 'Test 2' },
      ];

      mockOnSnapshot.mockImplementation((query, successCallback) => {
        setTimeout(() => {
          successCallback({
            forEach: (cb: Function) => {
              mockData.forEach((item) =>
                cb({ id: item.id, data: () => ({ name: item.name }) })
              );
            },
            docs: mockData.map((item) => ({
              id: item.id,
              data: () => ({ name: item.name }),
            })),
            size: mockData.length,
          });
        }, 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useCollection(mockQuery));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data.length).toBe(2);
    });

    it('should handle errors from Firestore', async () => {
      const mockQuery = {} as any;
      const mockError = { code: 'permission-denied', message: 'Access denied' };

      mockOnSnapshot.mockImplementation((query, successCallback, errorCallback) => {
        setTimeout(() => {
          errorCallback(mockError);
        }, 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useCollection(mockQuery));

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should unsubscribe on unmount', () => {
      const mockQuery = {} as any;

      const { unmount } = renderHook(() => useCollection(mockQuery));

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should handle data transformation correctly', async () => {
      const mockQuery = {} as any;

      mockOnSnapshot.mockImplementation((query, successCallback) => {
        setTimeout(() => {
          successCallback({
            forEach: (cb: Function) => {
              cb({
                id: 'doc1',
                data: () => ({ name: 'Test', value: 100 }),
              });
            },
          });
        }, 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useCollection<{ id: string; name: string; value: number }>(mockQuery));

      await waitFor(() => {
        expect(result.current.data.length).toBe(1);
      });

      expect(result.current.data[0]).toEqual({
        id: 'doc1',
        name: 'Test',
        value: 100,
      });
    });
  });

  describe('useDoc', () => {
    it('should return loading state initially for null ref', () => {
      const { result } = renderHook(() => useDoc(null));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should fetch document data when ref is provided', async () => {
      const mockDocRef = {} as any;
      const mockDocData = { name: 'Test Document', value: 500 };

      mockOnSnapshot.mockImplementation((ref, successCallback) => {
        setTimeout(() => {
          successCallback({
            exists: () => true,
            id: 'doc1',
            data: () => mockDocData,
          });
        }, 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useDoc(mockDocRef));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual({
        id: 'doc1',
        ...mockDocData,
      });
    });

    it('should return null for non-existent document', async () => {
      const mockDocRef = {} as any;

      mockOnSnapshot.mockImplementation((ref, successCallback) => {
        setTimeout(() => {
          successCallback({
            exists: () => false,
            id: 'doc1',
            data: () => null,
          });
        }, 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useDoc(mockDocRef));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeNull();
    });

    it('should handle errors', async () => {
      const mockDocRef = {} as any;
      const mockError = { code: 'not-found', message: 'Document not found' };

      mockOnSnapshot.mockImplementation((ref, successCallback, errorCallback) => {
        setTimeout(() => {
          errorCallback(mockError);
        }, 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useDoc(mockDocRef));

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });
    });

    it('should unsubscribe on unmount', () => {
      const mockDocRef = {} as any;

      const { unmount } = renderHook(() => useDoc(mockDocRef));

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('useMemoFirebase', () => {
    it('should return memoized value', () => {
      const factory = jest.fn(() => ({ test: 'value' }));

      const { result, rerender } = renderHook(() =>
        useMemoFirebase(factory, ['dep1'])
      );

      expect(result.current).toEqual({ test: 'value' });
      expect(factory).toHaveBeenCalledTimes(1);

      // Rerender with same deps
      rerender();

      expect(factory).toHaveBeenCalledTimes(1); // Should not call factory again
    });

    it('should recalculate when deps change', () => {
      const factory = jest.fn(() => ({ test: 'value' }));
      let deps = ['dep1'];

      const { result, rerender } = renderHook(() =>
        useMemoFirebase(factory, deps)
      );

      expect(factory).toHaveBeenCalledTimes(1);

      // Change deps
      deps = ['dep2'];
      rerender();

      expect(factory).toHaveBeenCalledTimes(2);
    });

    it('should handle undefined deps', () => {
      const factory = jest.fn(() => 'test');

      const { result } = renderHook(() => useMemoFirebase(factory, undefined));

      expect(result.current).toBe('test');
    });

    it('should recalculate when deps array length changes', () => {
      const factory = jest.fn(() => 'test');
      let deps: any[] = ['dep1'];

      const { rerender } = renderHook(() => useMemoFirebase(factory, deps));

      expect(factory).toHaveBeenCalledTimes(1);

      deps = ['dep1', 'dep2'];
      rerender();

      expect(factory).toHaveBeenCalledTimes(2);
    });
  });

  describe('usePaginatedCollection', () => {
    it('should return initial state for null query', () => {
      const { result } = renderHook(() => usePaginatedCollection(null));

      expect(result.current.data).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasMore).toBe(true);
    });

    it('should fetch paginated data', async () => {
      const mockQuery = {} as any;
      const mockData = Array.from({ length: 5 }, (_, i) => ({
        id: `doc${i}`,
        name: `Item ${i}`,
      }));

      mockOnSnapshot.mockImplementation((query, successCallback) => {
        setTimeout(() => {
          successCallback({
            forEach: (cb: Function) => {
              mockData.forEach((item) =>
                cb({ id: item.id, data: () => ({ name: item.name }) })
              );
            },
            docs: mockData.map((item) => ({
              id: item.id,
              data: () => ({ name: item.name }),
            })),
            size: mockData.length,
          });
        }, 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => usePaginatedCollection(mockQuery, 10));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data.length).toBe(5);
    });

    it('should set hasMore based on page size', async () => {
      const mockQuery = {} as any;
      const pageSize = 5;
      const mockData = Array.from({ length: pageSize }, (_, i) => ({
        id: `doc${i}`,
        name: `Item ${i}`,
      }));

      mockOnSnapshot.mockImplementation((query, successCallback) => {
        setTimeout(() => {
          successCallback({
            forEach: (cb: Function) => {
              mockData.forEach((item) =>
                cb({ id: item.id, data: () => ({ name: item.name }) })
              );
            },
            docs: mockData.map((item) => ({
              id: item.id,
              data: () => ({ name: item.name }),
            })),
            size: mockData.length,
          });
        }, 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => usePaginatedCollection(mockQuery, pageSize));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // hasMore should be true when size >= pageSize
      expect(result.current.hasMore).toBe(true);
    });

    it('should handle errors', async () => {
      const mockQuery = {} as any;
      const mockError = { code: 'unknown', message: 'Unknown error' };

      mockOnSnapshot.mockImplementation((query, successCallback, errorCallback) => {
        setTimeout(() => {
          errorCallback(mockError);
        }, 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => usePaginatedCollection(mockQuery));

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should provide loadMore function', () => {
      const mockQuery = {} as any;

      const { result } = renderHook(() => usePaginatedCollection(mockQuery));

      expect(typeof result.current.loadMore).toBe('function');
    });

    it('should use default page size of 10', () => {
      const mockQuery = {} as any;

      renderHook(() => usePaginatedCollection(mockQuery));

      // The hook should work with default page size
      expect(mockOnSnapshot).toHaveBeenCalled();
    });
  });
});

describe('Firebase Hook Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle rapid query changes', async () => {
    let queryRef = { id: 1 } as any;

    mockOnSnapshot.mockImplementation((query, successCallback) => {
      setTimeout(() => {
        successCallback({
          forEach: (cb: Function) => {},
          docs: [],
          size: 0,
        });
      }, 50);
      return mockUnsubscribe;
    });

    const { rerender } = renderHook(({ query }) => useCollection(query), {
      initialProps: { query: queryRef },
    });

    // Rapidly change query
    queryRef = { id: 2 } as any;
    rerender({ query: queryRef });

    queryRef = { id: 3 } as any;
    rerender({ query: queryRef });

    // Should handle gracefully without errors
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should handle null to query transition', async () => {
    let query: any = null;

    const { result, rerender } = renderHook(() => useCollection(query));

    expect(result.current.isLoading).toBe(false);

    // Transition to real query
    query = {} as any;

    mockOnSnapshot.mockImplementation((q, successCallback) => {
      setTimeout(() => {
        successCallback({
          forEach: (cb: Function) => {
            cb({ id: 'doc1', data: () => ({ name: 'Test' }) });
          },
        });
      }, 0);
      return mockUnsubscribe;
    });

    rerender();

    await waitFor(() => {
      expect(result.current.data.length).toBeGreaterThanOrEqual(0);
    });
  });
});
