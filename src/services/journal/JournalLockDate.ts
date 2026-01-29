/**
 * Journal Lock Date Manager
 *
 * Prevents posting or reversing entries into closed accounting periods.
 * The lock date is the last date of the closed period - no entries
 * can be created or reversed on or before this date.
 *
 * Settings document: users/{userId}/settings/accounting
 */

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { firestore } from "@/firebase/config";
import type { AccountingSettings } from "./types";

/**
 * Get the accounting settings document reference
 */
function getSettingsRef(userId: string) {
  return doc(firestore, `users/${userId}/settings/accounting`);
}

/**
 * Get the lock date for a user
 *
 * @param userId - The user/owner ID
 * @returns The lock date, or null if not set
 */
export async function getLockDate(userId: string): Promise<Date | null> {
  const settingsRef = getSettingsRef(userId);
  const settingsDoc = await getDoc(settingsRef);

  if (!settingsDoc.exists()) {
    return null;
  }

  const settings = settingsDoc.data() as AccountingSettings;
  if (!settings.lockDate) {
    return null;
  }

  // Handle Firestore Timestamp conversion
  const lockDate = settings.lockDate;
  if (lockDate && typeof (lockDate as unknown as { toDate?: () => Date }).toDate === "function") {
    return (lockDate as unknown as { toDate: () => Date }).toDate();
  }

  return lockDate instanceof Date ? lockDate : new Date(lockDate);
}

/**
 * Check if a date is in a locked period
 *
 * A date is locked if it's on or before the lock date.
 *
 * @param userId - The user/owner ID
 * @param date - The date to check
 * @returns True if the date is locked
 */
export async function isDateLocked(userId: string, date: Date): Promise<boolean> {
  const lockDate = await getLockDate(userId);

  if (!lockDate) {
    return false;
  }

  // Compare dates only (ignore time)
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  const lockDateNormalized = new Date(lockDate);
  lockDateNormalized.setHours(0, 0, 0, 0);

  return checkDate <= lockDateNormalized;
}

/**
 * Validate that posting is allowed for a given date
 *
 * Throws an error if the date is in a locked period.
 *
 * @param userId - The user/owner ID
 * @param date - The date to validate
 * @throws Error if date is locked
 */
export async function validatePostingDate(
  userId: string,
  date: Date
): Promise<void> {
  const locked = await isDateLocked(userId, date);

  if (locked) {
    const lockDate = await getLockDate(userId);
    const formattedLockDate = lockDate
      ? lockDate.toLocaleDateString("ar-EG")
      : "";

    throw new Error(
      `التاريخ في فترة محاسبية مقفلة. لا يمكن إضافة أو تعديل قيود بتاريخ ${date.toLocaleDateString(
        "ar-EG"
      )}. تاريخ الإقفال: ${formattedLockDate}`
    );
  }
}

/**
 * Set the lock date
 *
 * This should only be called by users with owner role.
 * The lock date is the last date of the closed period.
 *
 * @param userId - The user/owner ID
 * @param lockDate - The lock date to set
 */
export async function setLockDate(
  userId: string,
  lockDate: Date
): Promise<void> {
  const settingsRef = getSettingsRef(userId);

  await setDoc(
    settingsRef,
    {
      lockDate,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Clear the lock date (allow posting to all periods)
 *
 * This should only be called by users with owner role.
 *
 * @param userId - The user/owner ID
 */
export async function clearLockDate(userId: string): Promise<void> {
  const settingsRef = getSettingsRef(userId);

  await setDoc(
    settingsRef,
    {
      lockDate: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Get all accounting settings
 *
 * @param userId - The user/owner ID
 * @returns The accounting settings
 */
export async function getAccountingSettings(
  userId: string
): Promise<AccountingSettings> {
  const settingsRef = getSettingsRef(userId);
  const settingsDoc = await getDoc(settingsRef);

  if (!settingsDoc.exists()) {
    return {};
  }

  const data = settingsDoc.data() as AccountingSettings;

  // Convert Firestore Timestamp to Date if needed
  if (data.lockDate) {
    const lockDate = data.lockDate;
    if (typeof (lockDate as unknown as { toDate?: () => Date }).toDate === "function") {
      data.lockDate = (lockDate as unknown as { toDate: () => Date }).toDate();
    }
  }

  return data;
}

/**
 * Update accounting settings
 *
 * @param userId - The user/owner ID
 * @param settings - Partial settings to update
 */
export async function updateAccountingSettings(
  userId: string,
  settings: Partial<AccountingSettings>
): Promise<void> {
  const settingsRef = getSettingsRef(userId);

  await setDoc(
    settingsRef,
    {
      ...settings,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Format a date for display in Arabic
 *
 * @param date - The date to format
 * @returns Formatted date string
 */
export function formatDateArabic(date: Date): string {
  return date.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Get the end of a month (for setting lock dates)
 *
 * @param year - The year
 * @param month - The month (1-12)
 * @returns The last day of the month
 */
export function getMonthEnd(year: number, month: number): Date {
  // Month is 1-based, but Date uses 0-based months
  // So month 12 becomes month 0 of next year when we subtract 1
  return new Date(year, month, 0); // Day 0 = last day of previous month
}

/**
 * Get the end of a year (for fiscal year closing)
 *
 * @param year - The year
 * @param fiscalYearEnd - Fiscal year end in "MM-DD" format (default: "12-31")
 * @returns The fiscal year end date
 */
export function getFiscalYearEnd(
  year: number,
  fiscalYearEnd: string = "12-31"
): Date {
  const [month, day] = fiscalYearEnd.split("-").map(Number);
  return new Date(year, month - 1, day);
}
