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
/** Register all IPC handlers. Called once from main.ts before the window opens. */
function registerAllHandlers(app) {
    (0, profiles_ipc_1.registerProfileHandlers)(app);
    (0, clients_ipc_1.registerClientsHandlers)();
    (0, partners_ipc_1.registerPartnersHandlers)();
    (0, inventory_ipc_1.registerInventoryHandlers)();
    (0, employees_ipc_1.registerEmployeesHandlers)();
    (0, invoices_ipc_1.registerInvoicesHandlers)();
    (0, production_ipc_1.registerProductionHandlers)();
}
