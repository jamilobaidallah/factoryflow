/**
 * Form Field with Validation
 *
 * Enhanced form fields with real-time validation feedback
 */

"use client";

import { ReactNode, useState } from "react";
import { Input } from "./input";
import { Label } from "./label";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface FormFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  validate?: (value: string) => string | null;
  hint?: string;
  className?: string;
}

export function FormFieldWithValidation({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  validate,
  hint,
  className,
}: FormFieldProps) {
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBlur = () => {
    setTouched(true);
    if (validate) {
      const validationError = validate(value);
      setError(validationError);
    } else if (required && !value) {
      setError("هذا الحقل مطلوب");
    }
  };

  const handleChange = (newValue: string) => {
    onChange(newValue);
    if (touched) {
      if (validate) {
        const validationError = validate(newValue);
        setError(validationError);
      } else if (required && !newValue) {
        setError("هذا الحقل مطلوب");
      } else {
        setError(null);
      }
    }
  };

  const isValid = touched && !error && value.length > 0;

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
          className={cn(
            touched && error && "border-red-500 focus-visible:ring-red-500",
            isValid && "border-green-500 focus-visible:ring-green-500"
          )}
        />

        {touched && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            {error ? (
              <AlertCircle className="w-5 h-5 text-red-500" />
            ) : value && (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            )}
          </div>
        )}
      </div>

      {hint && !error && !touched && (
        <p className="text-xs text-gray-500">{hint}</p>
      )}

      {touched && error && (
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
    </div>
  );
}

// Validation helpers
export const validators = {
  required: (value: string) => {
    return value.trim() ? null : "هذا الحقل مطلوب";
  },

  number: (value: string) => {
    if (!value) {return null;}
    return !isNaN(Number(value)) ? null : "يجب إدخال رقم صحيح";
  },

  positiveNumber: (value: string) => {
    if (!value) {return null;}
    const num = Number(value);
    return num > 0 ? null : "يجب أن يكون الرقم أكبر من صفر";
  },

  phone: (value: string) => {
    if (!value) {return null;}
    const phoneRegex = /^[0-9]{7,20}$/;
    return phoneRegex.test(value) ? null : "رقم الهاتف غير صحيح";
  },

  email: (value: string) => {
    if (!value) {return null;}
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? null : "البريد الإلكتروني غير صحيح";
  },

  minLength: (min: number) => (value: string) => {
    if (!value) {return null;}
    return value.length >= min ? null : `يجب أن يحتوي على ${min} أحرف على الأقل`;
  },

  maxLength: (max: number) => (value: string) => {
    if (!value) {return null;}
    return value.length <= max ? null : `يجب ألا يتجاوز ${max} حرف`;
  },

  transactionId: (value: string) => {
    if (!value) {return null;}
    const pattern = /^TXN-\d{8}-\d{6}-\d{3}$/;
    return pattern.test(value.trim()) ? null : "رقم المعاملة غير صحيح";
  },

  combine: (...validators: Array<(value: string) => string | null>) => {
    return (value: string) => {
      for (const validator of validators) {
        const error = validator(value);
        if (error) {return error;}
      }
      return null;
    };
  },
};
