import type { HTMLAttributes } from "react";
import clsx from "clsx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-card border border-neutral-200 bg-surface-card p-5 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
