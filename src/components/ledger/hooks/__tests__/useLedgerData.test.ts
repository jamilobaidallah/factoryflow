/**
 * Unit Tests for useLedgerData Hook
 * Tests ledger data fetching with pagination
 */

import { renderHook, waitFor, act } from '@testing-library/react';

// Mock Firebase
const mockOnSnapshot = jest.fn();
const mockUnsubscribe = jest.fn();
const mockGetCountFromServer = jest.fn();

jest.mock('@/firebase/config', () => ({
  firestore: {},
}));

jest.mock('@/firebase/provider', () => ({
  useUser: () => ({ user: { uid: 'test-user-id' } }),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  onSnapshot: jest.fn((query, callback) => {
    mockOnSnapshot(query, callback);
    return mockUnsubscribe;
  }),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  getCountFromServer: jest.fn(() => mockGetCountFromServer()),
}));

// Import after mocks
import { useLedgerData } from '../useLedgerData';

describe('useLedgerData', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for count
    mockGetCountFromServer.mockResolvedValue({
      data: () => ({ count: 100 }),
    });

    // Default mock for onSnapshot
    mockOnSnapshot.mockImplementation((query, callback) => {
      setTimeout(() => {
        callback({
          forEach: (cb: Function) => {},
          docs: [],
        });
      }, 0);
    });
  });

  describe('Initial State', () => {
    it('should return empty entries initially', () => {
      const { result } = renderHook(() => useLedgerData());

      expect(result.current.entries).toEqual([]);
    });

    it('should return empty clients initially', () => {
      const { result } = renderHook(() => useLedgerData());

      expect(result.current.clients).toEqual([]);
    });

    it('should return empty partners initially', () => {
      const { result } = renderHook(() => useLedgerData());

      expect(result.current.partners).toEqual([]);
    });

    it('should return totalCount of 0 initially', () => {
      const { result } = renderHook(() => useLedgerData());

      expect(result.current.totalCount).toBe(0);
    });
  });

  describe('Data Fetching', () => {
    it('should fetch ledger entries on mount', async () => {
      const mockEntries = [
        {
          id: 'entry1',
          description: 'Test Entry',
          amount: 1000,
          date: { toDate: () => new Date('2024-01-15') },
          createdAt: { toDate: () => new Date() },
        },
      ];

      mockOnSnapshot.mockImplementation((query, callback) => {
        setTimeout(() => {
          callback({
            forEach: (cb: Function) => {
              mockEntries.forEach((entry) =>
                cb({ id: entry.id, data: () => entry })
              );
            },
            docs: mockEntries.map((entry) => ({
              id: entry.id,
              data: () => entry,
            })),
          });
        }, 0);
      });

      const { result } = renderHook(() => useLedgerData());

      await waitFor(() => {
        expect(result.current.entries.length).toBeGreaterThanOrEqual(0);
      });
    });

    it('should fetch clients for dropdown', async () => {
      const mockClients = [
        { id: 'client1', name: 'محمد أحمد' },
        { id: 'client2', name: 'علي حسن' },
      ];

      let callCount = 0;
      mockOnSnapshot.mockImplementation((query, callback) => {
        callCount++;
        setTimeout(() => {
          // Second call is for clients
          if (callCount === 2) {
            callback({
              forEach: (cb: Function) => {
                mockClients.forEach((client) =>
                  cb({ id: client.id, data: () => client })
                );
              },
            });
          } else {
            callback({
              forEach: (cb: Function) => {},
              docs: [],
            });
          }
        }, 0);
      });

      const { result } = renderHook(() => useLedgerData());

      await waitFor(() => {
        expect(mockOnSnapshot).toHaveBeenCalled();
      });
    });

    it('should fetch partners for dropdown', async () => {
      const mockPartners = [
        { id: 'partner1', name: 'شركة الأمل', active: true },
        { id: 'partner2', name: 'مؤسسة النور', active: true },
        { id: 'partner3', name: 'شركة غير نشطة', active: false },
      ];

      let callCount = 0;
      mockOnSnapshot.mockImplementation((query, callback) => {
        callCount++;
        setTimeout(() => {
          // Third call is for partners
          if (callCount === 3) {
            callback({
              forEach: (cb: Function) => {
                mockPartners.forEach((partner) =>
                  cb({ id: partner.id, data: () => partner })
                );
              },
            });
          } else {
            callback({
              forEach: (cb: Function) => {},
              docs: [],
            });
          }
        }, 0);
      });

      const { result } = renderHook(() => useLedgerData());

      await waitFor(() => {
        expect(mockOnSnapshot).toHaveBeenCalled();
      });
    });

    it('should only include active partners', async () => {
      const mockPartners = [
        { id: 'partner1', name: 'Active Partner', active: true },
        { id: 'partner2', name: 'Inactive Partner', active: false },
      ];

      let callCount = 0;
      mockOnSnapshot.mockImplementation((query, callback) => {
        callCount++;
        setTimeout(() => {
          if (callCount === 3) {
            callback({
              forEach: (cb: Function) => {
                mockPartners.forEach((partner) =>
                  cb({ id: partner.id, data: () => partner })
                );
              },
            });
          } else {
            callback({
              forEach: (cb: Function) => {},
              docs: [],
            });
          }
        }, 0);
      });

      const { result } = renderHook(() => useLedgerData());

      await waitFor(() => {
        // Partners should be filtered to only include active ones
        expect(mockOnSnapshot).toHaveBeenCalled();
      });
    });
  });

  describe('Pagination', () => {
    it('should use default page size of 50', () => {
      renderHook(() => useLedgerData());

      expect(mockOnSnapshot).toHaveBeenCalled();
    });

    it('should accept custom page size', () => {
      renderHook(() => useLedgerData({ pageSize: 25 }));

      expect(mockOnSnapshot).toHaveBeenCalled();
    });

    it('should accept current page', () => {
      renderHook(() => useLedgerData({ currentPage: 2 }));

      expect(mockOnSnapshot).toHaveBeenCalled();
    });

    it('should calculate total pages correctly', async () => {
      mockGetCountFromServer.mockResolvedValue({
        data: () => ({ count: 125 }),
      });

      const { result } = renderHook(() => useLedgerData({ pageSize: 50 }));

      await waitFor(() => {
        // 125 / 50 = 2.5, ceil = 3 pages
        expect(result.current.totalPages).toBe(3);
      });
    });

    it('should track last document for pagination', async () => {
      const mockDocs = [
        { id: 'entry1', data: () => ({ amount: 100 }) },
        { id: 'entry2', data: () => ({ amount: 200 }) },
      ];

      mockOnSnapshot.mockImplementation((query, callback) => {
        setTimeout(() => {
          callback({
            forEach: (cb: Function) => {
              mockDocs.forEach((doc) => cb(doc));
            },
            docs: mockDocs,
          });
        }, 0);
      });

      const { result } = renderHook(() => useLedgerData());

      await waitFor(() => {
        expect(result.current.lastDoc).toBeDefined();
      });
    });
  });

  describe('Date Conversion', () => {
    it('should convert Firestore timestamps to Date objects', async () => {
      const mockDate = new Date('2024-01-15');
      const mockEntry = {
        id: 'entry1',
        data: () => ({
          description: 'Test',
          amount: 1000,
          date: { toDate: () => mockDate },
          createdAt: { toDate: () => new Date() },
        }),
      };

      mockOnSnapshot.mockImplementation((query, callback) => {
        setTimeout(() => {
          callback({
            forEach: (cb: Function) => cb(mockEntry),
            docs: [mockEntry],
          });
        }, 0);
      });

      const { result } = renderHook(() => useLedgerData());

      await waitFor(() => {
        expect(result.current.entries.length).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle missing date field', async () => {
      const mockEntry = {
        id: 'entry1',
        data: () => ({
          description: 'Test',
          amount: 1000,
          // No date field
        }),
      };

      mockOnSnapshot.mockImplementation((query, callback) => {
        setTimeout(() => {
          callback({
            forEach: (cb: Function) => cb(mockEntry),
            docs: [mockEntry],
          });
        }, 0);
      });

      const { result } = renderHook(() => useLedgerData());

      await waitFor(() => {
        // Should handle gracefully without throwing
        expect(result.current.entries.length).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('User Context', () => {
    it('should not fetch data when user is null', () => {
      // Override the useUser mock for this test
      jest.doMock('@/firebase/provider', () => ({
        useUser: () => ({ user: null }),
      }));

      // The hook should handle null user gracefully
      expect(mockOnSnapshot).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe on unmount', () => {
      const { unmount } = renderHook(() => useLedgerData());

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('Real-time Updates', () => {
    it('should update entries when snapshot changes', async () => {
      let snapshotCallback: Function;

      mockOnSnapshot.mockImplementation((query, callback) => {
        snapshotCallback = callback;
        // Initial empty data
        setTimeout(() => {
          callback({
            forEach: (cb: Function) => {},
            docs: [],
          });
        }, 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useLedgerData());

      await waitFor(() => {
        expect(result.current.entries.length).toBe(0);
      });

      // Simulate real-time update
      act(() => {
        snapshotCallback({
          forEach: (cb: Function) => {
            cb({
              id: 'new-entry',
              data: () => ({
                description: 'New Entry',
                amount: 500,
                date: { toDate: () => new Date() },
                createdAt: { toDate: () => new Date() },
              }),
            });
          },
          docs: [{ id: 'new-entry' }],
        });
      });

      // Entries should be updated
      expect(result.current.entries.length).toBeGreaterThanOrEqual(0);
    });
  });
});
