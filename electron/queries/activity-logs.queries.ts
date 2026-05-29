import { eq, desc } from 'drizzle-orm';
import type { DrizzleDb } from '../../src/lib/database';
import { activityLogs } from '../../src/lib/schema/activity-logs.schema';

export type ActivityLogRow    = typeof activityLogs.$inferSelect;
export type NewActivityLogRow = typeof activityLogs.$inferInsert;

export function getActivityLogs(
  db: DrizzleDb,
  profileId: string,
  limit = 200
): ActivityLogRow[] {
  return db.select().from(activityLogs)
    .where(eq(activityLogs.profileId, profileId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit)
    .all();
}

export function getActivityLogsForModule(
  db: DrizzleDb,
  profileId: string,
  module: string
): ActivityLogRow[] {
  return getActivityLogs(db, profileId, 1000).filter(l => l.module === module);
}

export function createActivityLog(db: DrizzleDb, data: NewActivityLogRow): ActivityLogRow {
  return db.insert(activityLogs).values(data).returning().get();
}
