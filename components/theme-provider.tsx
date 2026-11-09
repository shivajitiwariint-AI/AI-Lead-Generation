"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
  attribute = "class",
}: {
  children: React.ReactNode;
  defaultTheme?: string;
  enableSystem?: boolean;
  attribute?: string;
}) {
  return (
    <NextThemesProvider
      defaultTheme={defaultTheme}
      enableSystem={enableSystem}
      attribute={attribute}
    >
      {children}
    </NextThemesProvider>
  );
}
