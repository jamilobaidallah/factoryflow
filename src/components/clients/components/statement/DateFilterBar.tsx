import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";

interface DateFilterBarProps {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
  filteredCount: number;
  totalCount: number;
}

export function DateFilterBar({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  filteredCount,
  totalCount,
}: DateFilterBarProps) {
  const hasFilter = dateFrom || dateTo;

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 border-b" dir="rtl">
      <span className="text-sm font-medium text-gray-600">تصفية حسب التاريخ:</span>

      {/* From Date */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">من</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={`w-[140px] justify-start text-right font-normal ${
                !dateFrom && "text-muted-foreground"
              }`}
            >
              <CalendarIcon className="ml-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "اختر تاريخ"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={onDateFromChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* To Date */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">إلى</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={`w-[140px] justify-start text-right font-normal ${
                !dateTo && "text-muted-foreground"
              }`}
            >
              <CalendarIcon className="ml-2 h-4 w-4" />
              {dateTo ? format(dateTo, "dd/MM/yyyy") : "اختر تاريخ"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={onDateToChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Clear Filter Button */}
      {hasFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onDateFromChange(undefined);
            onDateToChange(undefined);
          }}
          className="text-gray-500 hover:text-gray-700"
        >
          مسح الفلتر
        </Button>
      )}

      {/* Show filtered count */}
      {hasFilter && (
        <span className="text-sm text-gray-500 mr-auto">
          ({filteredCount} من {totalCount} معاملة)
        </span>
      )}
    </div>
  );
}
