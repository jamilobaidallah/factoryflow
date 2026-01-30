"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import {
  FixedAsset,
  PendingPeriod,
  AutoDepreciationResult,
} from "../types/fixed-assets";
import {
  getPendingDepreciationPeriods,
  runAllPendingDepreciation,
} from "@/services/depreciation/autoDepreciationService";

interface UseAutoDepreciationReturn {
  /** List of periods that need depreciation */
  pendingPeriods: PendingPeriod[];
  /** Number of pending periods */
  pendingCount: number;
  /** Oldest pending period label (e.g., "2025-01") */
  oldestPending: string | null;
  /** Whether we're currently checking for pending periods */
  checking: boolean;
  /** Whether we're currently running depreciation */
  running: boolean;
  /** Result of the last auto-depreciation run */
  lastResult: AutoDepreciationResult | null;
  /** Re-check for pending periods */
  refreshPending: () => Promise<void>;
  /** Run depreciation for all pending periods */
  runAllPending: () => Promise<AutoDepreciationResult>;
}

/**
 * Hook for automatic depreciation detection and processing.
 *
 * On mount (when assets are loaded), detects all months that need depreciation
 * based on the earliest asset purchase date and already-processed periods.
 *
 * Provides a function to run all pending periods sequentially.
 */
export function useAutoDepreciation(assets: FixedAsset[]): UseAutoDepreciationReturn {
  const { user } = useUser();
  const { toast } = useToast();

  const [pendingPeriods, setPendingPeriods] = useState<PendingPeriod[]>([]);
  const [checking, setChecking] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<AutoDepreciationResult | null>(null);

  // Check for pending periods when assets change
  const refreshPending = useCallback(async () => {
    if (!user?.dataOwnerId || assets.length === 0) {
      setPendingPeriods([]);
      return;
    }

    setChecking(true);
    try {
      const pending = await getPendingDepreciationPeriods(user.dataOwnerId, assets);
      setPendingPeriods(pending);
    } catch (error) {
      console.error("Failed to check pending depreciation:", error);
      setPendingPeriods([]);
    } finally {
      setChecking(false);
    }
  }, [user?.dataOwnerId, assets]);

  // Auto-check on mount and when assets change
  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  // Run all pending depreciation
  const runAllPending = useCallback(async (): Promise<AutoDepreciationResult> => {
    if (!user) {
      const result: AutoDepreciationResult = {
        success: false,
        processedPeriods: [],
        totalDepreciation: 0,
        errors: ["المستخدم غير مسجل الدخول"],
      };
      setLastResult(result);
      return result;
    }

    if (pendingPeriods.length === 0) {
      const result: AutoDepreciationResult = {
        success: true,
        processedPeriods: [],
        totalDepreciation: 0,
        errors: [],
      };
      setLastResult(result);
      return result;
    }

    setRunning(true);
    try {
      const result = await runAllPendingDepreciation(
        user.dataOwnerId,
        assets,
        user.uid,
        user.email || ""
      );

      setLastResult(result);

      if (result.success) {
        toast({
          title: "تم تسجيل الاستهلاك بنجاح",
          description: `تمت معالجة ${result.processedPeriods.length} فترة بإجمالي ${result.totalDepreciation.toFixed(2)} دينار`,
        });
        // Refresh pending list
        await refreshPending();
      } else if (result.failedAt) {
        toast({
          title: "فشل في معالجة بعض الفترات",
          description: `توقفت المعالجة عند الفترة ${result.failedAt}. تمت معالجة ${result.processedPeriods.length} فترة بنجاح.`,
          variant: "destructive",
        });
        // Refresh to update what's still pending
        await refreshPending();
      }

      return result;
    } catch (error) {
      const result: AutoDepreciationResult = {
        success: false,
        processedPeriods: [],
        totalDepreciation: 0,
        errors: [error instanceof Error ? error.message : "خطأ غير متوقع"],
      };
      setLastResult(result);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء معالجة الاستهلاك التلقائي",
        variant: "destructive",
      });
      return result;
    } finally {
      setRunning(false);
    }
  }, [user, assets, pendingPeriods.length, toast, refreshPending]);

  return {
    pendingPeriods,
    pendingCount: pendingPeriods.length,
    oldestPending: pendingPeriods.length > 0 ? pendingPeriods[0].periodLabel : null,
    checking,
    running,
    lastResult,
    refreshPending,
    runAllPending,
  };
}
