import type { ButtonHTMLAttributes } from "react";

// STYLE.md §5 — three variants, no separate "danger red": destructive reuses
// the accent color as its label, since a second warning color would dilute
// the "accent means pay attention" rule (§3).
type ButtonVariant = "primary" | "secondary" | "destructive";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:opacity-90",
  secondary: "border border-border text-ink hover:bg-surface-2",
  destructive: "border border-border text-accent hover:bg-accent-soft",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
