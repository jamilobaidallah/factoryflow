/**
 * Unit Tests for useLedgerData Hook
 * Tests ledger data fetching with pagination
 *
 * NOTE: useLedgerData now uses React Query hooks internally via useLedgerPageData.
 * These tests mock the useLedgerPageData hook directly.
 */

import { renderHook } from '@testing-library/react';
import type { DocumentSnapshot } from 'firebase/firestore';

// Types for mock data
interface MockEntry {
  id: string;
  description?: string;
  amount?: number;
  date?: Date;
  createdAt?: Date;
}

interface MockNamedEntity {
  id: string;
  name: string;
}

interface MockLedgerPageData {
  entries: MockEntry[];
  allEntriesForStats: MockEntry[];
  clients: MockNamedEntity[];
  partners: MockNamedEntity[];
  totalCount: number;
  totalPages: number;
  lastDoc: DocumentSnapshot | null;
  loading: boolean;
  statsLoading: boolean;
}

// Default mock data
const defaultMockData: MockLedgerPageData = {
  entries: [],
  allEntriesForStats: [],
  clients: [],
  partners: [],
  totalCount: 0,
  totalPages: 0,
  lastDoc: null,
  loading: false,
  statsLoading: false,
};

// Mock the useLedgerPageData hook from firebase-query
const mockUseLedgerPageData = jest.fn<MockLedgerPageData, [{ pageSize?: number; currentPage?: number }?]>(() => defaultMockData);

jest.mock('@/hooks/firebase-query', () => ({
  useLedgerPageData: (options?: { pageSize?: number; currentPage?: number }) =>
    mockUseLedgerPageData(options),
}));

// Import after mocks
import { useLedgerData } from '../useLedgerData';

describe('useLedgerData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLedgerPageData.mockReturnValue(defaultMockData);
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

    it('should return totalPages of 0 initially', () => {
      const { result } = renderHook(() => useLedgerData());

      expect(result.current.totalPages).toBe(0);
    });

    it('should return loading as false when data is available', () => {
      const { result } = renderHook(() => useLedgerData());

      expect(result.current.loading).toBe(false);
    });
  });

  describe('Data Fetching', () => {
    it('should return ledger entries from the hook', () => {
      const mockEntries = [
        {
          id: 'entry1',
          description: 'Test Entry',
          amount: 1000,
          date: new Date('2024-01-15'),
          createdAt: new Date(),
        },
      ];

      mockUseLedgerPageData.mockReturnValue({
        ...defaultMockData,
        entries: mockEntries,
      });

      const { result } = renderHook(() => useLedgerData());

      expect(result.current.entries).toEqual(mockEntries);
    });

    it('should return clients for dropdown', () => {
      const mockClients = [
        { id: 'client1', name: 'محمد أحمد' },
        { id: 'client2', name: 'علي حسن' },
      ];

      mockUseLedgerPageData.mockReturnValue({
        ...defaultMockData,
        clients: mockClients,
      });

      const { result } = renderHook(() => useLedgerData());

      expect(result.current.clients).toEqual(mockClients);
    });

    it('should return partners for dropdown', () => {
      const mockPartners = [
        { id: 'partner1', name: 'شركة الأمل' },
        { id: 'partner2', name: 'مؤسسة النور' },
      ];

      mockUseLedgerPageData.mockReturnValue({
        ...defaultMockData,
        partners: mockPartners,
      });

      const { result } = renderHook(() => useLedgerData());

      expect(result.current.partners).toEqual(mockPartners);
    });

    it('should return allEntriesForStats for stats calculation', () => {
      const mockStats = [
        { id: 'entry1', amount: 1000 },
        { id: 'entry2', amount: 2000 },
      ];

      mockUseLedgerPageData.mockReturnValue({
        ...defaultMockData,
        allEntriesForStats: mockStats,
      });

      const { result } = renderHook(() => useLedgerData());

      expect(result.current.allEntriesForStats).toEqual(mockStats);
    });
  });

  describe('Pagination', () => {
    it('should use default page size of 50', () => {
      renderHook(() => useLedgerData());

      expect(mockUseLedgerPageData).toHaveBeenCalledWith({
        pageSize: 50,
        currentPage: 1,
      });
    });

    it('should accept custom page size', () => {
      renderHook(() => useLedgerData({ pageSize: 25 }));

      expect(mockUseLedgerPageData).toHaveBeenCalledWith({
        pageSize: 25,
        currentPage: 1,
      });
    });

    it('should accept current page', () => {
      renderHook(() => useLedgerData({ currentPage: 2 }));

      expect(mockUseLedgerPageData).toHaveBeenCalledWith({
        pageSize: 50,
        currentPage: 2,
      });
    });

    it('should return total pages from the hook', () => {
      mockUseLedgerPageData.mockReturnValue({
        ...defaultMockData,
        totalCount: 125,
        totalPages: 3,
      });

      const { result } = renderHook(() => useLedgerData({ pageSize: 50 }));

      expect(result.current.totalPages).toBe(3);
    });

    it('should return last document for pagination', () => {
      const mockLastDoc = { id: 'last-doc' } as unknown as DocumentSnapshot;

      mockUseLedgerPageData.mockReturnValue({
        ...defaultMockData,
        lastDoc: mockLastDoc,
      });

      const { result } = renderHook(() => useLedgerData());

      expect(result.current.lastDoc).toBe(mockLastDoc);
    });
  });

  describe('Loading States', () => {
    it('should return loading state', () => {
      mockUseLedgerPageData.mockReturnValue({
        ...defaultMockData,
        loading: true,
      });

      const { result } = renderHook(() => useLedgerData());

      expect(result.current.loading).toBe(true);
    });

    it('should return stats loading state', () => {
      mockUseLedgerPageData.mockReturnValue({
        ...defaultMockData,
        statsLoading: true,
      });

      const { result } = renderHook(() => useLedgerData());

      expect(result.current.statsLoading).toBe(true);
    });
  });

  describe('Hook Interface', () => {
    it('should pass options to useLedgerPageData', () => {
      renderHook(() => useLedgerData({ pageSize: 100, currentPage: 5 }));

      expect(mockUseLedgerPageData).toHaveBeenCalledWith({
        pageSize: 100,
        currentPage: 5,
      });
    });

    it('should return all required fields', () => {
      const { result } = renderHook(() => useLedgerData());

      expect(result.current).toHaveProperty('entries');
      expect(result.current).toHaveProperty('allEntriesForStats');
      expect(result.current).toHaveProperty('clients');
      expect(result.current).toHaveProperty('partners');
      expect(result.current).toHaveProperty('totalCount');
      expect(result.current).toHaveProperty('lastDoc');
      expect(result.current).toHaveProperty('totalPages');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('statsLoading');
    });
  });
});
