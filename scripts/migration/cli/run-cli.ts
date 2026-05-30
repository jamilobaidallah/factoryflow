/**
 * Phase 6 — Migration runner CLI.
 *
 * Run with `npm run migration:run <profileId>`. Opens the named profile's
 * SQLite database in the same AppData location Electron uses, loads the
 * exported JSON files from `export/`, and runs `runMigrationFromDirectory`.
 *
 * Atomic by design: any failure (unbalanced journal, FK violation, malformed
 * JSON) rolls back the whole transaction and leaves the database empty.
 */

/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getDatabase } from '@/lib/database';
import { runMigrationFromDirectory } from '../runner';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const EXPORT_DIR = path.join(PROJECT_ROOT, 'export');

/**
 * Resolve the same AppData path Electron uses on Windows so we open the
 * exact db file the desktop app will read once migration is done.
 * Falls back to a sensible per-OS location for testing on non-Windows.
 */
function appDataRoot(): string {
  if (process.platform === 'win32') {
    return process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support');
  }
  return process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
}

function profileDbPath(profileId: string): string {
  return path.join(appDataRoot(), 'FactoryFlow', profileId, 'data.db');
}

function main(): void {
  const profileId = process.argv[2];
  if (!profileId) {
    console.error('Usage: npm run migration:run <profileId>');
    console.error('  e.g.  npm run migration:run factory-real');
    process.exit(1);
  }

  if (!fs.existsSync(EXPORT_DIR)) {
    console.error(`✗ Export directory not found: ${EXPORT_DIR}`);
    console.error('  Run npm run migration:export first.');
    process.exit(1);
  }

  const dbPath = profileDbPath(profileId);
  if (!fs.existsSync(dbPath)) {
    console.error(`✗ Profile database not found: ${dbPath}`);
    console.error(`  Open the FactoryFlow app, create a profile named "${profileId}", click into it once,`);
    console.error('  then close the app and re-run this command.');
    process.exit(1);
  }

  console.log(`Loading exports from: ${EXPORT_DIR}`);
  console.log(`Opening database:    ${dbPath}`);
  console.log('Migrating in single transaction (any failure → full rollback)…');
  console.log('');

  let result;
  try {
    const db = getDatabase(dbPath);
    result = runMigrationFromDirectory(db, EXPORT_DIR, { profileId });
  } catch (err) {
    console.error('');
    console.error('✗ Migration failed:', err instanceof Error ? err.message : err);
    console.error('  The database is untouched (transaction rolled back).');
    process.exit(1);
  }

  console.log(result.checklist);
  console.log('');

  if (!result.trialBalance.isBalanced) {
    console.error('✗ Trial balance ≠ 0 — go-live blocked. Investigate before retrying.');
    process.exit(1);
  }
  if (result.counts.some((c) => !c.ok)) {
    console.error('✗ Count mismatch — go-live blocked. Investigate before retrying.');
    process.exit(1);
  }

  console.log('✓ Migration completed successfully.');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Open the FactoryFlow app');
  console.log(`  2. Click the "${profileId}" profile`);
  console.log('  3. Spot-check the dashboard totals against Firebase');
  process.exit(0);
}

main();
