/**
 * Ledger Service
 *
 * This file re-exports from the new modular structure for backwards compatibility.
 * The implementation has been split into focused modules under ./ledger/
 *
 * @see ./ledger/LedgerService.ts - Main service class
 * @see ./ledger/handlers/ - Domain-specific batch operation handlers
 */

export {
  LedgerService,
  createLedgerService,
} from "./ledger";

export type {
  ServiceResult,
  DeleteResult,
  InventoryUpdateResult,
  CreateLedgerEntryOptions,
  QuickPaymentData,
  InvoiceData,
} from "./ledger";
