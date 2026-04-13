/**
 * Form data for a single line in a manual journal entry.
 * Amounts stored as strings for form input; parsed to numbers on submit.
 */
export interface JournalLineFormData {
  accountCode: string;
  accountNameAr: string;  // Populated when account is selected
  debit: string;
  credit: string;
  description: string;
}

/**
 * Overall state for the manual journal entry form.
 */
export interface ManualJournalFormState {
  description: string;
  date: string;
  lines: JournalLineFormData[];
}

/**
 * Actions for the line reducer in ManualJournalDialog.
 */
export type LineAction =
  | { type: 'ADD_LINE' }
  | { type: 'REMOVE_LINE'; payload: number }
  | { type: 'UPDATE_LINE'; payload: { index: number; field: keyof JournalLineFormData; value: string } }
  | { type: 'RESET_LINES' };
