import type { DrizzleDb } from '../src/lib/database';

let _db: DrizzleDb | null = null;
let _profileId: string | null = null;

export function setActiveDb(db: DrizzleDb, profileId: string): void {
  _db = db;
  _profileId = profileId;
}

export function getActiveDb(): DrizzleDb {
  if (!_db) {
    throw new Error('No active database. Open a profile first.');
  }
  return _db;
}

export function getActiveProfileId(): string {
  if (!_profileId) {
    throw new Error('No active profile. Open a profile first.');
  }
  return _profileId;
}

export function clearActiveDb(): void {
  _db = null;
  _profileId = null;
}
