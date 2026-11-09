import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { BusyProvider } from "@/components/busy-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "AI Lead Generation & Sales Automation",
  description: "Multi-tenant AI Lead Generation & Sales Automation SaaS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <BusyProvider>
            {children}
            <Toaster position="top-right" richColors />
          </BusyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
