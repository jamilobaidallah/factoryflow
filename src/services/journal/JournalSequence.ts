/**
 * Journal Sequence Manager
 *
 * Manages gapless sequence numbers for journal entries.
 * Uses Firestore transactions to ensure atomicity even with concurrent posts.
 *
 * Counter document: users/{userId}/counters/journal_sequence
 */

import {
  doc,
  runTransaction,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import type { JournalSequenceCounter } from "./types";

/**
 * Get the counter document reference for a user
 */
function getCounterRef(userId: string) {
  return doc(firestore, `users/${userId}/counters/journal_sequence`);
}

/**
 * Get the next sequence number atomically
 *
 * Uses a Firestore transaction to ensure gapless sequences even
 * with concurrent requests. The pattern:
 * 1. Read current value (0 if doesn't exist)
 * 2. Increment by 1
 * 3. Write new value
 *
 * If two requests run simultaneously, one will retry automatically.
 *
 * @param userId - The user/owner ID
 * @returns The next sequence number (1, 2, 3...)
 */
export async function getNextSequenceNumber(userId: string): Promise<number> {
  const counterRef = getCounterRef(userId);

  return runTransaction(firestore, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);

    // Read current value (0 if doesn't exist)
    const currentSequence = counterDoc.exists()
      ? (counterDoc.data() as JournalSequenceCounter).currentSequence
      : 0;

    const nextSequence = currentSequence + 1;

    // Always set (works for both create and update)
    transaction.set(
      counterRef,
      {
        currentSequence: nextSequence,
        lastUpdated: serverTimestamp(),
      },
      { merge: true }
    );

    return nextSequence;
  });
}

/**
 * Reserve a block of sequence numbers for batch operations
 *
 * Use this when you need to create multiple journal entries in a single batch.
 * This reserves `count` consecutive sequence numbers atomically.
 *
 * @param userId - The user/owner ID
 * @param count - Number of sequences to reserve
 * @returns Array of reserved sequence numbers
 *
 * @example
 * // Reserve 3 sequences for a batch operation
 * const sequences = await reserveSequenceBlock(userId, 3);
 * // sequences = [5, 6, 7] if current was 4
 */
export async function reserveSequenceBlock(
  userId: string,
  count: number
): Promise<number[]> {
  if (count <= 0) {
    return [];
  }

  if (count > 250) {
    throw new Error(
      "Cannot reserve more than 250 sequences at once (Firestore batch limit safety)"
    );
  }

  const counterRef = getCounterRef(userId);

  const startSequence = await runTransaction(firestore, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);

    const currentSequence = counterDoc.exists()
      ? (counterDoc.data() as JournalSequenceCounter).currentSequence
      : 0;

    const newSequence = currentSequence + count;

    transaction.set(
      counterRef,
      {
        currentSequence: newSequence,
        lastUpdated: serverTimestamp(),
      },
      { merge: true }
    );

    // Return the first sequence in the block
    return currentSequence + 1;
  });

  // Generate array of reserved sequences
  return Array.from({ length: count }, (_, i) => startSequence + i);
}

/**
 * Format a sequence number as an entry number
 *
 * @param sequence - The sequence number (1, 2, 3...)
 * @returns Formatted entry number (JE-000001, JE-000002...)
 */
export function formatEntryNumber(sequence: number): string {
  return `JE-${sequence.toString().padStart(6, "0")}`;
}

/**
 * Parse an entry number back to a sequence number
 *
 * @param entryNumber - The formatted entry number (JE-000001)
 * @returns The sequence number (1) or null if invalid
 */
export function parseEntryNumber(entryNumber: string): number | null {
  const match = entryNumber.match(/^JE-(\d{6})$/);
  if (!match) {
    return null;
  }
  return parseInt(match[1], 10);
}

/**
 * Get the current sequence number without incrementing
 *
 * Useful for displaying "next entry will be JE-XXXXXX" in UI
 *
 * @param userId - The user/owner ID
 * @returns Current sequence number (0 if no entries yet)
 */
export async function getCurrentSequence(userId: string): Promise<number> {
  const counterRef = getCounterRef(userId);
  const counterDoc = await getDoc(counterRef);

  if (!counterDoc.exists()) {
    return 0;
  }

  return (counterDoc.data() as JournalSequenceCounter).currentSequence;
}

/**
 * Get the next entry number preview without reserving
 *
 * @param userId - The user/owner ID
 * @returns Preview of next entry number (JE-000001 if no entries yet)
 */
export async function getNextEntryNumberPreview(
  userId: string
): Promise<string> {
  const current = await getCurrentSequence(userId);
  return formatEntryNumber(current + 1);
}
