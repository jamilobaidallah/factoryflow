import {
    cn,
    formatCurrency,
    formatDate,
    formatDateForInput,
    parseDateFromInput,
    getTimestamp,
    calculatePercentage,
    isValidPhoneNumber,
    generateId,
    debounce,
    groupBy,
    sum,
    getArabicMonthName,
    getStatusColor,
    translateStatus,
    formatFileSize,
    isImageFile,
    sortByDate,
    daysDifference,
    isOverdue,
    generateExcelFileName
} from '../utils';

describe('Utils', () => {
    describe('cn (className merger)', () => {
        it('should merge class names', () => {
            const result = cn('class1', 'class2');
            expect(result).toContain('class1');
            expect(result).toContain('class2');
        });

        it('should handle conditional classes', () => {
            const result = cn('base', false && 'hidden', true && 'visible');
            expect(result).toContain('base');
            expect(result).toContain('visible');
            expect(result).not.toContain('hidden');
        });
    });

    describe('formatCurrency', () => {
        it('should format positive amounts', () => {
            const result = formatCurrency(1000);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should format negative amounts', () => {
            const result = formatCurrency(-500);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
        });

        it('should format zero', () => {
            const result = formatCurrency(0);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
        });

        it('should include decimal places', () => {
            const result = formatCurrency(1234.56);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(5);
        });
    });

    describe('formatDate', () => {
        it('should format Date object', () => {
            const date = new Date('2024-01-15');
            const result = formatDate(date);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
        });

        it('should format date string', () => {
            const result = formatDate('2024-01-15');
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
        });
    });

    describe('formatDateForInput', () => {
        it('should format date for input field', () => {
            const date = new Date('2024-01-15');
            const result = formatDateForInput(date);
            expect(result).toBe('2024-01-15');
        });

        it('should handle single-digit months and days', () => {
            const date = new Date('2024-03-05');
            const result = formatDateForInput(date);
            expect(result).toBe('2024-03-05');
        });

        it('should format string dates', () => {
            const result = formatDateForInput('2024-12-25');
            expect(result).toBe('2024-12-25');
        });
    });

    describe('parseDateFromInput', () => {
        it('should parse date string to Date object', () => {
            const result = parseDateFromInput('2024-01-15');
            expect(result).toBeInstanceOf(Date);
            expect(result.getFullYear()).toBe(2024);
            expect(result.getMonth()).toBe(0); // January is 0
            expect(result.getDate()).toBe(15);
        });
    });

    describe('getTimestamp', () => {
        it('should return ISO timestamp string', () => {
            const result = getTimestamp();
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });
    });

    describe('calculatePercentage', () => {
        it('should calculate percentage correctly', () => {
            expect(calculatePercentage(50, 200)).toBe(25);
            expect(calculatePercentage(100, 200)).toBe(50);
            expect(calculatePercentage(200, 200)).toBe(100);
        });

        it('should handle zero total', () => {
            expect(calculatePercentage(50, 0)).toBe(0);
        });

        it('should round to nearest integer', () => {
            expect(calculatePercentage(33, 100)).toBe(33);
            expect(calculatePercentage(66, 100)).toBe(66);
        });
    });

    describe('isValidPhoneNumber', () => {
        it('should validate correct Saudi phone numbers', () => {
            expect(isValidPhoneNumber('0551234567')).toBe(true);
            expect(isValidPhoneNumber('0501234567')).toBe(true);
            expect(isValidPhoneNumber('0531234567')).toBe(true);
        });

        it('should reject invalid phone numbers', () => {
            expect(isValidPhoneNumber('1234567890')).toBe(false);
            expect(isValidPhoneNumber('05512345')).toBe(false);
            expect(isValidPhoneNumber('abc')).toBe(false);
        });

        it('should handle phone numbers with spaces', () => {
            expect(isValidPhoneNumber('055 123 4567')).toBe(true);
        });
    });

    describe('generateId', () => {
        it('should generate unique IDs', () => {
            const id1 = generateId();
            const id2 = generateId();
            expect(id1).not.toBe(id2);
        });

        it('should return string', () => {
            const id = generateId();
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(0);
        });
    });

    describe('debounce', () => {
        jest.useFakeTimers();

        it('should debounce function calls', () => {
            const mockFn = jest.fn();
            const debouncedFn = debounce(mockFn, 500);

            debouncedFn();
            debouncedFn();
            debouncedFn();

            expect(mockFn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(500);

            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        afterAll(() => {
            jest.useRealTimers();
        });
    });

    describe('groupBy', () => {
        it('should group array by key', () => {
            const items = [
                { category: 'A', value: 1 },
                { category: 'B', value: 2 },
                { category: 'A', value: 3 },
            ];

            const result = groupBy(items, 'category');

            expect(result['A']).toHaveLength(2);
            expect(result['B']).toHaveLength(1);
        });

        it('should handle empty array', () => {
            const result = groupBy([], 'key' as any);
            expect(result).toEqual({});
        });
    });

    describe('sum', () => {
        it('should sum array of numbers', () => {
            expect(sum([1, 2, 3, 4, 5])).toBe(15);
            expect(sum([10, 20, 30])).toBe(60);
        });

        it('should handle empty array', () => {
            expect(sum([])).toBe(0);
        });

        it('should handle negative numbers', () => {
            expect(sum([10, -5, 3])).toBe(8);
        });
    });

    describe('getArabicMonthName', () => {
        it('should return correct Arabic month names', () => {
            expect(getArabicMonthName(0)).toBe('يناير');
            expect(getArabicMonthName(5)).toBe('يونيو');
            expect(getArabicMonthName(11)).toBe('ديسمبر');
        });

        it('should handle invalid month', () => {
            expect(getArabicMonthName(12)).toBe('');
            expect(getArabicMonthName(-1)).toBe('');
        });
    });

    describe('getStatusColor', () => {
        it('should return correct colors for known statuses', () => {
            expect(getStatusColor('pending')).toContain('yellow');
            expect(getStatusColor('cleared')).toContain('green');
            expect(getStatusColor('bounced')).toContain('red');
        });

        it('should return default color for unknown status', () => {
            expect(getStatusColor('unknown')).toContain('gray');
        });
    });

    describe('translateStatus', () => {
        it('should translate known statuses to Arabic', () => {
            expect(translateStatus('pending')).toBe('معلق');
            expect(translateStatus('cleared')).toBe('محصل');
            expect(translateStatus('income')).toBe('دخل');
            expect(translateStatus('expense')).toBe('مصروف');
        });

        it('should return original status if not found', () => {
            expect(translateStatus('unknown')).toBe('unknown');
        });
    });

    describe('formatFileSize', () => {
        it('should format bytes correctly', () => {
            expect(formatFileSize(0)).toBe('0 بايت');
            expect(formatFileSize(1024)).toContain('كيلوبايت');
            expect(formatFileSize(1024 * 1024)).toContain('ميجابايت');
        });
    });

    describe('isImageFile', () => {
        it('should identify image files', () => {
            expect(isImageFile('photo.jpg')).toBe(true);
            expect(isImageFile('image.png')).toBe(true);
            expect(isImageFile('pic.gif')).toBe(true);
        });

        it('should reject non-image files', () => {
            expect(isImageFile('document.pdf')).toBe(false);
            expect(isImageFile('file.txt')).toBe(false);
        });

        it('should be case-insensitive', () => {
            expect(isImageFile('PHOTO.JPG')).toBe(true);
        });
    });

    describe('sortByDate', () => {
        it('should sort by date descending (newest first)', () => {
            const items = [
                { date: new Date('2024-01-01') },
                { date: new Date('2024-03-01') },
                { date: new Date('2024-02-01') },
            ];

            const sorted = sortByDate(items);

            expect(sorted[0].date.getMonth()).toBe(2); // March
            expect(sorted[2].date.getMonth()).toBe(0); // January
        });

        it('should handle string dates', () => {
            const items = [
                { date: '2024-01-01' },
                { date: '2024-03-01' },
            ];

            const sorted = sortByDate(items);
            expect(sorted[0].date).toBe('2024-03-01');
        });
    });

    describe('daysDifference', () => {
        it('should calculate days difference', () => {
            const date1 = new Date('2024-01-01');
            const date2 = new Date('2024-01-11');
            expect(daysDifference(date1, date2)).toBe(10);
        });

        it('should handle reverse order', () => {
            const date1 = new Date('2024-01-11');
            const date2 = new Date('2024-01-01');
            expect(daysDifference(date1, date2)).toBe(10);
        });
    });

    describe('isOverdue', () => {
        it('should identify overdue dates', () => {
            const pastDate = new Date('2020-01-01');
            expect(isOverdue(pastDate)).toBe(true);
        });

        it('should identify future dates as not overdue', () => {
            const futureDate = new Date('2030-01-01');
            expect(isOverdue(futureDate)).toBe(false);
        });

        it('should handle string dates', () => {
            expect(isOverdue('2020-01-01')).toBe(true);
        });
    });

    describe('generateExcelFileName', () => {
        it('should generate filename with prefix', () => {
            const filename = generateExcelFileName('report');
            expect(filename).toContain('report_');
            expect(filename).toContain('.xlsx');
        });

        it('should include date and time', () => {
            const filename = generateExcelFileName('export');
            expect(filename).toMatch(/export_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.xlsx/);
        });
    });
});
