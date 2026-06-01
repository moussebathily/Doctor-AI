import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

// Pure CSS / SVG simulated endoscopic view — no external assets needed.
const SLIDES = [
  { id: 1, hue: 350, label: "Cavité abdominale" },
  { id: 2, hue: 10, label: "Méso-appendice" },
  { id: 3, hue: 340, label: "Base appendiculaire" },
];

export function LaparoscopicView() {
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];
  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur overflow-hidden">
      <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
        Vue laparoscopique
      </div>
      <div className="relative aspect-[16/10] mx-2 mb-2 rounded-xl overflow-hidden bg-black">
        {/* Endoscopic vignette */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 55%, hsl(${slide.hue} 65% 45%) 0%, hsl(${slide.hue} 70% 25%) 35%, hsl(${slide.hue} 60% 12%) 70%, #000 100%)`,
          }}
        />
        {/* Tissue texture noise */}
        <svg className="absolute inset-0 w-full h-full opacity-30 mix-blend-overlay" preserveAspectRatio="none">
          <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" />
            <feColorMatrix values="0 0 0 0 0.7  0 0 0 0 0.3  0 0 0 0 0.3  0 0 0 0.7 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#noise)" />
        </svg>
        {/* Instrument silhouette */}
        <div className="absolute bottom-0 right-0 w-2/5 h-2/3 pointer-events-none">
          <div className="absolute right-[28%] bottom-[20%] w-[120%] h-2 bg-gradient-to-l from-slate-200 to-slate-500 rotate-[28deg] origin-right rounded-full shadow-2xl" />
          <div className="absolute right-[20%] bottom-[24%] w-6 h-6 bg-slate-300 rounded-sm rotate-[28deg] shadow-xl" />
        </div>
        {/* Crosshair circle */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-white/40" />
        {/* Label */}
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] text-emerald-300 font-mono">
          {slide.label}
        </div>
        {/* Controls */}
        <button
          type="button"
          onClick={() => setIdx((i) => (i - 1 + SLIDES.length) % SLIDES.length)}
          className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setIdx((i) => (i + 1) % SLIDES.length)}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
