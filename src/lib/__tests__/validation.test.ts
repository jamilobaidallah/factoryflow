/**
 * Unit Tests for Validation System
 */

import { z } from 'zod';
import {
  clientSchema,
  partnerSchema,
  supplierSchema,
  chequeSchema,
  inventoryItemSchema,
  fixedAssetSchema,
  validateReasonableDate,
  validateReasonableAmount,
  sanitizeString,
  parseNumericInput,
  formatValidationErrors,
  getFirstValidationError,
  validateData,
} from '../validation';

// Mock Firebase to avoid actual Firestore calls
jest.mock('@/firebase/config', () => ({
  firestore: {},
}));

describe('Validation System', () => {
  describe('Client Schema', () => {
    it('should validate correct client data', () => {
      const validClient = {
        name: 'محمد أحمد',
        phone: '0791234567',
        email: 'test@example.com',
        address: 'عمان، الأردن',
        balance: 1000,
      };

      expect(() => clientSchema.parse(validClient)).not.toThrow();
    });

    it('should reject empty name', () => {
      const invalidClient = {
        name: '',
        phone: '0791234567',
        email: 'test@example.com',
        balance: 0,
      };

      expect(() => clientSchema.parse(invalidClient)).toThrow();
    });

    it('should reject invalid phone number', () => {
      const invalidClient = {
        name: 'محمد أحمد',
        phone: '123', // Too short
        email: 'test@example.com',
        balance: 0,
      };

      expect(() => clientSchema.parse(invalidClient)).toThrow();
    });

    it('should reject invalid email', () => {
      const invalidClient = {
        name: 'محمد أحمد',
        phone: '0791234567',
        email: 'invalid-email',
        balance: 0,
      };

      expect(() => clientSchema.parse(invalidClient)).toThrow();
    });

    it('should accept optional fields', () => {
      const minimalClient = {
        name: 'محمد أحمد',
        phone: '',
        email: '',
        balance: 0,
      };

      expect(() => clientSchema.parse(minimalClient)).not.toThrow();
    });

    it('should trim and validate name', () => {
      const clientWithWhitespace = {
        name: '  محمد أحمد  ',
        phone: '0791234567',
        email: '',
        balance: 0,
      };

      const result = clientSchema.parse(clientWithWhitespace);
      expect(result.name).toBe('محمد أحمد');
    });

    it('should reject name that is too long', () => {
      const longName = 'أ'.repeat(101);
      const invalidClient = {
        name: longName,
        phone: '0791234567',
        email: '',
        balance: 0,
      };

      expect(() => clientSchema.parse(invalidClient)).toThrow();
    });
  });

  describe('Cheque Schema', () => {
    it('should validate correct cheque data', () => {
      const validCheque = {
        chequeNumber: 'CHK-001',
        amount: 1000,
        date: new Date('2025-01-01'),
        dueDate: new Date('2025-02-01'),
        type: 'incoming' as const,
        status: 'pending' as const,
        bank: 'البنك الأهلي',
      };

      expect(() => chequeSchema.parse(validCheque)).not.toThrow();
    });

    it('should reject due date before issue date', () => {
      const invalidCheque = {
        chequeNumber: 'CHK-001',
        amount: 1000,
        date: new Date('2025-02-01'),
        dueDate: new Date('2025-01-01'), // Before issue date
        type: 'incoming' as const,
        status: 'pending' as const,
        bank: 'البنك الأهلي',
      };

      expect(() => chequeSchema.parse(invalidCheque)).toThrow();
    });

    it('should reject negative amount', () => {
      const invalidCheque = {
        chequeNumber: 'CHK-001',
        amount: -1000,
        date: new Date('2025-01-01'),
        dueDate: new Date('2025-02-01'),
        type: 'incoming' as const,
        bank: 'البنك الأهلي',
      };

      expect(() => chequeSchema.parse(invalidCheque)).toThrow();
    });
  });

  describe('Inventory Item Schema', () => {
    it('should validate correct inventory item', () => {
      const validItem = {
        name: 'منتج 1',
        category: 'الكترونيات',
        quantity: 10,
        unit: 'قطعة',
        costPrice: 100,
        sellingPrice: 150,
        minStock: 5,
      };

      expect(() => inventoryItemSchema.parse(validItem)).not.toThrow();
    });

    it('should reject selling price less than cost price', () => {
      const invalidItem = {
        name: 'منتج 1',
        category: 'الكترونيات',
        quantity: 10,
        unit: 'قطعة',
        costPrice: 150,
        sellingPrice: 100, // Less than cost
        minStock: 5,
      };

      expect(() => inventoryItemSchema.parse(invalidItem)).toThrow();
    });

    it('should reject negative quantity', () => {
      const invalidItem = {
        name: 'منتج 1',
        category: 'الكترونيات',
        quantity: -5,
        unit: 'قطعة',
        costPrice: 100,
        sellingPrice: 150,
      };

      expect(() => inventoryItemSchema.parse(invalidItem)).toThrow();
    });
  });

  describe('Helper Functions', () => {
    describe('validateReasonableDate', () => {
      it('should accept today\'s date', () => {
        const today = new Date();
        expect(validateReasonableDate(today)).toBe(true);
      });

      it('should accept date within 1 year', () => {
        const sixMonthsFromNow = new Date();
        sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
        expect(validateReasonableDate(sixMonthsFromNow)).toBe(true);
      });

      it('should reject date more than 1 year in future', () => {
        const twoYearsFromNow = new Date();
        twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
        expect(validateReasonableDate(twoYearsFromNow)).toBe(false);
      });
    });

    describe('validateReasonableAmount', () => {
      it('should accept reasonable amounts', () => {
        expect(validateReasonableAmount(1000)).toBe(true);
        expect(validateReasonableAmount(500000)).toBe(true);
      });

      it('should reject negative amounts', () => {
        expect(validateReasonableAmount(-100)).toBe(false);
      });

      it('should reject amounts above max', () => {
        expect(validateReasonableAmount(2000000000)).toBe(false);
      });

      it('should accept custom max', () => {
        expect(validateReasonableAmount(500, 1000)).toBe(true);
        expect(validateReasonableAmount(1500, 1000)).toBe(false);
      });
    });

    describe('sanitizeString', () => {
      it('should trim whitespace', () => {
        expect(sanitizeString('  hello  ')).toBe('hello');
      });

      it('should remove extra spaces', () => {
        expect(sanitizeString('hello    world')).toBe('hello world');
      });

      it('should handle tabs and newlines', () => {
        expect(sanitizeString('hello\t\nworld')).toBe('hello world');
      });
    });

    describe('parseNumericInput', () => {
      it('should parse valid numbers', () => {
        expect(parseNumericInput('123')).toBe(123);
        expect(parseNumericInput('123.45')).toBe(123.45);
        expect(parseNumericInput('-50')).toBe(-50);
      });

      it('should parse numbers with commas', () => {
        expect(parseNumericInput('1,234.56')).toBe(1234.56);
      });

      it('should return null for invalid input', () => {
        expect(parseNumericInput('abc')).toBeNull();
        expect(parseNumericInput('')).toBeNull();
      });

      it('should handle whitespace', () => {
        expect(parseNumericInput('  123  ')).toBe(123);
      });
    });
  });

  describe('Error Formatting', () => {
    describe('formatValidationErrors', () => {
      it('should format Zod errors', () => {
        const invalidData = {
          name: '',
          phone: '123',
        };

        try {
          clientSchema.parse(invalidData);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errors = formatValidationErrors(error);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors.every((e) => typeof e === 'string')).toBe(true);
          }
        }
      });
    });

    describe('getFirstValidationError', () => {
      it('should return first error message', () => {
        const invalidData = {
          name: '',
          phone: '123',
        };

        try {
          clientSchema.parse(invalidData);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const firstError = getFirstValidationError(error);
            expect(typeof firstError).toBe('string');
            expect(firstError.length).toBeGreaterThan(0);
          }
        }
      });
    });
  });

  describe('validateData', () => {
    it('should return success for valid data', () => {
      const validData = {
        name: 'محمد أحمد',
        phone: '0791234567',
        email: 'test@example.com',
        balance: 0,
      };

      const result = validateData(clientSchema, validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('محمد أحمد');
      }
    });

    it('should return errors for invalid data', () => {
      const invalidData = {
        name: '',
        phone: '123',
      };

      const result = validateData(clientSchema, invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Partner Schema', () => {
    it('should validate correct partner data', () => {
      const validPartner = {
        name: 'شريك 1',
        phone: '0791234567',
        email: 'partner@example.com',
        equityBalance: 50000,
      };

      expect(() => partnerSchema.parse(validPartner)).not.toThrow();
    });
  });

  describe('Supplier Schema', () => {
    it('should validate correct supplier data', () => {
      const validSupplier = {
        name: 'مورد 1',
        phone: '0791234567',
        email: 'supplier@example.com',
        balance: -5000,
      };

      expect(() => supplierSchema.parse(validSupplier)).not.toThrow();
    });
  });

  describe('Fixed Asset Schema', () => {
    it('should validate correct fixed asset data', () => {
      const validAsset = {
        name: 'جهاز كمبيوتر',
        category: 'معدات',
        purchaseDate: new Date('2025-01-01'),
        purchasePrice: 10000,
        currentValue: 8000,
        depreciationRate: 20,
      };

      expect(() => fixedAssetSchema.parse(validAsset)).not.toThrow();
    });

    it('should reject depreciation rate above 100', () => {
      const invalidAsset = {
        name: 'جهاز كمبيوتر',
        category: 'معدات',
        purchaseDate: new Date('2025-01-01'),
        purchasePrice: 10000,
        currentValue: 8000,
        depreciationRate: 150, // Above 100
      };

      expect(() => fixedAssetSchema.parse(invalidAsset)).toThrow();
    });
  });
});
