"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Plus, Users, BookOpen, FileText, CreditCard } from "lucide-react";

// Quick action items for the FAB menu
const quickActions = [
  {
    id: "client",
    title: "إضافة عميل",
    href: "/clients",
    icon: Users,
    color: "bg-blue-500",
  },
  {
    id: "ledger",
    title: "إضافة قيد",
    href: "/ledger",
    icon: BookOpen,
    color: "bg-green-500",
  },
  {
    id: "cheque",
    title: "إضافة شيك",
    href: "/incoming-cheques",
    icon: FileText,
    color: "bg-purple-500",
  },
  {
    id: "payment",
    title: "إضافة دفعة",
    href: "/payments",
    icon: CreditCard,
    color: "bg-orange-500",
  },
];

export default function FloatingActionButton() {
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();

  // Handle click outside to close menu
  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest("[data-fab-container]")) {
      setIsExpanded(false);
    }
  }, []);

  // Handle escape key to close menu
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsExpanded(false);
    }
  }, []);

  useEffect(() => {
    if (isExpanded) {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExpanded, handleClickOutside, handleKeyDown]);

  // Handle quick action click
  const handleActionClick = (href: string) => {
    setIsExpanded(false);
    router.push(`${href}?action=add`);
  };

  // Calculate position for arc layout (fan out from bottom-right)
  // In RTL, the arc fans out to the left and up
  const getActionPosition = (index: number, total: number) => {
    const baseAngle = 180; // Start from left in RTL
    const arcSpread = 80; // Total arc degrees
    const radius = 70; // Distance from main button

    // Calculate angle for this button (fan from bottom-left to top in RTL)
    const angleStep = arcSpread / (total - 1);
    const angle = baseAngle - (index * angleStep);
    const angleRad = (angle * Math.PI) / 180;

    return {
      x: Math.cos(angleRad) * radius,
      y: Math.sin(angleRad) * radius,
    };
  };

  return (
    <>
      {/* Backdrop overlay when expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 md:hidden"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* FAB Container - only visible on mobile */}
      <div
        data-fab-container
        className="fixed bottom-24 right-4 z-50 md:hidden"
        role="group"
        aria-label="الإجراءات السريعة"
      >
        {/* Quick action buttons */}
        <AnimatePresence>
          {isExpanded && (
            <>
              {quickActions.map((action, index) => {
                const position = getActionPosition(index, quickActions.length);
                const Icon = action.icon;

                return (
                  <motion.div
                    key={action.id}
                    initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      x: position.x,
                      y: -position.y,
                    }}
                    exit={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 25,
                      delay: index * 0.05,
                    }}
                    className="absolute bottom-0 right-0"
                  >
                    <button
                      onClick={() => handleActionClick(action.href)}
                      className={cn(
                        "flex items-center gap-2 h-12 px-4 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95",
                        action.color,
                        "text-white"
                      )}
                      aria-label={action.title}
                    >
                      <Icon className="w-5 h-5" aria-hidden="true" />
                      <span className="text-sm font-medium whitespace-nowrap">
                        {action.title}
                      </span>
                    </button>
                  </motion.div>
                );
              })}
            </>
          )}
        </AnimatePresence>

        {/* Main FAB button */}
        <motion.button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-14 h-14 rounded-full shadow-lg flex items-center justify-center",
            "bg-primary text-primary-foreground",
            "transition-shadow hover:shadow-xl active:shadow-md",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          )}
          animate={{ rotate: isExpanded ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "إغلاق القائمة" : "فتح الإجراءات السريعة"}
          aria-haspopup="menu"
        >
          <Plus className="w-7 h-7" aria-hidden="true" />
        </motion.button>
      </div>
    </>
  );
}
