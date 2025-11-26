/**
 * Validated Input Component
 *
 * Input field with built-in validation, error display, and success feedback
 */

"use client";

import { useState, useEffect } from "react";
import { Input } from "./input";
import { Label } from "./label";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export interface ValidatedInputProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  error?: string; // External error message (from Zod validation)
  hint?: string;
  className?: string;
  disabled?: boolean;
  maxLength?: number;
  showSuccessIndicator?: boolean;
}

export function ValidatedInput({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  error,
  hint,
  className,
  disabled = false,
  maxLength,
  showSuccessIndicator = true,
}: ValidatedInputProps) {
  const [touched, setTouched] = useState(false);

  const handleBlur = () => {
    setTouched(true);
  };

  const handleChange = (newValue: string) => {
    onChange(newValue);
  };

  const hasError = touched && error;
  const isValid = touched && !error && value.length > 0 && showSuccessIndicator;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={name} className="flex items-center gap-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>

      <div className="relative">
        <Input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          className={cn(
            hasError && "border-red-500 focus-visible:ring-red-500 pr-10",
            isValid && "border-green-500 focus-visible:ring-green-500 pr-10"
          )}
        />

        {touched && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {error ? (
              <AlertCircle className="w-5 h-5 text-red-500" />
            ) : value && showSuccessIndicator ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : null}
          </div>
        )}
      </div>

      {hint && !hasError && (
        <p className="text-xs text-gray-500">{hint}</p>
      )}

      {hasError && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}

      {isValid && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          صحيح
        </p>
      )}

      {maxLength && (
        <p className="text-xs text-gray-400 text-left">
          {value.length}/{maxLength}
        </p>
      )}
    </div>
  );
}
