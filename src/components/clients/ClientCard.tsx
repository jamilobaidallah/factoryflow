"use client";

import { memo } from "react";
import { Phone, Edit, Trash2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/auth";
import { formatNumber } from "@/lib/date-utils";
import type { Client } from "@/hooks/firebase-query/useClientsQueries";

interface ClientCardProps {
  client: Client;
  balance: number;
  onEdit: (client: Client) => void;
  onDelete: (clientId: string) => void;
  onClick: () => void;
  animationDelay?: number;
}

/**
 * Client card component for mobile/card view
 * Features swipe-like interactions and clear balance display
 */
function ClientCardComponent({
  client,
  balance,
  onEdit,
  onDelete,
  onClick,
  animationDelay = 0,
}: ClientCardProps) {
  // Determine balance color and label
  const balanceColor = balance > 0 ? "text-red-600" : balance < 0 ? "text-green-600" : "text-slate-600";
  const balanceLabel = balance > 0 ? "عليه" : balance < 0 ? "له" : "";
  const balanceBg = balance > 0 ? "bg-red-50" : balance < 0 ? "bg-green-50" : "bg-slate-50";

  return (
    <article
      className="card-modern p-4 animate-fade-in-up card-clickable group"
      style={{ animationDelay: `${animationDelay}ms` }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      aria-label={`عرض تفاصيل ${client.name}`}
    >
      {/* Header: Name + Actions */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
            {client.name}
          </h3>
          {client.address && (
            <p className="text-xs text-slate-400 truncate mt-0.5">{client.address}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <PermissionGate action="update" module="clients">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(client);
              }}
              aria-label={`تعديل ${client.name}`}
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
          </PermissionGate>
          <PermissionGate action="delete" module="clients">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(client.id);
              }}
              aria-label={`حذف ${client.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Phone */}
      {client.phone && (
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <Phone className="w-3.5 h-3.5 text-slate-400" />
          <a
            href={`tel:${client.phone}`}
            className="hover:text-blue-600 transition-colors"
            onClick={(e) => e.stopPropagation()}
            dir="ltr"
          >
            {client.phone}
          </a>
        </div>
      )}

      {/* Balance */}
      <div className={`flex items-center justify-between p-2.5 rounded-lg ${balanceBg}`}>
        <span className="text-xs text-slate-500">الرصيد</span>
        <div className="flex items-center gap-1.5">
          <span className={`font-bold ${balanceColor}`}>
            {formatNumber(Math.abs(balance))} دينار
          </span>
          {balanceLabel && (
            <span className={`text-xs ${balanceColor}`}>{balanceLabel}</span>
          )}
        </div>
      </div>

      {/* View details indicator */}
      <div className="flex items-center justify-center mt-3 text-xs text-slate-400 group-hover:text-blue-500 transition-colors">
        <span>عرض التفاصيل</span>
        <ChevronLeft className="w-3.5 h-3.5 ml-0.5 transform group-hover:-translate-x-1 transition-transform" />
      </div>
    </article>
  );
}

export const ClientCard = memo(ClientCardComponent);
