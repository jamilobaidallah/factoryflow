/**
 * Phase 6 — Firebase export CLI.
 *
 * Run with `npm run migration:export`. Reads `firebase-key.json` from the
 * project root, connects to Firestore via the Admin SDK, exports every
 * supported collection under `users/{uid}/...`, and writes each as a JSON
 * file under `export/`.
 *
 * If multiple user documents exist in `users/`, the script auto-picks the
 * one matching the service-account project unless `--user-id <uid>` is given.
 */

/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { exportAllCollections, listUsers, type FirestoreReader } from '../export';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const KEY_PATH = path.join(PROJECT_ROOT, 'firebase-key.json');
const EXPORT_DIR = path.join(PROJECT_ROOT, 'export');

/** Map common Firestore Admin Timestamp values to plain JSON-serializable shapes. */
function jsonReplacer(_key: string, value: unknown): unknown {
  // firebase-admin Timestamps expose .toDate() — serialize as ISO string for
  // the runner's `firestoreTimestampToIso` to pick up cleanly.
  if (value && typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return value;
}

/** Wrap firebase-admin's Firestore in the FirestoreReader interface. */
function buildReader(fs: Firestore): FirestoreReader {
  return {
    async getCollection(p: string) {
      const snap = await fs.collection(p).get();
      return snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }));
    },
  };
}

function parseArgs(argv: string[]): { userId?: string } {
  const out: { userId?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--user-id' && argv[i + 1]) {
      out.userId = argv[i + 1];
      i++;
    }
  }
  return out;
}

async function main(): Promise<void> {
  // 1. Sanity-check the key file exists before initialising anything.
  if (!fs.existsSync(KEY_PATH)) {
    console.error(`✗ firebase-key.json not found at: ${KEY_PATH}`);
    console.error('  Download a service-account key from Firebase Console →');
    console.error('  Project Settings → Service Accounts → Generate new private key.');
    process.exit(1);
  }

  // 2. Initialise the Admin SDK exactly once per process.
  if (getApps().length === 0) {
    const credentials = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
    initializeApp({ credential: cert(credentials) });
  }
  const reader = buildReader(getFirestore());

  // 3. Resolve which user to export.
  const args = parseArgs(process.argv.slice(2));
  let userId = args.userId;
  if (!userId) {
    const users = await listUsers(reader);
    if (users.length === 0) {
      console.error('✗ No user documents found under users/. Nothing to export.');
      process.exit(1);
    }
    if (users.length > 1) {
      console.error('✗ Multiple users found. Re-run with --user-id <uid>:');
      for (const u of users) {
        console.error(`    ${u.id}   ${u.email ?? '(no email)'}   ${u.displayName ?? ''}`);
      }
      process.exit(1);
    }
    userId = users[0].id;
    console.log(`User auto-selected: ${userId} (${users[0].email ?? '(no email)'})`);
  }

  // 4. Run the export with live progress reporting.
  console.log(`Connecting to Firebase project (project_id from firebase-key.json)…`);
  console.log(`Exporting user: ${userId}`);

  const result = await exportAllCollections(reader, {
    userId,
    // NOTE: cannot reference `result` here — it's in the TDZ until the
    // await resolves. Report the allocations count after binding.
    onProgress: (collection, count) => {
      console.log(`  ✓ ${collection}: ${count} documents`);
    },
  });

  const allocationsTotal = result.payments?.reduce(
    (sum, p) => sum + (p.allocations?.length ?? 0),
    0,
  ) ?? 0;
  if (allocationsTotal > 0) {
    console.log(`     (${allocationsTotal} payment allocations flattened from subcollections)`);
  }

  // 5. Write each collection to its own JSON file under export/.
  if (!fs.existsSync(EXPORT_DIR)) { fs.mkdirSync(EXPORT_DIR, { recursive: true }); }
  let totalDocs = 0;
  for (const [collection, docs] of Object.entries(result)) {
    if (!Array.isArray(docs)) { continue; }
    const file = path.join(EXPORT_DIR, `${collection}.json`);
    fs.writeFileSync(file, JSON.stringify(docs, jsonReplacer, 2), 'utf8');
    totalDocs += docs.length;
  }

  console.log('');
  console.log(`✓ ${totalDocs} documents exported to: ${EXPORT_DIR}`);
  console.log('');
  console.log('Next step: npm run migration:run <profileId>');
  console.log('  e.g.  npm run migration:run factory-real');
  process.exit(0);
}

main().catch((err) => {
  console.error('✗ Export failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
