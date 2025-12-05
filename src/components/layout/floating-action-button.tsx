"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Plus, Users, BookOpen, FileText, CreditCard } from "lucide-react";

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

  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest("[data-fab-container]")) {
      setIsExpanded(false);
    }
  }, []);

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

  const handleActionClick = (href: string) => {
    setIsExpanded(false);
    router.push(`${href}?action=add`);
  };

  return (
    <>
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

      <div
        data-fab-container
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-4 z-50 md:hidden flex flex-col-reverse items-end gap-3"
        role="group"
        aria-label="الإجراءات السريعة"
      >
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

        <AnimatePresence>
          {isExpanded && (
            <div className="flex flex-col items-end gap-3">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <motion.button
                    key={action.id}
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 20 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 25,
                      delay: index * 0.05,
                    }}
                    onClick={() => handleActionClick(action.href)}
                    className={cn(
                      "flex items-center gap-3 h-12 px-4 rounded-full shadow-lg",
                      "transition-transform hover:scale-105 active:scale-95",
                      action.color,
                      "text-white"
                    )}
                    aria-label={action.title}
                  >
                    <span className="text-sm font-medium whitespace-nowrap">
                      {action.title}
                    </span>
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </motion.button>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
