import { useEffect, useState } from "react";
import { Heart, Droplet, Thermometer, Activity } from "lucide-react";

export type Vitals = {
  bpm: number;
  spo2: number;
  tempC: number;
  bp: string; // "120/80"
};

export const DEFAULT_VITALS: Vitals = { bpm: 72, spo2: 98, tempC: 36.6, bp: "120/80" };

// Animated SVG ECG strip — pure CSS keyframes via stroke-dashoffset.
function ECG({ bpm }: { bpm: number }) {
  // single PQRST waveform repeated horizontally
  const wave =
    "M0 30 L20 30 L25 28 L30 32 L35 30 L42 30 L46 12 L50 48 L54 26 L60 30 L80 30 L85 25 L90 30 L120 30";
  const speed = Math.max(0.6, 60 / Math.max(40, bpm));
  return (
    <div className="relative h-14 w-full overflow-hidden rounded-md bg-black/70 border border-emerald-500/30">
      <svg viewBox="0 0 240 60" className="w-full h-full" preserveAspectRatio="none">
        <g style={{ animation: `ecg-scroll ${speed}s linear infinite` }}>
          <path d={wave} fill="none" stroke="#22c55e" strokeWidth="1.4" />
          <path d={wave} transform="translate(120 0)" fill="none" stroke="#22c55e" strokeWidth="1.4" />
          <path d={wave} transform="translate(240 0)" fill="none" stroke="#22c55e" strokeWidth="1.4" />
        </g>
      </svg>
      <style>{`@keyframes ecg-scroll { from { transform: translateX(0); } to { transform: translateX(-120px); } }`}</style>
    </div>
  );
}

function Vital({
  icon,
  value,
  unit,
  label,
  color,
}: {
  icon: React.ReactNode;
  value: string | number;
  unit: string;
  label: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-2 flex flex-col items-center justify-center min-w-[60px]">
      <div style={{ color }} className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold opacity-90">
        {icon}
        {label}
      </div>
      <div style={{ color }} className="font-mono font-bold text-lg leading-tight">
        {value}
        <span className="text-[10px] ml-0.5 opacity-70">{unit}</span>
      </div>
    </div>
  );
}

export function PatientMonitor({ baseVitals = DEFAULT_VITALS, alert = false }: { baseVitals?: Vitals; alert?: boolean }) {
  const [v, setV] = useState<Vitals>(baseVitals);

  useEffect(() => {
    const t = setInterval(() => {
      setV((cur) => ({
        bpm: Math.round(baseVitals.bpm + (Math.random() - 0.5) * 4 + (alert ? 12 : 0)),
        spo2: Math.max(85, Math.min(100, Math.round(baseVitals.spo2 + (Math.random() - 0.5) * 2 - (alert ? 2 : 0)))),
        tempC: +(baseVitals.tempC + (Math.random() - 0.5) * 0.1).toFixed(1),
        bp: baseVitals.bp,
      }));
    }, 1200);
    return () => clearInterval(t);
  }, [baseVitals, alert]);

  return (
    <div className="rounded-xl border border-border bg-gradient-to-b from-slate-900 to-slate-800 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400/90 flex items-center gap-1">
          <Activity className="w-3 h-3" /> Moniteur patient
        </span>
        <span className="text-[10px] text-emerald-400/70 font-mono">LIVE</span>
      </div>
      <ECG bpm={v.bpm} />
      <div className="grid grid-cols-4 gap-2">
        <Vital icon={<Heart className="w-3 h-3" />} value={v.bpm} unit="bpm" label="FC" color="#22c55e" />
        <Vital icon={<Droplet className="w-3 h-3" />} value={`${v.spo2}%`} unit="" label="SpO₂" color="#38bdf8" />
        <Vital icon={<Thermometer className="w-3 h-3" />} value={v.tempC} unit="°C" label="Temp" color="#f59e0b" />
        <Vital icon={<Activity className="w-3 h-3" />} value={v.bp} unit="" label="TA" color="#a78bfa" />
      </div>
    </div>
  );
}
