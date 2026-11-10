"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Command } from "cmdk";
import { Check, ChevronDown, Search } from "lucide-react";
import { COUNTRIES, COUNTRY_SEARCH_ALIASES } from "@/lib/countries";
import { cn } from "@/lib/utils";

interface CountrySelectProps {
  selected?: string[];
  onSelect: (country: string) => void;
  placeholder?: string;
  className?: string;
}

export function CountrySelect({
  selected = [],
  onSelect,
  placeholder = "Select country",
  className,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((country) => {
      const haystack = `${country} ${COUNTRY_SEARCH_ALIASES[country] ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
      >
        <span className="truncate text-white/70">{placeholder}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 opacity-60 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="mt-1 overflow-hidden rounded-lg border border-white/10 bg-[#0b1024] shadow-2xl">
          <Command shouldFilter={false} loop className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-white/10 px-3">
              <Search className="h-4 w-4 shrink-0 text-white/40" />
              <Command.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder="Search all countries…"
                className="h-10 w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
              />
            </div>
            <Command.List className="max-h-64 overflow-y-auto p-1">
              <Command.Empty className="px-3 py-6 text-center text-sm text-white/50">
                No country found.
              </Command.Empty>
              {filtered.map((country) => {
                const isSelected = selected.includes(country);
                return (
                  <Command.Item
                    key={country}
                    value={country}
                    onSelect={() => {
                      onSelect(country);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm text-white/90 data-[selected=true]:bg-white/10 data-[selected=true]:text-white",
                      isSelected && "text-cyan-300"
                    )}
                  >
                    <span>{country}</span>
                    {isSelected && <Check className="h-4 w-4 shrink-0" />}
                  </Command.Item>
                );
              })}
            </Command.List>
          </Command>
        </div>
      )}
    </div>
  );
}
