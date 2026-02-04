"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/firebase/provider";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { InventoryItem, ProductionOrder } from "../types/production";
import { convertFirestoreDates, toDateOptional } from "@/lib/firestore-utils";

interface UseProductionDataReturn {
  orders: ProductionOrder[];
  inventoryItems: InventoryItem[];
  loading: boolean;
}

export function useProductionData(): UseProductionDataReturn {
  const { user } = useUser();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load inventory items
  useEffect(() => {
    if (!user) {return;}

    const inventoryRef = collection(firestore, `users/${user.dataOwnerId}/inventory`);
    const q = query(inventoryRef, orderBy("itemName", "asc"), limit(500));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData: InventoryItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        itemsData.push({
          id: doc.id,
          ...data,
        } as InventoryItem);
      });
      setInventoryItems(itemsData);
    });

    return () => unsubscribe();
  }, [user]);

  // Load production orders
  useEffect(() => {
    if (!user) {return;}

    const ordersRef = collection(firestore, `users/${user.dataOwnerId}/production_orders`);
    const q = query(ordersRef, orderBy("date", "desc"), limit(500));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData: ProductionOrder[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        ordersData.push({
          id: doc.id,
          ...convertFirestoreDates(data),
          completedAt: toDateOptional(data.completedAt),
        } as ProductionOrder);
      });
      setOrders(ordersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return { orders, inventoryItems, loading };
}
