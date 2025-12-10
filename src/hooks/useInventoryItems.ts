/**
 * useInventoryItems Hook
 *
 * Fetches inventory items for use in dropdown selectors.
 * Returns a simplified list with id, name, and unit.
 */

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { useUser } from '@/firebase/provider';

export interface InventoryItemOption {
  id: string;
  name: string;
  unit: string;
}

interface UseInventoryItemsResult {
  items: InventoryItemOption[];
  loading: boolean;
}

export function useInventoryItems(): UseInventoryItemsResult {
  const { user } = useUser();
  const [items, setItems] = useState<InventoryItemOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const inventoryRef = collection(firestore, `users/${user.uid}/inventory`);
    const q = query(inventoryRef, orderBy('itemName', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
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
    });

    return () => unsubscribe();
  }, [user]);

  return { items, loading };
}
