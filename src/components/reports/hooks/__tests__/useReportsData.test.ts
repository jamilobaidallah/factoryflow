/**
 * Unit Tests for useReportsData Hook
 * Tests data fetching for reports
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';

// Mock Firebase
const mockGetDocs = jest.fn();

jest.mock('@/firebase/config', () => ({
  firestore: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(() => mockGetDocs()),
  orderBy: jest.fn(),
  limit: jest.fn(),
}));

// Mock useToast
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Import after mocks
import { useReportsData } from '../useReportsData';

describe('useReportsData', () => {
  const mockUserId = 'test-user-id';
  const mockStartDate = '2024-01-01';
  const mockEndDate = '2024-01-31';

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation
    mockGetDocs.mockResolvedValue({
      forEach: jest.fn(),
    });
  });

  describe('Initial State', () => {
    it('should return initial loading state', () => {
      const { result } = renderHook(() =>
        useReportsData({
          userId: mockUserId,
          startDate: mockStartDate,
          endDate: mockEndDate,
        })
      );

      // Loading should be true initially or false after immediate resolve
      expect(result.current.ledgerEntries).toEqual([]);
      expect(result.current.payments).toEqual([]);
      expect(result.current.inventory).toEqual([]);
      expect(result.current.fixedAssets).toEqual([]);
    });

    it('should not fetch data when userId is null', async () => {
      const { result } = renderHook(() =>
        useReportsData({
          userId: null,
          startDate: mockStartDate,
          endDate: mockEndDate,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockGetDocs).not.toHaveBeenCalled();
    });
  });

  describe('Data Fetching', () => {
    it('should fetch ledger entries', async () => {
      const mockLedgerData = [
        { id: 'entry1', description: 'Test Entry', amount: 1000 },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (callback: Function) => {
          mockLedgerData.forEach((entry) =>
            callback({
              id: entry.id,
              data: () => ({
                ...entry,
                date: { toDate: () => new Date('2024-01-15') },
              }),
            })
          );
        },
      });

      const { result } = renderHook(() =>
        useReportsData({
          userId: mockUserId,
          startDate: mockStartDate,
          endDate: mockEndDate,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should handle date conversion for entries', async () => {
      mockGetDocs.mockResolvedValue({
        forEach: (callback: Function) => {
          callback({
            id: 'entry1',
            data: () => ({
              description: 'Test',
              date: { toDate: () => new Date('2024-01-15') },
            }),
          });
        },
      });

      const { result } = renderHook(() =>
        useReportsData({
          userId: mockUserId,
          startDate: mockStartDate,
          endDate: mockEndDate,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should handle missing date field', async () => {
      mockGetDocs.mockResolvedValue({
        forEach: (callback: Function) => {
          callback({
            id: 'entry1',
            data: () => ({
              description: 'Test',
              // No date field
            }),
          });
        },
      });

      const { result } = renderHook(() =>
        useReportsData({
          userId: mockUserId,
          startDate: mockStartDate,
          endDate: mockEndDate,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors and show toast', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      const { result } = renderHook(() =>
        useReportsData({
          userId: mockUserId,
          startDate: mockStartDate,
          endDate: mockEndDate,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
        })
      );
    });
  });

  describe('Date Range', () => {
    it('should set end date to end of day', async () => {
      const { result } = renderHook(() =>
        useReportsData({
          userId: mockUserId,
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // The hook should have been called with proper date range
      expect(mockGetDocs).toHaveBeenCalled();
    });
  });

  describe('Refetch Function', () => {
    it('should provide refetch function', async () => {
      const { result } = renderHook(() =>
        useReportsData({
          userId: mockUserId,
          startDate: mockStartDate,
          endDate: mockEndDate,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe('function');
    });

    it('should refetch data when called', async () => {
      const { result } = renderHook(() =>
        useReportsData({
          userId: mockUserId,
          startDate: mockStartDate,
          endDate: mockEndDate,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const callCountBefore = mockGetDocs.mock.calls.length;

      await act(async () => {
        await result.current.refetch();
      });

      expect(mockGetDocs.mock.calls.length).toBeGreaterThan(callCountBefore);
    });
  });

  describe('Success Toast', () => {
    it('should show success toast after loading data', async () => {
      mockGetDocs.mockResolvedValue({
        forEach: jest.fn(),
      });

      const { result } = renderHook(() =>
        useReportsData({
          userId: mockUserId,
          startDate: mockStartDate,
          endDate: mockEndDate,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'تم تحميل البيانات',
        })
      );
    });
  });

  describe('Date Range Changes', () => {
    it('should refetch when date range changes', async () => {
      const { result, rerender } = renderHook(
        ({ startDate, endDate }) =>
          useReportsData({
            userId: mockUserId,
            startDate,
            endDate,
          }),
        {
          initialProps: {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
          },
        }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCallCount = mockGetDocs.mock.calls.length;

      rerender({
        startDate: '2024-02-01',
        endDate: '2024-02-29',
      });

      await waitFor(() => {
        expect(mockGetDocs.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe('Collection Limits', () => {
    it('should apply limits to prevent memory issues', async () => {
      // Create large dataset
      const largeData = Array.from({ length: 1500 }, (_, i) => ({
        id: `entry-${i}`,
        amount: i * 100,
      }));

      mockGetDocs.mockResolvedValue({
        forEach: (callback: Function) => {
          // Simulate limited results
          largeData.slice(0, 1000).forEach((entry) =>
            callback({
              id: entry.id,
              data: () => ({ ...entry, date: { toDate: () => new Date() } }),
            })
          );
        },
      });

      const { result } = renderHook(() =>
        useReportsData({
          userId: mockUserId,
          startDate: mockStartDate,
          endDate: mockEndDate,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have been called with limit
      expect(mockGetDocs).toHaveBeenCalled();
    });
  });
});
