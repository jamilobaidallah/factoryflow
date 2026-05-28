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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./ledger.schema"), exports);
__exportStar(require("./journal.schema"), exports);
__exportStar(require("./payments.schema"), exports);
__exportStar(require("./clients.schema"), exports);
__exportStar(require("./partners.schema"), exports);
__exportStar(require("./cheques.schema"), exports);
__exportStar(require("./chart-of-accounts.schema"), exports);
__exportStar(require("./inventory.schema"), exports);
__exportStar(require("./employees.schema"), exports);
__exportStar(require("./fixed-assets.schema"), exports);
__exportStar(require("./invoices.schema"), exports);
__exportStar(require("./production.schema"), exports);
__exportStar(require("./activity-logs.schema"), exports);
__exportStar(require("./favorites.schema"), exports);
