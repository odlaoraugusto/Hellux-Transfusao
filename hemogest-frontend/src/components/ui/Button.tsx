import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-hemo text-white hover:bg-hemo-dark",
        variant === "secondary" && "border border-hemo text-hemo hover:bg-hemo/5",
        variant === "ghost" && "text-ink-muted hover:bg-neutral-100",
        className,
      )}
      {...props}
    />
  );
}
