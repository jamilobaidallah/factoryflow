/**
 * @jest-environment node
 *
 * Phase 6 — Firestore export tests.
 *
 * The export module is decoupled from `firebase-admin` via the `FirestoreReader`
 * interface, so these tests use an in-memory implementation. No live Firebase
 * is needed — we're verifying the export does the right collection walks and
 * the special-case logic for payments (subcollection merge).
 */

import { exportAllCollections, listUsers, type FirestoreReader, type ExportedDoc } from '../export';

/**
 * Build an in-memory reader from a flat map of collection-path → documents.
 * Any path not in the map returns an empty array (mirrors Firestore's
 * "collection doesn't exist = empty result" behaviour).
 */
function memoryReader(seed: Record<string, ExportedDoc[]>): FirestoreReader {
  return {
    async getCollection(path: string): Promise<ExportedDoc[]> {
      return seed[path] ?? [];
    },
  };
}

const UID = 'uid-jamil';

describe('exportAllCollections', () => {
  it('returns the full MigrationExports shape with id merged into each doc', async () => {
    const reader = memoryReader({
      [`users/${UID}/clients`]: [
        { id: 'cli-1', data: { name: 'شركة الحجر', phone: '0791111111' } },
        { id: 'cli-2', data: { name: 'مؤسسة البناء', phone: '0792222222' } },
      ],
      [`users/${UID}/partners`]: [
        { id: 'par-1', data: { name: 'جميل', ownershipPercentage: 50 } },
      ],
      [`users/${UID}/ledger`]: [
        { id: 'led-1', data: { type: 'دخل', amount: 5000 } },
      ],
      [`users/${UID}/payments`]: [],
      [`users/${UID}/journal_entries`]: [
        { id: 'je-1', data: { lines: [{ accountCode: '1100', debit: 100, credit: 0 }] } },
      ],
    });

    const out = await exportAllCollections(reader, { userId: UID });

    expect(out.clients).toHaveLength(2);
    expect(out.clients?.[0].id).toBe('cli-1');
    expect(out.clients?.[0].name).toBe('شركة الحجر');
    expect(out.partners?.[0].name).toBe('جميل');
    expect(out.ledger?.[0].amount).toBe(5000);
    expect(out.journal_entries?.[0].lines).toHaveLength(1);
  });

  it('merges each payment\'s allocations subcollection into the parent doc', async () => {
    const reader = memoryReader({
      [`users/${UID}/payments`]: [
        { id: 'pay-1', data: { clientName: 'X', amount: 3000, type: 'قبض' } },
        { id: 'pay-2', data: { clientName: 'Y', amount: 1500, type: 'قبض' } },
      ],
      [`users/${UID}/payments/pay-1/allocations`]: [
        { id: 'alloc-1a', data: { transactionId: 'TXN-A', allocatedAmount: 2000 } },
        { id: 'alloc-1b', data: { transactionId: 'TXN-B', allocatedAmount: 1000 } },
      ],
      [`users/${UID}/payments/pay-2/allocations`]: [
        { id: 'alloc-2', data: { transactionId: 'TXN-C', allocatedAmount: 1500 } },
      ],
    });

    const out = await exportAllCollections(reader, { userId: UID });

    expect(out.payments).toHaveLength(2);
    const pay1 = out.payments?.find((p) => p.id === 'pay-1');
    expect(pay1?.amount).toBe(3000);
    expect(pay1?.allocations).toHaveLength(2);
    expect(pay1?.allocations?.[0].allocatedAmount).toBe(2000);

    const pay2 = out.payments?.find((p) => p.id === 'pay-2');
    expect(pay2?.allocations).toHaveLength(1);
  });

  it('treats missing collections as empty (does not throw)', async () => {
    const reader = memoryReader({
      [`users/${UID}/clients`]: [{ id: 'cli-1', data: { name: 'Solo' } }],
      // No other collections — all should come back empty/undefined-arrays.
    });

    const out = await exportAllCollections(reader, { userId: UID });
    expect(out.clients).toHaveLength(1);
    expect(out.partners).toHaveLength(0);
    expect(out.payments).toHaveLength(0);
    expect(out.journal_entries).toHaveLength(0);
  });

  it('handles a payment with no allocations subcollection', async () => {
    const reader = memoryReader({
      [`users/${UID}/payments`]: [
        { id: 'pay-cash', data: { clientName: 'Z', amount: 100, type: 'قبض' } },
      ],
    });

    const out = await exportAllCollections(reader, { userId: UID });
    expect(out.payments?.[0].allocations).toEqual([]);
  });

  it('invokes the progress callback once per collection in deterministic order', async () => {
    const reader = memoryReader({});
    const seen: Array<{ collection: string; count: number }> = [];

    await exportAllCollections(reader, {
      userId: UID,
      onProgress: (collection, count) => seen.push({ collection, count }),
    });

    // The 8 simple collections come first (parallel — order may vary per run),
    // then payments. We assert the count and the position of "payments" only.
    expect(seen).toHaveLength(9);
    expect(seen.at(-1)?.collection).toBe('payments');
    const simpleNames = new Set(seen.slice(0, 8).map((s) => s.collection));
    expect(simpleNames).toEqual(
      new Set(['clients', 'partners', 'employees', 'inventory',
               'ledger', 'cheques', 'invoices', 'journal_entries']),
    );
  });
});

describe('listUsers', () => {
  it('lists users with their email and display name', async () => {
    const reader = memoryReader({
      'users': [
        { id: 'uid-a', data: { email: 'a@b.com', displayName: 'Alice' } },
        { id: 'uid-b', data: { email: 'b@c.com', displayName: 'Bob' } },
      ],
    });

    const users = await listUsers(reader);
    expect(users).toHaveLength(2);
    expect(users[0]).toEqual({ id: 'uid-a', email: 'a@b.com', displayName: 'Alice' });
  });

  it('omits non-string email/displayName fields gracefully', async () => {
    const reader = memoryReader({
      'users': [{ id: 'uid-x', data: { email: 123, displayName: null } }],
    });

    const users = await listUsers(reader);
    expect(users[0].email).toBeUndefined();
    expect(users[0].displayName).toBeUndefined();
  });

  it('returns an empty array when no users exist', async () => {
    const reader = memoryReader({});
    expect(await listUsers(reader)).toEqual([]);
  });
});
