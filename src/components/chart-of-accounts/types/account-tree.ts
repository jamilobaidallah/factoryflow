import type { Account } from '@/types/accounting';

/**
 * Account node in the chart of accounts tree.
 * Extends Account with nested children for tree rendering.
 */
export interface AccountNode extends Account {
  children: AccountNode[];
  childrenCount: number;
}
