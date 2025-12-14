"use client";

import { memo, useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileText, FileSpreadsheet, File } from 'lucide-react';
import { REPORTS_LABELS } from '../constants/reports.constants';
import type { ReportsHeaderProps } from '../types/reports.types';

/**
 * Reports page header with title and export dropdown
 */
function ReportsHeaderComponent({
  onExportPDF,
  onExportExcel,
  onExportCSV,
}: ReportsHeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = (type: 'pdf' | 'excel' | 'csv') => {
    setIsDropdownOpen(false);
    switch (type) {
      case 'pdf':
        onExportPDF();
        break;
      case 'excel':
        onExportExcel();
        break;
      case 'csv':
        onExportCSV();
        break;
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{REPORTS_LABELS.pageTitle}</h1>
        <p className="text-slate-500 text-sm mt-1">{REPORTS_LABELS.pageSubtitle}</p>
      </div>

      {/* Export Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
        >
          <Download className="w-5 h-5" />
          {REPORTS_LABELS.export}
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute left-0 mt-2 w-48 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
            <button
              onClick={() => handleExport('pdf')}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <FileText className="w-4 h-4 text-rose-500" />
              {REPORTS_LABELS.exportPDF}
            </button>
            <button
              onClick={() => handleExport('excel')}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              {REPORTS_LABELS.exportExcel}
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <File className="w-4 h-4 text-blue-500" />
              {REPORTS_LABELS.exportCSV}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export const ReportsHeader = memo(ReportsHeaderComponent);
