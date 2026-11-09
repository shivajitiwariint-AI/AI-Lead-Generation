"use client";

import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuPortal,
} from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";

export interface DropdownMenuTriggerProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuTrigger> {}
export interface DropdownMenuContentProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuContent> {}
export interface DropdownMenuItemProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuItem> {}
export interface DropdownMenuLabelProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuLabel> {}
export interface DropdownMenuSeparatorProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuSeparator> {}

const DropdownMenuTriggerComponent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuTrigger>,
  DropdownMenuTriggerProps
>(({ className, children, ...props }, ref) => (
  <DropdownMenuTrigger
    ref={ref}
    className={cn("inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50", className)}
    {...props}
  >
    {children}
    <MoreHorizontal className="ml-1 h-4 w-4" />
  </DropdownMenuTrigger>
));
DropdownMenuTriggerComponent.displayName = "DropdownMenuTrigger";

const DropdownMenuContentComponent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuContent>,
  DropdownMenuContentProps
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPortal>
    <DropdownMenuContent
      ref={ref}
      className={cn(
      "w-60 overflow-hidden rounded-xl border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1 text-[hsl(var(--card-foreground))] shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    >
      {children}
    </DropdownMenuContent>
  </DropdownMenuPortal>
));
DropdownMenuContentComponent.displayName = "DropdownMenuContent";

const DropdownMenuLabelComponent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuLabel>,
  DropdownMenuLabelProps
>(({ className, ...props }, ref) => (
  <DropdownMenuLabel
    ref={ref}
    className={cn("px-2 py-1.5 text-xs font-semibold", className)}
    {...props}
  />
));
DropdownMenuLabelComponent.displayName = "DropdownMenuLabel";

const DropdownMenuItemComponent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuItem>,
  DropdownMenuItemProps
>(({ className, ...props }, ref) => (
  <DropdownMenuItem
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-[hsl(var(--accent))]/10 focus:text-[hsl(var(--foreground))] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  />
));
DropdownMenuItemComponent.displayName = "DropdownMenuItem";

const DropdownMenuSeparatorComponent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuSeparator>,
  DropdownMenuSeparatorProps
>(({ className, ...props }, ref) => (
  <DropdownMenuSeparator
    ref={ref}
    className={cn("-mx-1 h-px bg-border", className)}
    {...props}
  />
));
DropdownMenuSeparatorComponent.displayName = "DropdownMenuSeparator";

export {
  DropdownMenu,
  DropdownMenuTriggerComponent as DropdownMenuTrigger,
  DropdownMenuContentComponent as DropdownMenuContent,
  DropdownMenuItemComponent as DropdownMenuItem,
  DropdownMenuLabelComponent as DropdownMenuLabel,
  DropdownMenuSeparatorComponent as DropdownMenuSeparator,
};
