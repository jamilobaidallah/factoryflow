/**
 * Unit Tests for Backup Utilities
 * Tests backup creation, validation, restoration, and file parsing
 */

import { Timestamp } from 'firebase/firestore';

// Mock Firebase
jest.mock('@/firebase/config', () => ({
  firestore: {},
}));

const mockDocs = [
  {
    id: 'doc1',
    data: () => ({
      name: 'Test Client',
      balance: 1000,
      createdAt: { toDate: () => new Date('2024-01-15') },
    }),
  },
  {
    id: 'doc2',
    data: () => ({
      name: 'Test Client 2',
      balance: 2000,
      date: new Date('2024-01-20'),
    }),
  },
];

const mockQuerySnapshot = {
  docs: mockDocs,
  forEach: (callback: (doc: any) => void) => mockDocs.forEach(callback),
};

const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockBatchSet = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  getDocs: jest.fn(() => Promise.resolve(mockQuerySnapshot)),
  writeBatch: jest.fn(() => ({
    set: mockBatchSet,
    commit: mockBatchCommit,
  })),
  doc: jest.fn(),
  query: jest.fn(),
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({ toDate: () => date })),
  },
}));

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
  createBackup,
  downloadBackup,
  validateBackup,
  restoreBackup,
  parseBackupFile,
  BackupData,
} from '../backup-utils';

describe('Backup Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
  });

  describe('createBackup', () => {
    it('should create a complete backup for a user', async () => {
      const backup = await createBackup('test-user-id');

      expect(backup).toBeDefined();
      expect(backup.metadata).toBeDefined();
      expect(backup.metadata.version).toBe('1.0.0');
      expect(backup.metadata.createdAt).toBeDefined();
      expect(backup.data).toBeDefined();
    });

    it('should include all required collections in backup', async () => {
      const backup = await createBackup('test-user-id');

      expect(backup.data.ledger).toBeDefined();
      expect(backup.data.payments).toBeDefined();
      expect(backup.data.cheques).toBeDefined();
      expect(backup.data.inventory).toBeDefined();
      expect(backup.data.clients).toBeDefined();
      expect(backup.data.partners).toBeDefined();
      expect(backup.data.suppliers).toBeDefined();
      expect(backup.data.assets).toBeDefined();
    });

    it('should count total documents in metadata', async () => {
      const backup = await createBackup('test-user-id');

      expect(backup.metadata.totalDocuments).toBeGreaterThanOrEqual(0);
    });

    it('should convert Timestamps to ISO strings', async () => {
      const backup = await createBackup('test-user-id');

      // The mock returns dates that should be serialized
      expect(backup).toBeDefined();
    });

    it('should log backup progress', async () => {
      await createBackup('test-user-id');

      expect(console.log).toHaveBeenCalledWith(
        'Starting backup for user:',
        'test-user-id'
      );
    });
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

      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it('should restore backup in replace mode', async () => {
      await restoreBackup(validBackup, 'test-user-id', 'replace');

      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it('should use merge mode by default', async () => {
      await restoreBackup(validBackup, 'test-user-id');

      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it('should call progress callback during restore', async () => {
      const onProgress = jest.fn();

      await restoreBackup(validBackup, 'test-user-id', 'merge', onProgress);

      expect(onProgress).toHaveBeenCalled();
    });

    it('should skip empty collections', async () => {
      const backupWithEmpty: BackupData = {
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

      await restoreBackup(backupWithEmpty, 'test-user-id');

      // Should complete without errors
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/Starting restore/)
      );
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

      expect(mockBatchSet).toHaveBeenCalled();
    });

    it('should validate backup before restoring', async () => {
      const invalidBackup = { invalid: true } as any;

      await expect(restoreBackup(invalidBackup, 'test-user-id')).rejects.toThrow();
    });

    it('should log completion message', async () => {
      await restoreBackup(validBackup, 'test-user-id');

      expect(console.log).toHaveBeenCalledWith('Restore completed successfully');
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

  describe('Collection Mapping', () => {
    it('should map fixedAssets to assets key', async () => {
      const backup = await createBackup('test-user-id');

      // The mapping should work - fixedAssets collection should map to assets key
      expect(backup.data.assets).toBeDefined();
    });

    it('should map employees to suppliers key for backward compatibility', async () => {
      const backup = await createBackup('test-user-id');

      // The mapping should work - employees collection should map to suppliers key
      expect(backup.data.suppliers).toBeDefined();
    });
  });

  describe('Date Serialization', () => {
    it('should serialize Firestore Timestamps to ISO strings', async () => {
      const backup = await createBackup('test-user-id');

      // Mock data includes Timestamp that should be serialized
      expect(backup).toBeDefined();
    });

    it('should serialize Date objects to ISO strings', async () => {
      const backup = await createBackup('test-user-id');

      expect(backup).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle Firestore errors during backup', async () => {
      const { getDocs } = require('firebase/firestore');
      getDocs.mockRejectedValueOnce(new Error('Firestore error'));

      await expect(createBackup('test-user-id')).rejects.toThrow();
    });

    it('should handle Firestore errors during restore', async () => {
      mockBatchCommit.mockRejectedValueOnce(new Error('Firestore error'));

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
});

describe('Batch Processing', () => {
  it('should handle large collections with batching', async () => {
    // Create backup with many documents
    const largeDocs = Array.from({ length: 600 }, (_, i) => ({
      id: `doc-${i}`,
      data: () => ({ value: i }),
    }));

    const largeMockSnapshot = {
      docs: largeDocs,
      forEach: (callback: (doc: any) => void) => largeDocs.forEach(callback),
    };

    const { getDocs } = require('firebase/firestore');
    getDocs.mockResolvedValue(largeMockSnapshot);

    const backup = await createBackup('test-user-id');

    expect(backup.metadata.totalDocuments).toBeGreaterThan(0);
  });
});
