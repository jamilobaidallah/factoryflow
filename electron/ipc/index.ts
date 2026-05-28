import type { App } from 'electron';
import { registerProfileHandlers } from './profiles.ipc';
import { registerClientsHandlers } from './clients.ipc';
import { registerPartnersHandlers } from './partners.ipc';
import { registerInventoryHandlers } from './inventory.ipc';
import { registerEmployeesHandlers } from './employees.ipc';
import { registerInvoicesHandlers } from './invoices.ipc';
import { registerProductionHandlers } from './production.ipc';

/** Register all IPC handlers. Called once from main.ts before the window opens. */
export function registerAllHandlers(app: App): void {
  registerProfileHandlers(app);
  registerClientsHandlers();
  registerPartnersHandlers();
  registerInventoryHandlers();
  registerEmployeesHandlers();
  registerInvoicesHandlers();
  registerProductionHandlers();
}
