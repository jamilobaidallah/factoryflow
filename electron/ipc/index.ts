import type { App } from 'electron';
import { registerProfileHandlers } from './profiles.ipc';
import { registerClientsHandlers } from './clients.ipc';
import { registerPartnersHandlers } from './partners.ipc';
import { registerInventoryHandlers } from './inventory.ipc';
import { registerEmployeesHandlers } from './employees.ipc';
import { registerInvoicesHandlers } from './invoices.ipc';
import { registerProductionHandlers } from './production.ipc';
import { registerChequesHandlers } from './cheques.ipc';
import { registerPaymentsHandlers } from './payments.ipc';
import { registerFixedAssetsHandlers } from './fixed-assets.ipc';
import { registerChartOfAccountsHandlers } from './chart-of-accounts.ipc';
import { registerActivityLogsHandlers } from './activity-logs.ipc';
import { registerFavoritesHandlers } from './favorites.ipc';
import { registerJournalHandlers } from './journal.ipc';
import { registerLedgerHandlers } from './ledger.ipc';

/** Register all IPC handlers. Called once from main.ts before the window opens. */
export function registerAllHandlers(app: App): void {
  registerProfileHandlers(app);
  // Phase 2a
  registerClientsHandlers();
  registerPartnersHandlers();
  registerInventoryHandlers();
  registerEmployeesHandlers();
  registerInvoicesHandlers();
  registerProductionHandlers();
  // Phase 2b
  registerChequesHandlers();
  registerPaymentsHandlers();
  registerFixedAssetsHandlers();
  registerChartOfAccountsHandlers();
  registerActivityLogsHandlers();
  registerFavoritesHandlers();
  // Phase 2c
  registerJournalHandlers();
  registerLedgerHandlers();
}
