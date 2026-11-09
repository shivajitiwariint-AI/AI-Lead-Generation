"use client";

/**
 * Animated AI-automation background: floating orbs, drifting particles,
 * a scanning line, and flowing data-stream lines. Drop into any dark page.
 */
export function AiBackground({ intensity = 1 }: { intensity?: number }) {
  const particles = Array.from({ length: 16 }, (_, i) => i);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Base gradient mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.18),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(34,211,238,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_left,_rgba(168,85,247,0.12),_transparent_55%)]" />

      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      {/* Floating orbs */}
      <div className="absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-indigo-500/30 blur-[100px] animate-float" />
      <div className="absolute top-1/3 -right-20 h-80 w-80 rounded-full bg-cyan-500/25 blur-[110px] animate-float" style={{ animationDelay: "2s" }} />
      <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-purple-500/25 blur-[110px] animate-float" style={{ animationDelay: "4s" }} />
      <div className="absolute top-2/3 left-1/2 h-60 w-60 rounded-full bg-emerald-500/15 blur-[90px] animate-drift" />

      {/* Drifting particles (subtle, behind content) */}
      {particles.map((i) => {
        const left = (i * 37 + 13) % 100;
        const top = (i * 53 + 7) % 100;
        const delay = (i % 7) * 0.7;
        const size = 1 + (i % 2);
        return (
          <span
            key={i}
            className="absolute rounded-full bg-white/20 animate-drift"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size,
              animationDelay: `${delay}s`,
              animationDuration: `${8 + (i % 5)}s`,
              opacity: 0.12 + (i % 4) * 0.04,
            }}
          />
        );
      })}
    </div>
  );
}
