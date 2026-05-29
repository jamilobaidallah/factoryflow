"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAllHandlers = registerAllHandlers;
const profiles_ipc_1 = require("./profiles.ipc");
const clients_ipc_1 = require("./clients.ipc");
const partners_ipc_1 = require("./partners.ipc");
const inventory_ipc_1 = require("./inventory.ipc");
const employees_ipc_1 = require("./employees.ipc");
const invoices_ipc_1 = require("./invoices.ipc");
const production_ipc_1 = require("./production.ipc");
const cheques_ipc_1 = require("./cheques.ipc");
const payments_ipc_1 = require("./payments.ipc");
const fixed_assets_ipc_1 = require("./fixed-assets.ipc");
const chart_of_accounts_ipc_1 = require("./chart-of-accounts.ipc");
const activity_logs_ipc_1 = require("./activity-logs.ipc");
const favorites_ipc_1 = require("./favorites.ipc");
const journal_ipc_1 = require("./journal.ipc");
const ledger_ipc_1 = require("./ledger.ipc");
/** Register all IPC handlers. Called once from main.ts before the window opens. */
function registerAllHandlers(app) {
    (0, profiles_ipc_1.registerProfileHandlers)(app);
    // Phase 2a
    (0, clients_ipc_1.registerClientsHandlers)();
    (0, partners_ipc_1.registerPartnersHandlers)();
    (0, inventory_ipc_1.registerInventoryHandlers)();
    (0, employees_ipc_1.registerEmployeesHandlers)();
    (0, invoices_ipc_1.registerInvoicesHandlers)();
    (0, production_ipc_1.registerProductionHandlers)();
    // Phase 2b
    (0, cheques_ipc_1.registerChequesHandlers)();
    (0, payments_ipc_1.registerPaymentsHandlers)();
    (0, fixed_assets_ipc_1.registerFixedAssetsHandlers)();
    (0, chart_of_accounts_ipc_1.registerChartOfAccountsHandlers)();
    (0, activity_logs_ipc_1.registerActivityLogsHandlers)();
    (0, favorites_ipc_1.registerFavoritesHandlers)();
    // Phase 2c
    (0, journal_ipc_1.registerJournalHandlers)();
    (0, ledger_ipc_1.registerLedgerHandlers)();
}
