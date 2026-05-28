/**
 * @jest-environment node
 *
 * Phase 2a — Query function tests
 *
 * Tests run against in-memory SQLite databases.
 * Query functions are tested directly — no Electron IPC, no mocks.
 * Each describe block gets a fresh database for full isolation.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { applyMigrations } from '@/lib/database';
import * as schema from '@/lib/schema';

// Query functions under test
import {
  getClients, getClientById, createClient, updateClient,
  deleteClient, searchClients, updateClientBalance,
} from '../../../electron/queries/clients.queries';
import {
  getPartners, getActivePartners, getPartnerById, getPartnerByName,
  createPartner, updatePartner, deletePartner,
} from '../../../electron/queries/partners.queries';
import {
  getInventoryItems, createInventoryItem, updateInventoryItem,
  deleteInventoryItem, updateInventoryQuantity,
  getInventoryMovements, createInventoryMovement,
} from '../../../electron/queries/inventory.queries';
import {
  getEmployees, createEmployee, updateEmployee, deleteEmployee,
  getSalaryHistory, getPayroll, createPayrollEntry, updatePayrollEntry,
  getOvertimeEntries, createOvertimeEntry, deleteOvertimeEntry,
  getAdvances, createAdvance,
} from '../../../electron/queries/employees.queries';
import {
  getInvoices, createInvoice, updateInvoice,
  deleteInvoice, markOverdueInvoices,
} from '../../../electron/queries/invoices.queries';
import {
  getProductionOrders, createProductionOrder,
  updateProductionOrder, deleteProductionOrder,
} from '../../../electron/queries/production.queries';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function openTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  applyMigrations(sqlite);
  return drizzle(sqlite, { schema });
}

const NOW = new Date().toISOString();
const P = 'test-profile';

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

describe('Phase 2a — Clients', () => {
  const db = openTestDb();

  test('empty profile returns no clients', () => {
    expect(getClients(db, P)).toHaveLength(0);
  });

  test('create client → read back correctly', () => {
    createClient(db, {
      id: 'cli-1', profileId: P, name: 'شركة الحجر',
      phone: '0791234567', email: 'a@b.com', address: 'عمّان',
      balance: 0, createdAt: NOW,
    });
    const clients = getClients(db, P);
    expect(clients).toHaveLength(1);
    expect(clients[0].name).toBe('شركة الحجر');
  });

  test('getClientById returns correct record', () => {
    const c = getClientById(db, 'cli-1');
    expect(c?.phone).toBe('0791234567');
  });

  test('getClientById returns undefined for missing id', () => {
    expect(getClientById(db, 'nope')).toBeUndefined();
  });

  test('update client phone', () => {
    updateClient(db, 'cli-1', { phone: '0799999999' });
    expect(getClientById(db, 'cli-1')?.phone).toBe('0799999999');
  });

  test('updateClientBalance sets new balance', () => {
    updateClientBalance(db, 'cli-1', 5000);
    expect(getClientById(db, 'cli-1')?.balance).toBe(5000);
  });

  test('searchClients finds by partial name', () => {
    createClient(db, { id: 'cli-2', profileId: P, name: 'مؤسسة النور', phone: '', email: '', address: '', balance: 0, createdAt: NOW });
    const results = searchClients(db, P, 'حجر');
    expect(results.map(c => c.id)).toContain('cli-1');
    expect(results.map(c => c.id)).not.toContain('cli-2');
  });

  test('profile isolation — another profile sees no clients', () => {
    expect(getClients(db, 'other-profile')).toHaveLength(0);
  });

  test('delete client removes it', () => {
    deleteClient(db, 'cli-2');
    expect(getClientById(db, 'cli-2')).toBeUndefined();
    expect(getClients(db, P)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Partners
// ---------------------------------------------------------------------------

describe('Phase 2a — Partners', () => {
  const db = openTestDb();

  test('create partner → read back', () => {
    createPartner(db, {
      id: 'par-1', profileId: P, name: 'جميل', ownershipPercentage: 50,
      phone: '', email: '', initialInvestment: 52566,
      joinDate: '2022-01-01', active: true, createdAt: NOW,
    });
    createPartner(db, {
      id: 'par-2', profileId: P, name: 'شكري', ownershipPercentage: 50,
      phone: '', email: '', initialInvestment: 0,
      joinDate: '2022-01-01', active: false, createdAt: NOW,
    });
    expect(getPartners(db, P)).toHaveLength(2);
  });

  test('getActivePartners filters inactive', () => {
    const active = getActivePartners(db, P);
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe('جميل');
  });

  test('getPartnerByName finds exact match', () => {
    const p = getPartnerByName(db, P, 'جميل');
    expect(p?.id).toBe('par-1');
    expect(getPartnerByName(db, P, 'غير موجود')).toBeUndefined();
  });

  test('update ownership percentage', () => {
    updatePartner(db, 'par-1', { ownershipPercentage: 75 });
    expect(getPartnerById(db, 'par-1')?.ownershipPercentage).toBe(75);
  });

  test('set equity account codes', () => {
    updatePartner(db, 'par-1', { capitalAccountCode: '3100', drawingsAccountCode: '3110' });
    const p = getPartnerById(db, 'par-1');
    expect(p?.capitalAccountCode).toBe('3100');
    expect(p?.drawingsAccountCode).toBe('3110');
  });

  test('delete partner', () => {
    deletePartner(db, 'par-2');
    expect(getPartners(db, P)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

describe('Phase 2a — Inventory', () => {
  const db = openTestDb();

  test('create item → read back', () => {
    createInventoryItem(db, {
      id: 'item-1', profileId: P, itemName: 'حجر خام', category: 'مواد خام',
      quantity: 100, unit: 'متر', unitPrice: 25, minStock: 10,
      location: 'مستودع أ', notes: '', inventoryAccountCode: '1301',
      createdAt: NOW,
    });
    const items = getInventoryItems(db, P);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(100);
  });

  test('updateInventoryQuantity', () => {
    updateInventoryQuantity(db, 'item-1', 85);
    const updated = getInventoryItems(db, P)[0];
    expect(updated.quantity).toBe(85);
  });

  test('updateInventoryItem changes fields', () => {
    updateInventoryItem(db, 'item-1', { unitPrice: 30, notes: 'محدّث' });
    const items = getInventoryItems(db, P);
    expect(items[0].unitPrice).toBe(30);
    expect(items[0].notes).toBe('محدّث');
  });

  test('create movement linked to item', () => {
    createInventoryMovement(db, {
      id: 'mov-1', profileId: P, itemId: 'item-1', itemName: 'حجر خام',
      type: 'خروج', quantity: 15, createdAt: NOW,
    });
    const movements = getInventoryMovements(db, P);
    expect(movements).toHaveLength(1);
    expect(movements[0].quantity).toBe(15);
  });

  test('movement foreign key rejects unknown item', () => {
    expect(() => {
      createInventoryMovement(db, {
        id: 'mov-bad', profileId: P, itemId: 'nonexistent',
        itemName: 'Ghost', type: 'دخول', quantity: 5, createdAt: NOW,
      });
    }).toThrow();
  });

  test('delete item', () => {
    deleteInventoryItem(db, 'item-1');
    expect(getInventoryItems(db, P)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Employees, Payroll, Overtime, Advances
// ---------------------------------------------------------------------------

describe('Phase 2a — Employees', () => {
  const db = openTestDb();

  test('create employee → read back', () => {
    createEmployee(db, {
      id: 'emp-1', profileId: P, name: 'أحمد',
      currentSalary: 500, overtimeEligible: true,
      hireDate: '2023-01-01', position: 'عامل', createdAt: NOW,
    });
    expect(getEmployees(db, P)).toHaveLength(1);
    expect(getEmployees(db, P)[0].name).toBe('أحمد');
  });

  test('update salary', () => {
    updateEmployee(db, 'emp-1', { currentSalary: 600 });
    expect(getEmployees(db, P)[0].currentSalary).toBe(600);
  });

  test('create payroll entry', () => {
    createPayrollEntry(db, {
      id: 'pay-1', profileId: P, employeeId: 'emp-1', employeeName: 'أحمد',
      month: '2025-01', baseSalary: 600, overtimeHours: 10, overtimePay: 75,
      totalSalary: 675, isPaid: false, notes: '', createdAt: NOW,
    });
    expect(getPayroll(db, P)).toHaveLength(1);
  });

  test('mark payroll as paid', () => {
    updatePayrollEntry(db, 'pay-1', { isPaid: true, paidDate: NOW });
    const entries = getPayroll(db, P);
    expect(entries[0].isPaid).toBe(true);
  });

  test('create overtime entry', () => {
    createOvertimeEntry(db, {
      id: 'ot-1', profileId: P, employeeId: 'emp-1', employeeName: 'أحمد',
      date: '2025-01-15', hours: 5, notes: '', month: '2025-01',
      createdAt: NOW, createdBy: 'local',
    });
    expect(getOvertimeEntries(db, P)).toHaveLength(1);
  });

  test('delete overtime entry', () => {
    deleteOvertimeEntry(db, 'ot-1');
    expect(getOvertimeEntries(db, P)).toHaveLength(0);
  });

  test('create advance', () => {
    createAdvance(db, {
      id: 'adv-1', profileId: P, employeeId: 'emp-1', employeeName: 'أحمد',
      amount: 200, date: NOW, remainingAmount: 200, status: 'pending',
      linkedTransactionId: 'TXN-001', notes: '', createdAt: NOW,
    });
    expect(getAdvances(db, P)).toHaveLength(1);
  });

  test('salary history is empty for new employee', () => {
    expect(getSalaryHistory(db, P)).toHaveLength(0);
  });

  test('delete employee', () => {
    deleteEmployee(db, 'emp-1');
    expect(getEmployees(db, P)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

describe('Phase 2a — Invoices', () => {
  const db = openTestDb();

  const ITEMS_JSON = JSON.stringify([
    { description: 'حجر مقطوع', quantity: 10, unitPrice: 100, total: 1000, itemType: 'material', unit: 'm' }
  ]);

  test('create invoice → read back', () => {
    createInvoice(db, {
      id: 'inv-1', profileId: P, invoiceNumber: 'INV-001',
      clientName: 'عميل تجريبي', invoiceDate: '2025-01-01',
      dueDate: '2025-02-01', items: ITEMS_JSON,
      subtotal: 1000, taxRate: 0, taxAmount: 0, total: 1000,
      status: 'draft', createdAt: NOW, updatedAt: NOW,
    });
    expect(getInvoices(db, P)).toHaveLength(1);
  });

  test('voided invoices are excluded from getInvoices', () => {
    createInvoice(db, {
      id: 'inv-void', profileId: P, invoiceNumber: 'INV-VOID',
      clientName: 'عميل', invoiceDate: '2025-01-01', dueDate: '2025-02-01',
      items: ITEMS_JSON, subtotal: 0, taxRate: 0, taxAmount: 0, total: 0,
      status: 'voided', createdAt: NOW, updatedAt: NOW,
    });
    expect(getInvoices(db, P)).toHaveLength(1); // voided not returned
  });

  test('update invoice status to sent', () => {
    updateInvoice(db, 'inv-1', { status: 'sent', updatedAt: NOW });
    expect(getInvoices(db, P)[0].status).toBe('sent');
  });

  test('markOverdueInvoices updates past-due sent invoices', () => {
    // inv-1 has dueDate '2025-02-01' which is in the past
    markOverdueInvoices(db, P);
    const inv = getInvoices(db, P).find(i => i.id === 'inv-1');
    expect(inv?.status).toBe('overdue');
  });

  test('delete invoice', () => {
    deleteInvoice(db, 'inv-void');
    const all = getInvoices(db, P);
    expect(all.find(i => i.id === 'inv-void')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Production Orders
// ---------------------------------------------------------------------------

describe('Phase 2a — Production Orders', () => {
  const db = openTestDb();

  test('create production order → read back', () => {
    createProductionOrder(db, {
      id: 'po-1', profileId: P, orderNumber: 'PO-001', date: '2025-01-15',
      inputItemId: 'item-raw', inputItemName: 'حجر خام', inputQuantity: 50,
      outputItemName: 'حجر مقطوع', outputQuantity: 48,
      unit: 'متر', productionExpenses: 200, status: 'قيد التنفيذ',
      notes: '', createdAt: NOW,
    });
    expect(getProductionOrders(db, P)).toHaveLength(1);
    expect(getProductionOrders(db, P)[0].outputQuantity).toBe(48);
  });

  test('update status to completed', () => {
    updateProductionOrder(db, 'po-1', { status: 'مكتمل', completedAt: NOW });
    expect(getProductionOrders(db, P)[0].status).toBe('مكتمل');
  });

  test('delete production order', () => {
    deleteProductionOrder(db, 'po-1');
    expect(getProductionOrders(db, P)).toHaveLength(0);
  });
});
