"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActivityLogs = getActivityLogs;
exports.getActivityLogsForModule = getActivityLogsForModule;
exports.createActivityLog = createActivityLog;
const drizzle_orm_1 = require("drizzle-orm");
const activity_logs_schema_1 = require("../../src/lib/schema/activity-logs.schema");
function getActivityLogs(db, profileId, limit = 200) {
    return db.select().from(activity_logs_schema_1.activityLogs)
        .where((0, drizzle_orm_1.eq)(activity_logs_schema_1.activityLogs.profileId, profileId))
        .orderBy((0, drizzle_orm_1.desc)(activity_logs_schema_1.activityLogs.createdAt))
        .limit(limit)
        .all();
}
function getActivityLogsForModule(db, profileId, module) {
    return getActivityLogs(db, profileId, 1000).filter(l => l.module === module);
}
function createActivityLog(db, data) {
    return db.insert(activity_logs_schema_1.activityLogs).values(data).returning().get();
}
