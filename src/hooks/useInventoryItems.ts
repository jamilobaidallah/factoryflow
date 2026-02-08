/**
 * useInventoryItems Hook
 *
 * Fetches inventory items for use in dropdown selectors.
 * Returns a simplified list with id, name, and unit.
 */

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { useUser } from '@/firebase/provider';
import { QUERY_LIMITS } from '@/lib/constants';

export interface InventoryItemOption {
  id: string;
  name: string;
  unit: string;
}

interface UseInventoryItemsResult {
  items: InventoryItemOption[];
  loading: boolean;
  error: string | null;
}

export function useInventoryItems(): UseInventoryItemsResult {
  const { user } = useUser();
  const [items, setItems] = useState<InventoryItemOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setError(null);
    const inventoryRef = collection(firestore, `users/${user.dataOwnerId}/inventory`);
    const q = query(inventoryRef, orderBy('itemName', 'asc'), limit(QUERY_LIMITS.INVENTORY_ITEMS));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const itemsData: InventoryItemOption[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          itemsData.push({
            id: doc.id,
            name: data.itemName || '',
            unit: data.unit || '',
          });
        });
        setItems(itemsData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching inventory items:', err);
        setError('حدث خطأ أثناء جلب أصناف المخزون');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  return { items, loading, error };
}
