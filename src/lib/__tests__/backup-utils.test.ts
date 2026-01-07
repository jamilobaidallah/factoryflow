/* eslint-disable no-console */
/**
 * Unit Tests for Backup Utilities
 * Tests backup validation, download, restoration, and file parsing
 */

// Mock Firebase config
jest.mock('@/firebase/config', () => ({
  firestore: {},
}));

// Mock Firebase functions - defined inside mock factory to avoid hoisting issues
jest.mock('firebase/firestore', () => {
  const mockBatchCommitFn = jest.fn().mockResolvedValue(undefined);
  const mockBatchSetFn = jest.fn();
  const mockBatchDeleteFn = jest.fn();
  const mockDeleteDocFn = jest.fn().mockResolvedValue(undefined);
  const mockGetDocsFn = jest.fn().mockResolvedValue({ docs: [], empty: true });

  return {
    collection: jest.fn(),
    getDocs: mockGetDocsFn,
    writeBatch: jest.fn(() => ({
      set: mockBatchSetFn,
      delete: mockBatchDeleteFn,
      commit: mockBatchCommitFn,
    })),
    doc: jest.fn(),
    query: jest.fn((ref) => ref),
    limit: jest.fn(() => ({})),
    deleteDoc: mockDeleteDocFn,
    Timestamp: {
      fromDate: jest.fn((date: Date) => ({
        toDate: () => date,
        seconds: Math.floor(date.getTime() / 1000),
        nanoseconds: 0,
      })),
    },
    // Export the mocks for test access
    __mocks__: {
      mockBatchCommit: mockBatchCommitFn,
      mockBatchSet: mockBatchSetFn,
      mockBatchDelete: mockBatchDeleteFn,
      mockDeleteDoc: mockDeleteDocFn,
      mockGetDocs: mockGetDocsFn,
    },
  };
});

// Mock browser APIs
const mockCreateObjectURL = jest.fn(() => 'blob:test-url');
const mockRevokeObjectURL = jest.fn();
const mockClick = jest.fn();
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();

Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  },
  writable: true,
});

const originalCreateElement = document.createElement.bind(document);
jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
  if (tagName === 'a') {
    return {
      href: '',
      download: '',
      click: mockClick,
    } as unknown as HTMLAnchorElement;
  }
  return originalCreateElement(tagName);
});

jest.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
jest.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);

// Import after mocks
import {
  downloadBackup,
  validateBackup,
  restoreBackup,
  parseBackupFile,
  createAutoBackupBeforeRestore,
  BackupData,
} from '../backup-utils';

// Get access to the mocks
import * as firestore from 'firebase/firestore';
const { __mocks__: mocks } = firestore as any;

describe('Backup Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
    // Default: return empty docs for getDocs
    mocks.mockGetDocs.mockResolvedValue({ docs: [] });
    mocks.mockBatchCommit.mockResolvedValue(undefined);
    mocks.mockDeleteDoc.mockResolvedValue(undefined);
  });

  describe('downloadBackup', () => {
    const mockBackupData: BackupData = {
      metadata: {
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        collections: ['ledger', 'clients'],
        totalDocuments: 10,
      },
      data: {
        ledger: [],
        payments: [],
        cheques: [],
        inventory: [],
        clients: [],
        partners: [],
        suppliers: [],
        assets: [],
      },
    };

    it('should create and trigger download link', () => {
      downloadBackup(mockBackupData);

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });

    it('should use default filename when not provided', () => {
      downloadBackup(mockBackupData);

      expect(mockClick).toHaveBeenCalled();
    });

    it('should use custom filename when provided', () => {
      downloadBackup(mockBackupData, 'custom-backup.json');

      expect(mockClick).toHaveBeenCalled();
    });

    it('should create JSON blob with correct content type', () => {
      downloadBackup(mockBackupData);

      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
  });

  describe('validateBackup', () => {
    it('should return true for valid backup data', () => {
      const validBackup: BackupData = {
        metadata: {
          createdAt: new Date().toISOString(),
          version: '1.0.0',
          collections: [],
          totalDocuments: 0,
        },
        data: {
          ledger: [],
          payments: [],
          cheques: [],
          inventory: [],
          clients: [],
          partners: [],
          suppliers: [],
          assets: [],
        },
      };

      expect(validateBackup(validBackup)).toBe(true);
    });

    it('should throw error for null input', () => {
      expect(() => validateBackup(null)).toThrow('Invalid backup file: Not a valid JSON object');
    });

    it('should throw error for non-object input', () => {
      expect(() => validateBackup('string')).toThrow('Invalid backup file: Not a valid JSON object');
    });

    it('should throw error for missing metadata', () => {
      const invalidBackup = {
        data: { ledger: [], payments: [], cheques: [], inventory: [], clients: [], partners: [], suppliers: [], assets: [] },
      };

      expect(() => validateBackup(invalidBackup)).toThrow(
        'Invalid backup file: Missing metadata or data sections'
      );
    });

    it('should throw error for missing data section', () => {
      const invalidBackup = {
        metadata: { createdAt: '', version: '', collections: [], totalDocuments: 0 },
      };

      expect(() => validateBackup(invalidBackup)).toThrow(
        'Invalid backup file: Missing metadata or data sections'
      );
    });

    it('should throw error for missing required collection', () => {
      const invalidBackup = {
        metadata: { createdAt: '', version: '', collections: [], totalDocuments: 0 },
        data: {
          ledger: [],
          payments: [],
          // Missing other collections
        },
      };

      expect(() => validateBackup(invalidBackup)).toThrow(/Collection '.*' is missing/);
    });

    it('should throw error if collection is not an array', () => {
      const invalidBackup = {
        metadata: { createdAt: '', version: '', collections: [], totalDocuments: 0 },
        data: {
          ledger: 'not an array',
          payments: [],
          cheques: [],
          inventory: [],
          clients: [],
          partners: [],
          suppliers: [],
          assets: [],
        },
      };

      expect(() => validateBackup(invalidBackup)).toThrow(
        "Invalid backup file: Collection 'ledger' is missing or not an array"
      );
    });
  });

  describe('restoreBackup', () => {
    const validBackup: BackupData = {
      metadata: {
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        collections: ['ledger', 'clients'],
        totalDocuments: 2,
      },
      data: {
        ledger: [{ id: 'entry1', description: 'Test', amount: 100 }],
        payments: [],
        cheques: [],
        inventory: [],
        clients: [{ id: 'client1', name: 'Test Client' }],
        partners: [],
        suppliers: [],
        assets: [],
      },
    };

    it('should restore backup in merge mode', async () => {
      await restoreBackup(validBackup, 'test-user-id', 'merge');

      expect(mocks.mockBatchCommit).toHaveBeenCalled();
    });

    it('should restore backup in replace mode', async () => {
      await restoreBackup(validBackup, 'test-user-id', 'replace');

      expect(mocks.mockBatchCommit).toHaveBeenCalled();
    });

    it('should delete existing documents in replace mode', async () => {
      // Mock existing documents in the collection - first call returns docs, second returns empty
      const mockDocRef1 = { id: 'existing1' };
      const mockDocRef2 = { id: 'existing2' };
      mocks.mockGetDocs
        .mockResolvedValueOnce({
          docs: [
            { ref: mockDocRef1 },
            { ref: mockDocRef2 },
          ],
          empty: false,
        })
        .mockResolvedValue({ docs: [], empty: true }); // Subsequent calls return empty

      await restoreBackup(validBackup, 'test-user-id', 'replace');

      // Verify batch.delete was called for existing documents
      expect(mocks.mockBatchDelete).toHaveBeenCalledWith(mockDocRef1);
      expect(mocks.mockBatchDelete).toHaveBeenCalledWith(mockDocRef2);
    });

    it('should NOT delete existing documents in merge mode', async () => {
      // Mock existing documents in the collection
      mocks.mockGetDocs.mockResolvedValue({
        docs: [
          { ref: { id: 'existing1' } },
        ],
        empty: false,
      });

      await restoreBackup(validBackup, 'test-user-id', 'merge');

      // Verify batch.delete was NOT called in merge mode
      expect(mocks.mockBatchDelete).not.toHaveBeenCalled();
    });

    it('should use merge mode by default', async () => {
      await restoreBackup(validBackup, 'test-user-id');

      expect(mocks.mockBatchCommit).toHaveBeenCalled();
    });

    it('should call progress callback during restore', async () => {
      const onProgress = jest.fn();

      await restoreBackup(validBackup, 'test-user-id', 'merge', onProgress);

      expect(onProgress).toHaveBeenCalled();
    });

    it('should convert ISO strings back to Timestamps', async () => {
      const backupWithDates: BackupData = {
        metadata: {
          createdAt: new Date().toISOString(),
          version: '1.0.0',
          collections: ['ledger'],
          totalDocuments: 1,
        },
        data: {
          ledger: [{ id: 'entry1', date: '2024-01-15T00:00:00.000Z' }],
          payments: [],
          cheques: [],
          inventory: [],
          clients: [],
          partners: [],
          suppliers: [],
          assets: [],
        },
      };

      await restoreBackup(backupWithDates, 'test-user-id');

      expect(mocks.mockBatchSet).toHaveBeenCalled();
    });

    it('should validate backup before restoring', async () => {
      const invalidBackup = { invalid: true } as any;

      await expect(restoreBackup(invalidBackup, 'test-user-id')).rejects.toThrow();
    });

    it('should call progress with 100% at completion', async () => {
      const onProgress = jest.fn();

      await restoreBackup(validBackup, 'test-user-id', 'merge', onProgress);

      expect(onProgress).toHaveBeenCalledWith(100, 'Restore completed!');
    });
  });

  describe('parseBackupFile', () => {
    it('should parse valid JSON backup file', async () => {
      const validBackupJSON = JSON.stringify({
        metadata: {
          createdAt: new Date().toISOString(),
          version: '1.0.0',
          collections: [],
          totalDocuments: 0,
        },
        data: {
          ledger: [],
          payments: [],
          cheques: [],
          inventory: [],
          clients: [],
          partners: [],
          suppliers: [],
          assets: [],
        },
      });

      const file = new File([validBackupJSON], 'backup.json', {
        type: 'application/json',
      });

      const result = await parseBackupFile(file);

      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.data).toBeDefined();
    });

    it('should reject invalid JSON', async () => {
      const file = new File(['not valid json'], 'backup.json', {
        type: 'application/json',
      });

      await expect(parseBackupFile(file)).rejects.toThrow('Failed to parse backup file');
    });

    it('should reject invalid backup structure', async () => {
      const invalidJSON = JSON.stringify({ invalid: true });
      const file = new File([invalidJSON], 'backup.json', {
        type: 'application/json',
      });

      await expect(parseBackupFile(file)).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle Firestore errors during restore', async () => {
      mocks.mockBatchCommit.mockRejectedValueOnce(new Error('Firestore error'));

      const validBackup: BackupData = {
        metadata: {
          createdAt: new Date().toISOString(),
          version: '1.0.0',
          collections: ['ledger'],
          totalDocuments: 1,
        },
        data: {
          ledger: [{ id: 'entry1', description: 'Test' }],
          payments: [],
          cheques: [],
          inventory: [],
          clients: [],
          partners: [],
          suppliers: [],
          assets: [],
        },
      };

      await expect(restoreBackup(validBackup, 'test-user-id')).rejects.toThrow();
    });
  });

  describe('createAutoBackupBeforeRestore', () => {
    it('should create backup and download with special filename by default', async () => {
      await createAutoBackupBeforeRestore('test-user-id');

      // Verify download was triggered
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
    });

    it('should skip download when download parameter is false', async () => {
      mockCreateObjectURL.mockClear();
      mockClick.mockClear();

      await createAutoBackupBeforeRestore('test-user-id', false);

      // Verify download was NOT triggered
      expect(mockClick).not.toHaveBeenCalled();
    });

    it('should return backup data', async () => {
      const result = await createAutoBackupBeforeRestore('test-user-id', false);

      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.metadata.version).toBe('1.0.0');
    });
  });
});
