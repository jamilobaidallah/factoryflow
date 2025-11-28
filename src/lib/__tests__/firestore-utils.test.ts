import { toDate, toDateOptional, convertFirestoreDates, FirestoreTimestamp } from '../firestore-utils';

describe('firestore-utils', () => {
  describe('toDate', () => {
    it('should convert Firestore Timestamp to Date', () => {
      const expectedDate = new Date('2024-01-15T10:30:00Z');
      const mockTimestamp: FirestoreTimestamp = {
        toDate: () => expectedDate,
      };

      const result = toDate(mockTimestamp);
      expect(result).toEqual(expectedDate);
    });

    it('should return the same Date if already a Date', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = toDate(date);
      expect(result).toEqual(date);
    });

    it('should return current date for undefined value', () => {
      const before = new Date();
      const result = toDate(undefined);
      const after = new Date();

      expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should return current date for null value', () => {
      const before = new Date();
      const result = toDate(null);
      const after = new Date();

      expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should return fallback date when provided and value is undefined', () => {
      const fallback = new Date('2020-01-01');
      const result = toDate(undefined, fallback);
      expect(result).toEqual(fallback);
    });

    it('should return fallback date when provided and value is null', () => {
      const fallback = new Date('2020-01-01');
      const result = toDate(null, fallback);
      expect(result).toEqual(fallback);
    });
  });

  describe('toDateOptional', () => {
    it('should convert Firestore Timestamp to Date', () => {
      const expectedDate = new Date('2024-01-15T10:30:00Z');
      const mockTimestamp: FirestoreTimestamp = {
        toDate: () => expectedDate,
      };

      const result = toDateOptional(mockTimestamp);
      expect(result).toEqual(expectedDate);
    });

    it('should return the same Date if already a Date', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = toDateOptional(date);
      expect(result).toEqual(date);
    });

    it('should return undefined for undefined value', () => {
      const result = toDateOptional(undefined);
      expect(result).toBeUndefined();
    });

    it('should return undefined for null value', () => {
      const result = toDateOptional(null);
      expect(result).toBeUndefined();
    });
  });

  describe('convertFirestoreDates', () => {
    it('should convert common date fields', () => {
      const expectedDate = new Date('2024-01-15T10:30:00Z');
      const expectedCreatedAt = new Date('2024-01-14T08:00:00Z');

      const data = {
        id: '123',
        name: 'Test',
        date: { toDate: () => expectedDate },
        createdAt: { toDate: () => expectedCreatedAt },
      };

      const result = convertFirestoreDates(data);

      expect(result.id).toBe('123');
      expect(result.name).toBe('Test');
      expect(result.date).toEqual(expectedDate);
      expect(result.createdAt).toEqual(expectedCreatedAt);
    });

    it('should handle missing date fields gracefully', () => {
      const data = {
        id: '123',
        name: 'Test',
      };

      const result = convertFirestoreDates(data);

      expect(result.id).toBe('123');
      expect(result.name).toBe('Test');
      expect(result).not.toHaveProperty('date');
      expect(result).not.toHaveProperty('createdAt');
    });

    it('should convert additional custom fields when specified', () => {
      const expectedDate = new Date('2024-01-15T10:30:00Z');

      const data = {
        id: '123',
        customDate: { toDate: () => expectedDate },
      };

      const result = convertFirestoreDates(data, ['customDate']);

      expect(result.customDate).toEqual(expectedDate);
    });

    it('should not modify the original data object', () => {
      const expectedDate = new Date('2024-01-15T10:30:00Z');
      const timestamp = { toDate: () => expectedDate };

      const data = {
        id: '123',
        date: timestamp,
      };

      convertFirestoreDates(data);

      expect(data.date).toBe(timestamp);
    });

    it('should handle all common date fields', () => {
      const makeTimestamp = (date: Date): FirestoreTimestamp => ({ toDate: () => date });

      const dates = {
        date: new Date('2024-01-01'),
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-03'),
        dueDate: new Date('2024-01-04'),
        issueDate: new Date('2024-01-05'),
        invoiceDate: new Date('2024-01-06'),
        purchaseDate: new Date('2024-01-07'),
        hireDate: new Date('2024-01-08'),
        effectiveDate: new Date('2024-01-09'),
        joinDate: new Date('2024-01-10'),
      };

      const data = {
        id: '123',
        date: makeTimestamp(dates.date),
        createdAt: makeTimestamp(dates.createdAt),
        updatedAt: makeTimestamp(dates.updatedAt),
        dueDate: makeTimestamp(dates.dueDate),
        issueDate: makeTimestamp(dates.issueDate),
        invoiceDate: makeTimestamp(dates.invoiceDate),
        purchaseDate: makeTimestamp(dates.purchaseDate),
        hireDate: makeTimestamp(dates.hireDate),
        effectiveDate: makeTimestamp(dates.effectiveDate),
        joinDate: makeTimestamp(dates.joinDate),
      };

      const result = convertFirestoreDates(data);

      expect(result.date).toEqual(dates.date);
      expect(result.createdAt).toEqual(dates.createdAt);
      expect(result.updatedAt).toEqual(dates.updatedAt);
      expect(result.dueDate).toEqual(dates.dueDate);
      expect(result.issueDate).toEqual(dates.issueDate);
      expect(result.invoiceDate).toEqual(dates.invoiceDate);
      expect(result.purchaseDate).toEqual(dates.purchaseDate);
      expect(result.hireDate).toEqual(dates.hireDate);
      expect(result.effectiveDate).toEqual(dates.effectiveDate);
      expect(result.joinDate).toEqual(dates.joinDate);
    });
  });
});
