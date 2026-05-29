"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccounts = getAccounts;
exports.getActiveAccounts = getActiveAccounts;
exports.getAccountByCode = getAccountByCode;
exports.getAccountById = getAccountById;
exports.createAccount = createAccount;
exports.updateAccount = updateAccount;
exports.deactivateAccount = deactivateAccount;
exports.findNextPartnerEquityCode = findNextPartnerEquityCode;
const drizzle_orm_1 = require("drizzle-orm");
const chart_of_accounts_schema_1 = require("../../src/lib/schema/chart-of-accounts.schema");
function getAccounts(db, profileId) {
    return db.select().from(chart_of_accounts_schema_1.chartOfAccounts)
        .where((0, drizzle_orm_1.eq)(chart_of_accounts_schema_1.chartOfAccounts.profileId, profileId))
        .orderBy(chart_of_accounts_schema_1.chartOfAccounts.code)
        .all();
}
function getActiveAccounts(db, profileId) {
    return getAccounts(db, profileId).filter(a => a.isActive);
}
function getAccountByCode(db, profileId, code) {
    return db.select().from(chart_of_accounts_schema_1.chartOfAccounts)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(chart_of_accounts_schema_1.chartOfAccounts.profileId, profileId), (0, drizzle_orm_1.eq)(chart_of_accounts_schema_1.chartOfAccounts.code, code)))
        .get();
}
function getAccountById(db, id) {
    return db.select().from(chart_of_accounts_schema_1.chartOfAccounts).where((0, drizzle_orm_1.eq)(chart_of_accounts_schema_1.chartOfAccounts.id, id)).get();
}
function createAccount(db, data) {
    return db.insert(chart_of_accounts_schema_1.chartOfAccounts).values(data).returning().get();
}
function updateAccount(db, id, data) {
    return db.update(chart_of_accounts_schema_1.chartOfAccounts).set({ ...data, updatedAt: new Date().toISOString() })
        .where((0, drizzle_orm_1.eq)(chart_of_accounts_schema_1.chartOfAccounts.id, id))
        .returning().get();
}
function deactivateAccount(db, id) {
    db.update(chart_of_accounts_schema_1.chartOfAccounts)
        .set({ isActive: false, updatedAt: new Date().toISOString() })
        .where((0, drizzle_orm_1.eq)(chart_of_accounts_schema_1.chartOfAccounts.id, id))
        .run();
}
/**
 * Find next available partner equity account code in range 3100–3179.
 * Per the chart-of-accounts plan: allocates capital at 3100 + n×20.
 * Returns undefined if range is exhausted (4 partners max).
 */
function findNextPartnerEquityCode(db, profileId) {
    const accounts = getAccounts(db, profileId);
    const usedCodes = new Set(accounts.map(a => parseInt(a.code, 10)));
    for (let candidate = 3100; candidate <= 3160; candidate += 20) {
        if (!usedCodes.has(candidate) && !usedCodes.has(candidate + 10)) {
            return candidate;
        }
    }
    return undefined;
}
