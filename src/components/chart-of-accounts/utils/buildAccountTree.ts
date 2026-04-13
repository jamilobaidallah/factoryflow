import type { Account } from '@/types/accounting';
import type { AccountNode } from '../types/account-tree';

/**
 * Build a nested account tree from a flat account list.
 *
 * Two-pass O(n) algorithm using a Map for O(1) parent lookups.
 * Orphaned accounts (missing parent) are promoted to root level under their type group.
 *
 * @param accounts - Flat list of accounts (typically active accounts only)
 * @returns Root-level AccountNode array, sorted by code within each level
 */
export function buildAccountTree(accounts: Account[]): AccountNode[] {
  if (accounts.length === 0) return [];

  // Pass 1: create a Map of code → node (with empty children)
  const nodeMap = new Map<string, AccountNode>();
  for (const account of accounts) {
    nodeMap.set(account.code, { ...account, children: [], childrenCount: 0 });
  }

  // Pass 2: link children to parents; collect roots
  const roots: AccountNode[] = [];

  for (const account of accounts) {
    const node = nodeMap.get(account.code)!;
    if (account.parentCode && nodeMap.has(account.parentCode)) {
      const parent = nodeMap.get(account.parentCode)!;
      parent.children.push(node);
    } else {
      // No parent or parent not in set → root node
      roots.push(node);
    }
  }

  // Pass 3: sort children by code at every level, populate childrenCount
  function sortAndCount(nodes: AccountNode[]): void {
    nodes.sort((a, b) => a.code.localeCompare(b.code));
    for (const node of nodes) {
      node.childrenCount = node.children.length;
      sortAndCount(node.children);
    }
  }

  sortAndCount(roots);
  roots.sort((a, b) => a.code.localeCompare(b.code));

  return roots;
}
