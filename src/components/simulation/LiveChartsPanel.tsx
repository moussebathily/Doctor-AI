import { useEffect, useRef, useState } from "react";
import { Activity, Droplets, HeartPulse } from "lucide-react";

type Series = { label: string; color: string; unit: string; values: number[]; min: number; max: number };

function Sparkline({ series, height = 44 }: { series: Series; height?: number }) {
  const w = 220;
  const h = height;
  const vals = series.values;
  const last = vals[vals.length - 1] ?? 0;
  const range = series.max - series.min || 1;
  const step = w / Math.max(1, vals.length - 1);
  const pts = vals.map((v, i) => {
    const x = i * step;
    const y = h - ((v - series.min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const areaPts = `0,${h} ${pts} ${w},${h}`;
  return (
    <div className="flex items-center gap-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="flex-1 h-11 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${series.label}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={series.color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={series.color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPts} fill={`url(#grad-${series.label})`} />
        <polyline points={pts} fill="none" stroke={series.color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="text-right w-16 shrink-0">
        <p className="font-mono text-sm font-bold text-white leading-none">{last.toFixed(series.unit === "°C" ? 1 : 0)}</p>
        <p className="text-[9px] text-slate-500 uppercase tracking-widest">{series.unit}</p>
      </div>
    </div>
  );
}

export function LiveChartsPanel({
  hr = 72,
  alert = false,
}: {
  hr?: number;
  alert?: boolean;
}) {
  const MAX_POINTS = 40;
  const [tick, setTick] = useState(0);
  const stateRef = useRef({
    hr: [] as number[],
    spo2: [] as number[],
    bp: [] as number[],
    glu: [] as number[],
    urine: [] as number[],
    creat: [] as number[],
  });

  useEffect(() => {
    const t = setInterval(() => {
      const s = stateRef.current;
      const jitter = (a: number) => (Math.random() - 0.5) * a;
      const push = (arr: number[], v: number) => {
        arr.push(v);
        if (arr.length > MAX_POINTS) arr.shift();
      };
      push(s.hr, Math.max(45, Math.min(180, hr + jitter(alert ? 12 : 4))));
      push(s.spo2, Math.max(88, Math.min(100, 97 + jitter(alert ? 3 : 1.2))));
      push(s.bp, Math.max(90, Math.min(160, 120 + jitter(alert ? 12 : 5))));
      push(s.glu, Math.max(0.7, Math.min(1.6, 0.95 + jitter(0.08))));
      push(s.urine, Math.max(0.3, Math.min(1.5, 0.9 + jitter(0.1))));
      push(s.creat, Math.max(6, Math.min(16, 9 + jitter(0.6))));
      setTick((n) => n + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [hr, alert]);

  const s = stateRef.current;
  // Seed at least one point so charts render immediately
  if (s.hr.length === 0) {
    s.hr.push(hr); s.spo2.push(97); s.bp.push(120);
    s.glu.push(0.95); s.urine.push(0.9); s.creat.push(9);
  }

  const vital: Series[] = [
    { label: "hr", color: "#f43f5e", unit: "bpm", values: s.hr, min: 40, max: 180 },
    { label: "spo2", color: "#38bdf8", unit: "%", values: s.spo2, min: 85, max: 100 },
    { label: "bp", color: "#a78bfa", unit: "mmHg", values: s.bp, min: 80, max: 170 },
  ];
  const labs: Series[] = [
    { label: "glu", color: "#f59e0b", unit: "g/L", values: s.glu, min: 0.6, max: 1.8 },
    { label: "urine", color: "#22d3ee", unit: "mL/kg/h", values: s.urine, min: 0.2, max: 1.6 },
    { label: "creat", color: "#34d399", unit: "mg/L", values: s.creat, min: 5, max: 18 },
  ];

  const Row = ({ icon: Icon, name, series, iconColor }: { icon: typeof HeartPulse; name: string; series: Series; iconColor: string }) => (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 px-0.5">
        <Icon className={`w-3 h-3 ${iconColor}`} />
        <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">{name}</span>
      </div>
      <Sparkline series={series} />
    </div>
  );

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold">Temps réel</p>
        <span className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live · {tick}s
        </span>
      </div>

      <div className="space-y-2.5">
        <Row icon={HeartPulse} name="Fréquence cardiaque" series={vital[0]} iconColor="text-rose-400" />
        <Row icon={Activity} name="SpO₂" series={vital[1]} iconColor="text-sky-400" />
        <Row icon={Activity} name="Pression systolique" series={vital[2]} iconColor="text-violet-400" />
      </div>

      <div className="pt-2 border-t border-white/5 space-y-2.5">
        <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold px-0.5">Labo — sang / urine</p>
        <Row icon={Droplets} name="Glycémie" series={labs[0]} iconColor="text-amber-400" />
        <Row icon={Droplets} name="Diurèse" series={labs[1]} iconColor="text-cyan-400" />
        <Row icon={Droplets} name="Créatinine" series={labs[2]} iconColor="text-emerald-400" />
      </div>
    </div>
  );
}
