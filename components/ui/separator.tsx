import * as React from "react";
import { cn } from "@/lib/utils";

export interface SeparatorProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: "horizontal" | "vertical";
  className?: string;
  decorative?: boolean;
}

const Separator = React.forwardRef<HTMLHRElement, SeparatorProps>(
  ({ className, orientation = "horizontal", decorative = false, ...props }, ref) => {
    return (
      <hr
        ref={ref}
        aria-orientation={orientation}
        role={decorative ? undefined : "separator"}
        className={cn(
          "shrink-0 border-[hsl(var(--border))]",
          orientation === "horizontal" ? "h-[px] w-full" : "h-full w-[px]",
          className
        )}
        {...props}
      />
    );
  }
);
Separator.displayName = "Separator";

export { Separator };
