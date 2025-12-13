"use client";

import { useState, useEffect, memo } from "react";
import { formatNumber } from "@/lib/date-utils";
import { DASHBOARD_CONFIG, DASHBOARD_LABELS } from "../constants/dashboard.constants";
import type { DashboardHeroProps } from "../types/dashboard.types";

/**
 * Hero section displaying the main cash balance
 * Features animated counter and subtle background effect
 */
function DashboardHeroComponent({ cashBalance, isAnimating }: DashboardHeroProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const isNegative = cashBalance < 0;
  const targetValue = Math.abs(cashBalance);

  // Animate counter when cash balance changes
  useEffect(() => {
    if (!isAnimating || targetValue === 0) {
      setDisplayValue(targetValue);
      return;
    }

    let currentValue = 0;
    const increment = targetValue / (DASHBOARD_CONFIG.ANIMATION_DURATION_MS / DASHBOARD_CONFIG.ANIMATION_FRAME_MS);

    const timer = setInterval(() => {
      currentValue += increment;
      if (currentValue >= targetValue) {
        setDisplayValue(targetValue);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(currentValue));
      }
    }, DASHBOARD_CONFIG.ANIMATION_FRAME_MS);

    return () => clearInterval(timer);
  }, [targetValue, isAnimating]);

  return (
    <section
      className="bg-slate-800 rounded-2xl p-8 text-center relative overflow-hidden"
      aria-label={DASHBOARD_LABELS.cashBalance}
    >
      {/* Animated background effect */}
      <div className="absolute inset-0 opacity-5" aria-hidden="true">
        <div
          className="absolute w-96 h-96 rounded-full bg-white"
          style={{
            top: "-50%",
            right: "-10%",
            animation: "dashboardPulse 4s ease-in-out infinite",
          }}
        />
      </div>

      {/* Content */}
      <p className="text-slate-400 text-sm font-medium mb-2 tracking-wide relative">
        {DASHBOARD_LABELS.cashBalance}
      </p>
      <p
        className={`text-5xl font-semibold tracking-tight relative ${
          isNegative ? "text-rose-400" : "text-white"
        }`}
      >
        {isNegative ? "-" : ""}
        {formatNumber(displayValue)}
      </p>
      <p className="text-slate-400 text-lg mt-1 relative">{DASHBOARD_LABELS.currency}</p>

      {/* Keyframes for animation */}
      <style jsx>{`
        @keyframes dashboardPulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.05;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.08;
          }
        }
      `}</style>
    </section>
  );
}

export const DashboardHero = memo(DashboardHeroComponent);
