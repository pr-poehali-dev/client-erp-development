import * as React from "react";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  let s = "+7";
  if (d.length > 1) s += " (" + d.slice(1, 4);
  if (d.length > 4) s += ") " + d.slice(4, 7);
  if (d.length > 7) s += "-" + d.slice(7, 9);
  if (d.length > 9) s += "-" + d.slice(9, 11);
  return s;
}

function extractDigits(value: string): string {
  const raw = value.replace(/\D/g, "");
  if (raw.length === 0) return "";
  if (raw.startsWith("8") && raw.length >= 2) return "7" + raw.slice(1);
  if (raw.startsWith("7")) return raw;
  return "7" + raw;
}

const PhoneInput = ({ value, onChange, className, placeholder = "+7 (___) ___-__-__" }: PhoneInputProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "" || raw === "+") {
      onChange("");
      return;
    }
    const digits = extractDigits(raw);
    onChange(formatPhone(digits));
  };

  const handleFocus = () => {
    if (!value) onChange("+7");
  };

  const handleBlur = () => {
    if (value === "+7" || value === "+7 (") onChange("");
  };

  return (
    <input
      type="tel"
      value={value}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
    />
  );
};

export default PhoneInput;
