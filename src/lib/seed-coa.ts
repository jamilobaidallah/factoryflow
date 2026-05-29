import type { DrizzleDb } from './database';
import { chartOfAccounts } from './schema';

/**
 * Seeds the default Chart of Accounts for a newly created profile.
 * This mirrors the Firestore seedChartOfAccounts() in journalService.ts,
 * ensuring the local version starts with the same account structure.
 *
 * Called once when a new profile is created via the profile picker.
 */
export function seedChartOfAccounts(db: DrizzleDb, profileId: string): void {
  const now = new Date().toISOString();

  const accounts = DEFAULT_COA.map(a => ({
    id: `${profileId}-${a.code}`,
    profileId,
    createdAt: now,
    updatedAt: now,
    ...a,
  }));

  // Insert all accounts in a single transaction
  const sqlite = (db as unknown as { session: { client: { prepare: (sql: string) => unknown } } });
  void sqlite; // suppress unused var — actual insert uses Drizzle below

  for (const account of accounts) {
    db.insert(chartOfAccounts).values(account).onConflictDoNothing().run();
  }
}

// ---------------------------------------------------------------------------
// Default Chart of Accounts — matches journalService.ts seedChartOfAccounts()
// ---------------------------------------------------------------------------

interface AccountSeed {
  code: string;
  name: string;
  nameAr: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  normalBalance: 'debit' | 'credit';
  isActive: boolean;
  isSystemAccount?: boolean;
  isContraAccount?: boolean;
  parentCode?: string;
  description?: string;
}

const DEFAULT_COA: AccountSeed[] = [
  // ── ASSETS (1xxx) ──────────────────────────────────────────────────────
  { code: '1000', name: 'Current Assets',          nameAr: 'الأصول المتداولة',            type: 'asset',     normalBalance: 'debit',  isActive: true, isSystemAccount: true },
  { code: '1100', name: 'Cash and Cash Equivalents', nameAr: 'النقدية وما في حكمها',       type: 'asset',     normalBalance: 'debit',  isActive: true, isSystemAccount: true,  parentCode: '1000' },
  { code: '1200', name: 'Accounts Receivable',     nameAr: 'الذمم المدينة',               type: 'asset',     normalBalance: 'debit',  isActive: true, isSystemAccount: true,  parentCode: '1000' },
  { code: '1210', name: 'Advances to Customers',   nameAr: 'سلف العملاء',                 type: 'asset',     normalBalance: 'debit',  isActive: true, isSystemAccount: true,  parentCode: '1200' },
  { code: '1300', name: 'Inventory',               nameAr: 'المخزون',                     type: 'asset',     normalBalance: 'debit',  isActive: true, isSystemAccount: true,  parentCode: '1000' },
  { code: '1301', name: 'Imported Raw Stone',      nameAr: 'بلاطات حجر خام — واردات',    type: 'asset',     normalBalance: 'debit',  isActive: true,                          parentCode: '1300' },
  { code: '1302', name: 'Cut Stone In-house',      nameAr: 'حجر مقطوع — إنتاج داخلي',   type: 'asset',     normalBalance: 'debit',  isActive: true,                          parentCode: '1300' },
  { code: '1303', name: 'Ready Stone — Local',     nameAr: 'حجر جاهز — مشتريات محلية',  type: 'asset',     normalBalance: 'debit',  isActive: true,                          parentCode: '1300' },
  { code: '1400', name: 'Loans Receivable',        nameAr: 'قروض مدينة',                  type: 'asset',     normalBalance: 'debit',  isActive: true, isSystemAccount: true,  parentCode: '1000' },
  { code: '1500', name: 'Non-current Assets',      nameAr: 'الأصول غير المتداولة',       type: 'asset',     normalBalance: 'debit',  isActive: true, isSystemAccount: true },
  { code: '1510', name: 'Fixed Assets',            nameAr: 'الأصول الثابتة',              type: 'asset',     normalBalance: 'debit',  isActive: true, isSystemAccount: true,  parentCode: '1500' },
  { code: '1520', name: 'Accumulated Depreciation', nameAr: 'مجمع الإهلاك',               type: 'asset',     normalBalance: 'credit', isActive: true, isSystemAccount: true,  parentCode: '1500', isContraAccount: true },

  // ── LIABILITIES (2xxx) ─────────────────────────────────────────────────
  { code: '2000', name: 'Current Liabilities',     nameAr: 'الالتزامات المتداولة',        type: 'liability', normalBalance: 'credit', isActive: true, isSystemAccount: true },
  { code: '2100', name: 'Accounts Payable',        nameAr: 'الذمم الدائنة',              type: 'liability', normalBalance: 'credit', isActive: true, isSystemAccount: true,  parentCode: '2000' },
  { code: '2110', name: 'Advances from Suppliers', nameAr: 'سلف الموردين',               type: 'liability', normalBalance: 'credit', isActive: true, isSystemAccount: true,  parentCode: '2100' },
  { code: '2200', name: 'Loans Payable',           nameAr: 'قروض دائنة',                 type: 'liability', normalBalance: 'credit', isActive: true, isSystemAccount: true,  parentCode: '2000' },
  { code: '2300', name: 'Accrued Liabilities',     nameAr: 'مستحقات الدفع',             type: 'liability', normalBalance: 'credit', isActive: true,                          parentCode: '2000' },

  // ── EQUITY (3xxx) ──────────────────────────────────────────────────────
  { code: '3000', name: "Partners' Equity",        nameAr: 'حقوق الشركاء',               type: 'equity',    normalBalance: 'credit', isActive: true, isSystemAccount: true },
  { code: '3300', name: 'Income Summary',          nameAr: 'ملخص الدخل',                 type: 'equity',    normalBalance: 'credit', isActive: true, isSystemAccount: true,  parentCode: '3000', description: 'Transient clearing account for year-end close' },

  // ── REVENUE (4xxx) ─────────────────────────────────────────────────────
  { code: '4000', name: 'Revenue',                 nameAr: 'الإيرادات',                  type: 'revenue',   normalBalance: 'credit', isActive: true, isSystemAccount: true },
  { code: '4010', name: 'Cut Stone Sales',         nameAr: 'مبيعات حجر مقطوع',          type: 'revenue',   normalBalance: 'credit', isActive: true,                          parentCode: '4000' },
  { code: '4020', name: 'Ready Stone Sales',       nameAr: 'مبيعات حجر جاهز',           type: 'revenue',   normalBalance: 'credit', isActive: true,                          parentCode: '4000' },
  { code: '4050', name: 'Sales Returns',           nameAr: 'مردودات المبيعات',           type: 'revenue',   normalBalance: 'debit',  isActive: true, isSystemAccount: true,  parentCode: '4000', isContraAccount: true },

  // ── EXPENSES (5xxx) ────────────────────────────────────────────────────
  { code: '5000', name: 'Expenses',                nameAr: 'المصاريف',                   type: 'expense',   normalBalance: 'debit',  isActive: true, isSystemAccount: true },
  { code: '5010', name: 'Cost of Goods Sold',      nameAr: 'تكلفة البضاعة المباعة',     type: 'expense',   normalBalance: 'debit',  isActive: true, isSystemAccount: true,  parentCode: '5000' },
  { code: '5040', name: 'Blade & Machinery Maintenance', nameAr: 'استهلاك شفرات وصيانة آلات التقطيع', type: 'expense', normalBalance: 'debit', isActive: true, parentCode: '5000' },
  { code: '5060', name: 'Inventory Losses',        nameAr: 'خسائر المخزون وهبوط القيمة', type: 'expense', normalBalance: 'debit',   isActive: true,                          parentCode: '5000' },
  { code: '5100', name: 'Operating Expenses',      nameAr: 'مصاريف التشغيل',            type: 'expense',   normalBalance: 'debit',  isActive: true, isSystemAccount: true,  parentCode: '5000' },
  { code: '5200', name: 'Salaries & Wages',        nameAr: 'الرواتب والأجور',            type: 'expense',   normalBalance: 'debit',  isActive: true, isSystemAccount: true,  parentCode: '5100' },
  { code: '5300', name: 'Rent Expense',            nameAr: 'مصاريف الإيجار',            type: 'expense',   normalBalance: 'debit',  isActive: true,                          parentCode: '5100' },
  { code: '5400', name: 'Depreciation Expense',    nameAr: 'مصاريف الإهلاك',            type: 'expense',   normalBalance: 'debit',  isActive: true, isSystemAccount: true,  parentCode: '5000' },
  { code: '5425', name: 'Sales Commissions',       nameAr: 'عمولات مبيعات',             type: 'expense',   normalBalance: 'debit',  isActive: true,                          parentCode: '5100' },
  { code: '5500', name: 'Bad Debt Expense',        nameAr: 'ديون معدومة',               type: 'expense',   normalBalance: 'debit',  isActive: true, isSystemAccount: true,  parentCode: '5000' },
  { code: '5600', name: 'Discount Expense',        nameAr: 'خصومات ممنوحة',             type: 'expense',   normalBalance: 'debit',  isActive: true, isSystemAccount: true,  parentCode: '5000' },
];
