import {
    TRANSACTION_TYPES,
    PAYMENT_TYPES,
    PAYMENT_METHODS,
    PAYMENT_STATUSES,
    PAYMENT_STATUS_LABELS,
    CHEQUE_STATUSES,
    CHEQUE_STATUS_LABELS,
    MOVEMENT_TYPES,
    UNITS,
    INCOME_CATEGORIES,
    EXPENSE_CATEGORIES,
    DATE_FORMATS,
    CURRENCY,
    VALIDATION_LIMITS,
    TRANSACTION_ID_PATTERN,
    TOAST_DURATION,
    PAGINATION,
    COLLECTIONS,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    CONFIRM_MESSAGES,
    STATUS_COLORS,
} from '../constants';

describe('Constants', () => {
    describe('Transaction and Payment Types', () => {
        it('should have correct transaction types', () => {
            expect(TRANSACTION_TYPES.INCOME).toBe('دخل');
            expect(TRANSACTION_TYPES.EXPENSE).toBe('مصروف');
        });

        it('should have correct payment types', () => {
            expect(PAYMENT_TYPES.RECEIPT).toBe('قبض');
            expect(PAYMENT_TYPES.DISBURSEMENT).toBe('صرف');
        });

        it('should have correct payment methods', () => {
            expect(PAYMENT_METHODS.CASH).toBe('نقدي');
            expect(PAYMENT_METHODS.BANK_TRANSFER).toBe('تحويل بنكي');
            expect(PAYMENT_METHODS.CHEQUE).toBe('شيك');
        });
    });

    describe('Payment Statuses', () => {
        it('should have correct payment statuses', () => {
            expect(PAYMENT_STATUSES.PAID).toBe('paid');
            expect(PAYMENT_STATUSES.UNPAID).toBe('unpaid');
            expect(PAYMENT_STATUSES.PARTIAL).toBe('partial');
        });

        it('should have Arabic labels for payment statuses', () => {
            expect(PAYMENT_STATUS_LABELS.paid).toBe('مدفوع بالكامل');
            expect(PAYMENT_STATUS_LABELS.unpaid).toBe('غير مدفوع');
            expect(PAYMENT_STATUS_LABELS.partial).toBe('مدفوع جزئياً');
        });
    });

    describe('Cheque Statuses', () => {
        it('should have correct cheque statuses', () => {
            expect(CHEQUE_STATUSES.PENDING).toBe('pending');
            expect(CHEQUE_STATUSES.CLEARED).toBe('cleared');
            expect(CHEQUE_STATUSES.BOUNCED).toBe('bounced');
        });

        it('should have Arabic labels for cheque statuses', () => {
            expect(CHEQUE_STATUS_LABELS.pending).toBe('معلق');
            expect(CHEQUE_STATUS_LABELS.cleared).toBe('تم الصرف');
            expect(CHEQUE_STATUS_LABELS.bounced).toBe('مرتجع');
        });
    });

    describe('Inventory Movement Types', () => {
        it('should have correct movement types', () => {
            expect(MOVEMENT_TYPES.ENTRY).toBe('دخول');
            expect(MOVEMENT_TYPES.EXIT).toBe('خروج');
        });
    });

    describe('Units of Measurement', () => {
        it('should have various units defined', () => {
            expect(UNITS.PIECE).toBe('قطعة');
            expect(UNITS.METER).toBe('متر');
            expect(UNITS.KG).toBe('كيلوغرام');
            expect(UNITS.LITER).toBe('لتر');
        });
    });

    describe('Categories', () => {
        it('should have income categories', () => {
            expect(INCOME_CATEGORIES).toHaveLength(3);
            expect(INCOME_CATEGORIES[0].name).toBe('مبيعات');
        });

        it('should have expense categories', () => {
            expect(EXPENSE_CATEGORIES).toHaveLength(3);
            expect(EXPENSE_CATEGORIES[0].name).toBe('تكلفة البضاعة المباعة (COGS)');
        });

        it('should have subcategories for each category', () => {
            INCOME_CATEGORIES.forEach(category => {
                expect(category.subcategories).toBeDefined();
                expect(category.subcategories.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Currency', () => {
        it('should have correct currency settings', () => {
            expect(CURRENCY.SYMBOL).toBe('دينار');
            expect(CURRENCY.CODE).toBe('JOD');
        });
    });

    describe('Validation Limits', () => {
        it('should have reasonable validation limits', () => {
            expect(VALIDATION_LIMITS.MAX_AMOUNT).toBe(999999999);
            expect(VALIDATION_LIMITS.MIN_AMOUNT).toBe(0.01);
            expect(VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH).toBe(500);
        });
    });

    describe('Transaction ID Pattern', () => {
        it('should match valid transaction IDs', () => {
            expect(TRANSACTION_ID_PATTERN.test('TXN-20240115-123456-001')).toBe(true);
        });

        it('should reject invalid transaction IDs', () => {
            expect(TRANSACTION_ID_PATTERN.test('INVALID-ID')).toBe(false);
            expect(TRANSACTION_ID_PATTERN.test('TXN-123')).toBe(false);
        });
    });

    describe('Toast Duration', () => {
        it('should have different duration levels', () => {
            expect(TOAST_DURATION.SHORT).toBe(3000);
            expect(TOAST_DURATION.MEDIUM).toBe(5000);
            expect(TOAST_DURATION.LONG).toBe(7000);
        });
    });

    describe('Pagination', () => {
        it('should have default page size', () => {
            expect(PAGINATION.DEFAULT_PAGE_SIZE).toBe(10);
        });

        it('should have page size options', () => {
            expect(PAGINATION.PAGE_SIZE_OPTIONS).toEqual([10, 25, 50, 100]);
        });
    });

    describe('Firebase Collections', () => {
        it('should have all collection names defined', () => {
            expect(COLLECTIONS.USERS).toBe('users');
            expect(COLLECTIONS.CLIENTS).toBe('clients');
            expect(COLLECTIONS.LEDGER).toBe('ledger');
            expect(COLLECTIONS.INVENTORY).toBe('inventory');
        });
    });

    describe('Error Messages', () => {
        it('should have Arabic error messages', () => {
            expect(ERROR_MESSAGES.REQUIRED_FIELD).toBe('هذا الحقل مطلوب');
            expect(ERROR_MESSAGES.INVALID_EMAIL).toBe('البريد الإلكتروني غير صحيح');
            expect(ERROR_MESSAGES.NO_PERMISSION).toBe('ليس لديك صلاحية للقيام بهذا الإجراء');
        });
    });

    describe('Success Messages', () => {
        it('should have Arabic success messages', () => {
            expect(SUCCESS_MESSAGES.CREATED).toBe('تمت الإضافة بنجاح');
            expect(SUCCESS_MESSAGES.UPDATED).toBe('تم التحديث بنجاح');
            expect(SUCCESS_MESSAGES.DELETED).toBe('تم الحذف بنجاح');
        });
    });

    describe('Confirmation Messages', () => {
        it('should have Arabic confirmation messages', () => {
            expect(CONFIRM_MESSAGES.DELETE).toBe('هل أنت متأكد من حذف هذا العنصر؟');
            expect(CONFIRM_MESSAGES.DELETE_CLIENT).toBe('هل أنت متأكد من حذف هذا العميل؟');
        });
    });

    describe('Status Colors', () => {
        it('should have Tailwind CSS classes for statuses', () => {
            expect(STATUS_COLORS.PAID).toContain('green');
            expect(STATUS_COLORS.UNPAID).toContain('red');
            expect(STATUS_COLORS.PARTIAL).toContain('yellow');
        });
    });
});
