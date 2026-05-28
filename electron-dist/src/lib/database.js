"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabase = getDatabase;
exports.applyMigrations = applyMigrations;
exports.closeAllDatabases = closeAllDatabases;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const better_sqlite3_2 = require("drizzle-orm/better-sqlite3");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const schema = __importStar(require("./schema"));
const openDatabases = new Map();
/**
 * Open (or return cached) Drizzle database for a given profile.
 * Called from Electron IPC handlers — never from Next.js renderer code.
 */
function getDatabase(dbPath) {
    if (openDatabases.has(dbPath)) {
        return openDatabases.get(dbPath);
    }
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const sqlite = new better_sqlite3_1.default(dbPath);
    initializeDatabase(sqlite);
    const db = (0, better_sqlite3_2.drizzle)(sqlite, { schema });
    openDatabases.set(dbPath, db);
    return db;
}
/**
 * Configure SQLite pragmas and apply any pending schema migrations.
 * Called once per database file, immediately after opening.
 */
function initializeDatabase(sqlite) {
    // WAL mode: reads and writes can happen simultaneously without locking
    sqlite.pragma('journal_mode = WAL');
    // Enforce foreign key constraints
    sqlite.pragma('foreign_keys = ON');
    // Improve write performance
    sqlite.pragma('synchronous = NORMAL');
    applyMigrations(sqlite);
}
/**
 * Run any pending schema migrations on startup.
 * Each migration is versioned — only newer migrations run.
 * The user never needs to do anything; this is fully automatic.
 */
function applyMigrations(sqlite) {
    const currentVersion = sqlite.pragma('user_version', { simple: true });
    const pending = ALL_MIGRATIONS.filter(m => m.version > currentVersion);
    if (pending.length === 0) {
        return;
    }
    console.log(`Applying ${pending.length} database migration(s)...`);
    for (const migration of pending) {
        sqlite.transaction(() => {
            sqlite.exec(migration.sql);
            sqlite.pragma(`user_version = ${migration.version}`);
        })();
        console.log(`  ✓ Migration ${migration.version}: ${migration.description}`);
    }
}
/** Close all open database connections (called on app quit) */
function closeAllDatabases() {
    openDatabases.clear();
}
// ---------------------------------------------------------------------------
// Initial schema SQL — must be declared before ALL_MIGRATIONS references it.
// ---------------------------------------------------------------------------
const INITIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS ledger (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT '',
  sub_category TEXT NOT NULL DEFAULT '',
  associated_party TEXT NOT NULL DEFAULT '',
  owner_name TEXT,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  total_paid REAL DEFAULT 0,
  remaining_balance REAL DEFAULT 0,
  payment_status TEXT,
  is_arap_entry INTEGER DEFAULT 0,
  total_discount REAL DEFAULT 0,
  writeoff_amount REAL DEFAULT 0,
  writeoff_reason TEXT,
  writeoff_date TEXT,
  writeoff_by TEXT,
  immediate_settlement INTEGER DEFAULT 0,
  paid_from_advances TEXT,
  total_paid_from_advances REAL DEFAULT 0,
  is_return_entry INTEGER DEFAULT 0,
  return_cost_amount REAL DEFAULT 0,
  return_inventory_sub_code TEXT,
  is_cogs_reversal INTEGER DEFAULT 0,
  is_inventory_purchase INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ledger_profile_idx ON ledger(profile_id);
CREATE INDEX IF NOT EXISTS ledger_date_idx ON ledger(date);
CREATE INDEX IF NOT EXISTS ledger_txn_idx ON ledger(transaction_id);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  entry_number TEXT NOT NULL,
  date TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'posted',
  entry_status TEXT NOT NULL DEFAULT 'active',
  superseded_by TEXT,
  source_type TEXT,
  source_document_id TEXT,
  source_transaction_id TEXT,
  source_cheque_id TEXT,
  is_reversal INTEGER DEFAULT 0,
  reverses_entry_id TEXT,
  reversed_by_entry_id TEXT,
  reversed_at TEXT,
  reversal_reason TEXT,
  reversal_type TEXT,
  linked_transaction_id TEXT,
  linked_payment_id TEXT,
  linked_document_type TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS je_profile_idx ON journal_entries(profile_id);
CREATE INDEX IF NOT EXISTS je_date_idx ON journal_entries(date);
CREATE INDEX IF NOT EXISTS je_txn_idx ON journal_entries(linked_transaction_id);

CREATE TABLE IF NOT EXISTS journal_lines (
  id TEXT PRIMARY KEY,
  journal_id TEXT NOT NULL REFERENCES journal_entries(id),
  profile_id TEXT NOT NULL,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL DEFAULT '',
  account_name_ar TEXT NOT NULL DEFAULT '',
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0,
  description TEXT
);

CREATE INDEX IF NOT EXISTS jl_journal_idx ON journal_lines(journal_id);
CREATE INDEX IF NOT EXISTS jl_account_idx ON journal_lines(account_code);
CREATE INDEX IF NOT EXISTS jl_profile_idx ON journal_lines(profile_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  type TEXT NOT NULL,
  date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  category TEXT,
  sub_category TEXT,
  is_multi_allocation INTEGER DEFAULT 0,
  total_allocated REAL DEFAULT 0,
  allocation_method TEXT,
  allocation_count INTEGER DEFAULT 0,
  linked_cheque_id TEXT,
  is_endorsement INTEGER DEFAULT 0,
  no_cash_movement INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS pay_profile_idx ON payments(profile_id);
CREATE INDEX IF NOT EXISTS pay_date_idx ON payments(date);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  profile_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  ledger_doc_id TEXT NOT NULL,
  allocated_amount REAL NOT NULL,
  transaction_date TEXT,
  description TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS pa_payment_idx ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS pa_txn_idx ON payment_allocations(transaction_id);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  balance REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS cli_profile_idx ON clients(profile_id);
CREATE INDEX IF NOT EXISTS cli_name_idx ON clients(name);

CREATE TABLE IF NOT EXISTS partners (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  ownership_percentage REAL NOT NULL DEFAULT 0,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  initial_investment REAL NOT NULL DEFAULT 0,
  join_date TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  capital_account_code TEXT,
  drawings_account_code TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS par_profile_idx ON partners(profile_id);

CREATE TABLE IF NOT EXISTS cheques (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  cheque_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL,
  cheque_type TEXT,
  status TEXT NOT NULL,
  cheque_image_url TEXT,
  endorsed_to TEXT,
  endorsed_date TEXT,
  endorsed_to_outgoing_id TEXT,
  endorsed_supplier_transaction_id TEXT,
  is_endorsed_cheque INTEGER DEFAULT 0,
  endorsed_from_id TEXT,
  linked_transaction_id TEXT,
  linked_payment_id TEXT,
  paid_transaction_ids TEXT,
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  cleared_date TEXT,
  bounced_date TEXT,
  bank_name TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  client_phone TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS chq_profile_idx ON cheques(profile_id);
CREATE INDEX IF NOT EXISTS chq_due_date_idx ON cheques(due_date);
CREATE INDEX IF NOT EXISTS chq_status_idx ON cheques(status);

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  type TEXT NOT NULL,
  normal_balance TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_system_account INTEGER DEFAULT 0,
  is_contra_account INTEGER DEFAULT 0,
  parent_code TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  UNIQUE(profile_id, code)
);

CREATE INDEX IF NOT EXISTS coa_profile_idx ON chart_of_accounts(profile_id);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  sub_category TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '',
  unit_price REAL NOT NULL DEFAULT 0,
  min_stock REAL NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  thickness REAL,
  width REAL,
  length REAL,
  last_purchase_price REAL,
  last_purchase_date TEXT,
  last_purchase_amount REAL,
  inventory_account_code TEXT DEFAULT '1300',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS inv_profile_idx ON inventory(profile_id);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  item_id TEXT NOT NULL REFERENCES inventory(id),
  item_name TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT,
  linked_transaction_id TEXT,
  notes TEXT,
  user_email TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS im_profile_idx ON inventory_movements(profile_id);
CREATE INDEX IF NOT EXISTS im_item_idx ON inventory_movements(item_id);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  current_salary REAL NOT NULL DEFAULT 0,
  overtime_eligible INTEGER NOT NULL DEFAULT 1,
  hire_date TEXT NOT NULL,
  position TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS emp_profile_idx ON employees(profile_id);

CREATE TABLE IF NOT EXISTS salary_history (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  employee_name TEXT NOT NULL,
  old_salary REAL NOT NULL,
  new_salary REAL NOT NULL,
  increment_percentage REAL NOT NULL DEFAULT 0,
  effective_date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sh_employee_idx ON salary_history(employee_id);

CREATE TABLE IF NOT EXISTS payroll (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  employee_name TEXT NOT NULL,
  month TEXT NOT NULL,
  base_salary REAL NOT NULL,
  full_monthly_salary REAL,
  days_worked REAL,
  days_in_month INTEGER,
  is_prorated INTEGER DEFAULT 0,
  overtime_hours REAL NOT NULL DEFAULT 0,
  overtime_pay REAL NOT NULL DEFAULT 0,
  deductions TEXT,
  bonuses TEXT,
  advance_deduction REAL DEFAULT 0,
  advance_ids TEXT,
  total_salary REAL NOT NULL,
  net_salary REAL,
  is_paid INTEGER NOT NULL DEFAULT 0,
  paid_date TEXT,
  linked_transaction_id TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS payroll_employee_idx ON payroll(employee_id);
CREATE INDEX IF NOT EXISTS payroll_month_idx ON payroll(month);

CREATE TABLE IF NOT EXISTS overtime_entries (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  employee_name TEXT NOT NULL,
  date TEXT NOT NULL,
  hours REAL NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  month TEXT NOT NULL,
  linked_payroll_id TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS ot_employee_idx ON overtime_entries(employee_id);
CREATE INDEX IF NOT EXISTS ot_month_idx ON overtime_entries(month);

CREATE TABLE IF NOT EXISTS advances (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  employee_name TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  remaining_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  linked_transaction_id TEXT NOT NULL,
  linked_payroll_month TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS adv_employee_idx ON advances(employee_id);

CREATE TABLE IF NOT EXISTS fixed_assets (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  asset_number TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  purchase_date TEXT NOT NULL,
  purchase_cost REAL NOT NULL,
  salvage_value REAL NOT NULL DEFAULT 0,
  useful_life_months INTEGER NOT NULL,
  monthly_depreciation REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  accumulated_depreciation REAL NOT NULL DEFAULT 0,
  book_value REAL NOT NULL,
  last_depreciation_date TEXT,
  location TEXT,
  serial_number TEXT,
  supplier TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS fa_profile_idx ON fixed_assets(profile_id);

CREATE TABLE IF NOT EXISTS depreciation_records (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  asset_id TEXT NOT NULL REFERENCES fixed_assets(id),
  asset_name TEXT NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  period TEXT NOT NULL,
  period_label TEXT NOT NULL,
  depreciation_amount REAL NOT NULL,
  accumulated_depreciation_before REAL NOT NULL,
  accumulated_depreciation_after REAL NOT NULL,
  book_value_before REAL NOT NULL,
  book_value_after REAL NOT NULL,
  ledger_entry_id TEXT,
  recorded_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(asset_id, period)
);

CREATE INDEX IF NOT EXISTS dr_asset_idx ON depreciation_records(asset_id);
CREATE INDEX IF NOT EXISTS dr_profile_idx ON depreciation_records(profile_id);

CREATE TABLE IF NOT EXISTS depreciation_runs (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  period TEXT NOT NULL,
  run_date TEXT NOT NULL,
  assets_count INTEGER NOT NULL DEFAULT 0,
  total_depreciation REAL NOT NULL DEFAULT 0,
  ledger_entry_id TEXT NOT NULL,
  run_type TEXT DEFAULT 'global',
  asset_name TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS drun_profile_idx ON depreciation_runs(profile_id);
CREATE INDEX IF NOT EXISTS drun_period_idx ON depreciation_runs(period);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  manual_invoice_number TEXT,
  client_name TEXT NOT NULL,
  client_address TEXT,
  client_phone TEXT,
  invoice_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  items TEXT NOT NULL,
  subtotal REAL NOT NULL,
  tax_rate REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  invoice_image_url TEXT,
  linked_transaction_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS inv_invoice_profile_idx ON invoices(profile_id);
CREATE INDEX IF NOT EXISTS inv_invoice_status_idx ON invoices(status);

CREATE TABLE IF NOT EXISTS production_orders (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  date TEXT NOT NULL,
  input_item_id TEXT NOT NULL,
  input_item_name TEXT NOT NULL,
  input_quantity REAL NOT NULL,
  input_thickness REAL,
  input_width REAL,
  input_length REAL,
  output_item_name TEXT NOT NULL,
  output_quantity REAL NOT NULL,
  output_thickness REAL,
  output_width REAL,
  output_length REAL,
  unit TEXT NOT NULL DEFAULT '',
  production_expenses REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'قيد التنفيذ',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS po_profile_idx ON production_orders(profile_id);
CREATE INDEX IF NOT EXISTS po_status_idx ON production_orders(status);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'local',
  user_email TEXT NOT NULL DEFAULT 'local',
  user_display_name TEXT,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  target_id TEXT,
  description TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS al_profile_idx ON activity_logs(profile_id);
CREATE INDEX IF NOT EXISTS al_module_idx ON activity_logs(module);
CREATE INDEX IF NOT EXISTS al_date_idx ON activity_logs(created_at);

CREATE TABLE IF NOT EXISTS ledger_favorites (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT '',
  sub_category TEXT NOT NULL DEFAULT '',
  associated_party TEXT NOT NULL DEFAULT '',
  owner_name TEXT,
  description TEXT,
  immediate_settlement INTEGER DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS fav_profile_idx ON ledger_favorites(profile_id);
`;
const ALL_MIGRATIONS = [
    {
        version: 1,
        description: 'Initial schema — all tables',
        sql: INITIAL_SCHEMA_SQL,
    },
    // Add future migrations here — never modify existing entries
];
