"use client";

import { useState, useCallback, useRef } from "react";

/**
 * خيارات السحب - Swipe configuration options
 */
interface SwipeOptions {
  // الحد الأدنى للمسافة لتفعيل السحب
  threshold?: number;
  // أقصى مسافة سحب (بالبكسل)
  maxSwipeDistance?: number;
  // تفعيل السحب لليسار
  enableLeftSwipe?: boolean;
  // تفعيل السحب لليمين
  enableRightSwipe?: boolean;
  // دالة تنفذ عند السحب لليسار
  onSwipeLeft?: () => void;
  // دالة تنفذ عند السحب لليمين
  onSwipeRight?: () => void;
}

/**
 * نتائج وحالة السحب - Swipe state and handlers
 */
interface SwipeState {
  // المسافة الحالية للسحب (موجب = يمين، سالب = يسار)
  swipeOffset: number;
  // هل يتم السحب حالياً
  isSwiping: boolean;
  // هل تم تفعيل إجراء اليسار
  isLeftActionActive: boolean;
  // هل تم تفعيل إجراء اليمين
  isRightActionActive: boolean;
  // إعادة ضبط حالة السحب
  reset: () => void;
}

/**
 * معالجات الأحداث للسحب - Swipe event handlers
 */
interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
}

/**
 * useSwipe - Hook لإدارة حركات السحب على العناصر
 *
 * يدعم السحب لليسار واليمين مع تحديد عتبة التفعيل ومسافة السحب القصوى
 * يعمل مع اللمس (touch) والفأرة (mouse)
 */
export function useSwipe(options: SwipeOptions = {}): [SwipeState, SwipeHandlers] {
  const {
    threshold = 50,
    maxSwipeDistance = 100,
    enableLeftSwipe = true,
    enableRightSwipe = true,
    onSwipeLeft,
    onSwipeRight,
  } = options;

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  // مرجع لتتبع نقطة البداية - Reference to track starting point
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const isTrackingRef = useRef(false);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  // حساب ما إذا كانت الإجراءات مفعلة - Calculate if actions are active
  const isLeftActionActive = swipeOffset < -threshold;
  const isRightActionActive = swipeOffset > threshold;

  const reset = useCallback(() => {
    setSwipeOffset(0);
    setIsSwiping(false);
    startXRef.current = null;
    startYRef.current = null;
    isTrackingRef.current = false;
    isHorizontalSwipeRef.current = null;
  }, []);

  const handleStart = useCallback((clientX: number, clientY: number) => {
    startXRef.current = clientX;
    startYRef.current = clientY;
    isTrackingRef.current = true;
    isHorizontalSwipeRef.current = null;
    setIsSwiping(true);
  }, []);

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isTrackingRef.current || startXRef.current === null || startYRef.current === null) {
        return;
      }

      const deltaX = clientX - startXRef.current;
      const deltaY = clientY - startYRef.current;

      // تحديد اتجاه السحب في أول حركة - Determine swipe direction on first move
      if (isHorizontalSwipeRef.current === null) {
        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
          isHorizontalSwipeRef.current = Math.abs(deltaX) > Math.abs(deltaY);
        }
        return;
      }

      // إذا كان السحب عمودي، نتجاهل - Ignore vertical swipes
      if (!isHorizontalSwipeRef.current) {
        return;
      }

      // حساب المسافة المحددة - Calculate clamped distance
      let clampedOffset = deltaX;

      // تطبيق الحدود حسب الاتجاه المفعل - Apply limits based on enabled directions
      if (!enableRightSwipe && clampedOffset > 0) {
        clampedOffset = 0;
      }
      if (!enableLeftSwipe && clampedOffset < 0) {
        clampedOffset = 0;
      }

      // تحديد المسافة القصوى - Clamp to max distance
      clampedOffset = Math.max(-maxSwipeDistance, Math.min(maxSwipeDistance, clampedOffset));

      setSwipeOffset(clampedOffset);
    },
    [enableLeftSwipe, enableRightSwipe, maxSwipeDistance]
  );

  const handleEnd = useCallback(() => {
    if (!isTrackingRef.current) {
      return;
    }

    // تنفيذ الإجراء إذا تجاوز العتبة - Execute action if threshold exceeded
    if (isLeftActionActive && onSwipeLeft) {
      onSwipeLeft();
    } else if (isRightActionActive && onSwipeRight) {
      onSwipeRight();
    }

    reset();
  }, [isLeftActionActive, isRightActionActive, onSwipeLeft, onSwipeRight, reset]);

  // معالجات اللمس - Touch handlers
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      handleStart(touch.clientX, touch.clientY);
    },
    [handleStart]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    },
    [handleMove]
  );

  const onTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // معالجات الفأرة - Mouse handlers (for desktop testing)
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      handleStart(e.clientX, e.clientY);
    },
    [handleStart]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    },
    [handleMove]
  );

  const onMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const onMouseLeave = useCallback(() => {
    if (isTrackingRef.current) {
      handleEnd();
    }
  }, [handleEnd]);

  const state: SwipeState = {
    swipeOffset,
    isSwiping,
    isLeftActionActive,
    isRightActionActive,
    reset,
  };

  const handlers: SwipeHandlers = {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
  };

  return [state, handlers];
}
