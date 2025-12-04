/**
 * Ledger Service Module
 * Re-exports the LedgerService class and related types
 */

// Main service
export { LedgerService, createLedgerService } from "./LedgerService";

// Types
export type {
  ServiceResult,
  DeleteResult,
  InventoryUpdateResult,
  CreateLedgerEntryOptions,
  QuickPaymentData,
  InvoiceData,
  HandlerContext,
  CollectionRefs,
  COGSResult,
} from "./types";

// Handlers (for testing or advanced use cases)
export {
  handleIncomingCheckBatch,
  handleOutgoingCheckBatch,
} from "./handlers/chequeHandlers";

export {
  handleImmediateSettlementBatch,
  handleInitialPaymentBatch,
} from "./handlers/paymentHandlers";

export {
  handleInventoryUpdate,
  addCOGSRecord,
  createNewInventoryItemInBatch,
  addMovementRecordToBatch,
  rollbackInventoryChanges,
} from "./handlers/inventoryHandlers";

export { handleFixedAssetBatch } from "./handlers/fixedAssetHandlers";
