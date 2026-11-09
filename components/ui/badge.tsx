import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline";
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variants = {
      default: "bg-primary text-primary-foreground px-2.5 py-0.5 rounded-md",
      secondary: "bg-secondary text-secondary-foreground px-2.5 py-0.5 rounded-md",
      destructive:
        "bg-destructive text-destructive-foreground px-2.5 py-0.5 rounded-md",
      outline: "border border-[hsl(var(--border))] px-2.5 py-0.5 rounded-md",
    };
    return (
      <div
        ref={ref}
        className={cn("inline-flex items-center rounded-full border border-[hsl(var(--border))] px-2.5 py-0.5 text-xs font-semibold", variants[variant], className)}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge };
