import * as React from "react";
import { cn } from "@/lib/utils";

export interface TableProps extends React.ComponentPropsWithRef<typeof TablePrimitive> {
  children: React.ReactNode;
}

const TablePrimitive = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <table
    ref={ref}
    className={cn("w-full caption-bottom text-sm", className)}
    {...props}
  />
));
TablePrimitive.displayName = "Table";

export const Table = TablePrimitive;

export interface TableHeaderProps extends React.ComponentPropsWithRef<typeof TableHeaderPrimitive> {
  children: React.ReactNode;
}

const TableHeaderPrimitive = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("[&_tr]:border-b", className)}
    {...props}
  />
));
TableHeaderPrimitive.displayName = "TableHeader";

export const TableHeader = TableHeaderPrimitive;

export interface TableBodyProps extends React.ComponentPropsWithRef<typeof TableBodyPrimitive> {
  children: React.ReactNode;
}

const TableBodyPrimitive = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBodyPrimitive.displayName = "TableBody";

export const TableBody = TableBodyPrimitive;

export interface TableFooterProps extends React.ComponentPropsWithRef<typeof TableFooterPrimitive> {
  children: React.ReactNode;
}

const TableFooterPrimitive = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("[&_tr]:border-b", className)}
    {...props}
  />
));
TableFooterPrimitive.displayName = "TableFooter";

export const TableFooter = TableFooterPrimitive;

export interface TableRowProps extends React.ComponentPropsWithRef<typeof TableRowPrimitive> {
  children: React.ReactNode;
}

const TableRowPrimitive = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
));
TableRowPrimitive.displayName = "TableRow";

export const TableRow = TableRowPrimitive;

export interface TableCellOwnProps {
  children?: React.ReactNode;
  colSpan?: number;
  rowSpan?: number;
}

type TableCellProps = TableCellOwnProps & Omit<React.HTMLAttributes<HTMLTableCellElement>, 'children' | 'colSpan' | 'rowSpan'>;

const TableCellComponent = React.forwardRef<
  HTMLTableCellElement,
  TableCellProps
>(({ className, colSpan, rowSpan, children, ...props }, ref) => (
  <td
    ref={ref}
    colSpan={colSpan}
    rowSpan={rowSpan}
    className={cn("p-4 align-middle", className)}
    {...props}
  >
    {children}
  </td>
));
TableCellComponent.displayName = "TableCell";

export const TableCell = TableCellComponent;

export interface TableHeadProps extends React.ComponentPropsWithRef<typeof TableHeadPrimitive> {
  children: React.ReactNode;
}

const TableHeadPrimitive = React.forwardRef<
  HTMLTableCellElement,
  React.HTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "p-4 text-left font-medium align-middle [&_tr]:border-b",
      className
    )}
    {...props}
  />
));
TableHeadPrimitive.displayName = "TableHead";

export const TableHead = TableHeadPrimitive;

export interface TableCaptionProps extends React.ComponentPropsWithRef<typeof TableCaptionPrimitive> {
  children: React.ReactNode;
}

const TableCaptionPrimitive = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
));
TableCaptionPrimitive.displayName = "TableCaption";

export const TableCaption = TableCaptionPrimitive;
