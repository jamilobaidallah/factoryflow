"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/firebase/provider";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  getCountFromServer,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { convertFirestoreDates } from "@/lib/firestore-utils";
import { InventoryItem, InventoryMovement } from "../types/inventory.types";

interface UseInventoryDataReturn {
  items: InventoryItem[];
  movements: InventoryMovement[];
  dataLoading: boolean;
  movementsLoading: boolean;
  totalCount: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  pageSize: number;
  totalPages: number;
}

export function useInventoryData(): UseInventoryDataReturn {
  const { user } = useUser();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = Math.ceil(totalCount / pageSize);

  // Fetch total count
  useEffect(() => {
    if (!user) { return; }

    const inventoryRef = collection(firestore, `users/${user.dataOwnerId}/inventory`);
    getCountFromServer(query(inventoryRef)).then((snapshot) => {
      setTotalCount(snapshot.data().count);
    });
  }, [user]);

  // Fetch inventory items with pagination
  useEffect(() => {
    if (!user) { return; }

    const inventoryRef = collection(firestore, `users/${user.dataOwnerId}/inventory`);
    const q = query(inventoryRef, orderBy("itemName", "asc"), limit(pageSize));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData: InventoryItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        itemsData.push({
          id: doc.id,
          ...convertFirestoreDates(data),
        } as InventoryItem);
      });
      setItems(itemsData);
      setDataLoading(false);
    });

    return () => unsubscribe();
  }, [user, pageSize, currentPage]);

  // Fetch inventory movements
  useEffect(() => {
    if (!user) { return; }

    const movementsRef = collection(firestore, `users/${user.dataOwnerId}/inventory_movements`);
    const q = query(movementsRef, orderBy("createdAt", "desc"), limit(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const movementsData: InventoryMovement[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        movementsData.push({
          id: doc.id,
          ...convertFirestoreDates(data),
        } as InventoryMovement);
      });
      setMovements(movementsData);
      setMovementsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return {
    items,
    movements,
    dataLoading,
    movementsLoading,
    totalCount,
    currentPage,
    setCurrentPage,
    pageSize,
    totalPages,
  };
}
