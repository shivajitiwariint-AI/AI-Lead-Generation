import * as React from "react";
import NextLink from "next/link";
import { cn } from "@/lib/utils";

// App-router aware link. Renders a plain anchor style but keeps client-side
// navigation (a raw <a> would trigger a full page reload on every click).
const LinkComponent = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ className, href, ...props }, ref) => (
    <NextLink
      ref={ref}
      href={(href as string) ?? "#"}
      className={cn(
        "text-primary font-medium transition-colors hover:underline underline-offset-4",
        className
      )}
      {...props}
    />
  )
);
LinkComponent.displayName = "Link";

export { LinkComponent as Link };
