"use client";

import { memo, useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';
import type { CustomDateRange } from '../types/reports.types';

interface ReportsDatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (range: CustomDateRange) => void;
  initialRange?: CustomDateRange | null;
}

/**
 * Date picker modal for custom date range selection
 */
function ReportsDatePickerModalComponent({
  isOpen,
  onClose,
  onConfirm,
  initialRange,
}: ReportsDatePickerModalProps) {
  const today = new Date().toISOString().split('T')[0];
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const lastMonthStr = lastMonth.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(initialRange?.startDate || lastMonthStr);
  const [endDate, setEndDate] = useState(initialRange?.endDate || today);

  // Reset dates when modal opens
  useEffect(() => {
    if (isOpen) {
      setStartDate(initialRange?.startDate || lastMonthStr);
      setEndDate(initialRange?.endDate || today);
    }
  }, [isOpen, initialRange, lastMonthStr, today]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (startDate && endDate && startDate <= endDate) {
      onConfirm({ startDate, endDate });
    }
  };

  const isValidRange = startDate && endDate && startDate <= endDate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-slate-800">تحديد فترة مخصصة</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              من تاريخ
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={endDate || today}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-700"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              إلى تاريخ
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              max={today}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-700"
            />
          </div>

          {/* Quick Presets */}
          <div className="pt-2">
            <p className="text-xs text-slate-500 mb-2">اختيار سريع:</p>
            <div className="flex flex-wrap gap-2">
              <QuickPresetButton
                label="آخر 7 أيام"
                onClick={() => {
                  const end = new Date();
                  const start = new Date();
                  start.setDate(start.getDate() - 7);
                  setStartDate(start.toISOString().split('T')[0]);
                  setEndDate(end.toISOString().split('T')[0]);
                }}
              />
              <QuickPresetButton
                label="آخر 30 يوم"
                onClick={() => {
                  const end = new Date();
                  const start = new Date();
                  start.setDate(start.getDate() - 30);
                  setStartDate(start.toISOString().split('T')[0]);
                  setEndDate(end.toISOString().split('T')[0]);
                }}
              />
              <QuickPresetButton
                label="آخر 90 يوم"
                onClick={() => {
                  const end = new Date();
                  const start = new Date();
                  start.setDate(start.getDate() - 90);
                  setStartDate(start.toISOString().split('T')[0]);
                  setEndDate(end.toISOString().split('T')[0]);
                }}
              />
              <QuickPresetButton
                label="هذا العام"
                onClick={() => {
                  const end = new Date();
                  const start = new Date(end.getFullYear(), 0, 1);
                  setStartDate(start.toISOString().split('T')[0]);
                  setEndDate(end.toISOString().split('T')[0]);
                }}
              />
            </div>
          </div>

          {/* Error message */}
          {startDate && endDate && startDate > endDate && (
            <p className="text-sm text-rose-600">
              تاريخ البداية يجب أن يكون قبل تاريخ النهاية
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValidRange}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isValidRange
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            تطبيق
          </button>
        </div>
      </div>
    </div>
  );
}

/** Quick preset button */
function QuickPresetButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
    >
      {label}
    </button>
  );
}

export const ReportsDatePickerModal = memo(ReportsDatePickerModalComponent);
