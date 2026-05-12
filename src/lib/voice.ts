// Lightweight Web Speech wrapper (recognition + synthesis).
// SSR-safe: every API check is guarded.

export function getSpeechRecognition(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function speechSupported() {
  return !!getSpeechRecognition();
}

export function speak(text: string, lang = "fr-FR") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 1;
  u.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export type VoiceListener = {
  start: () => void;
  stop: () => void;
};

export function listenOnce(opts: {
  onResult: (text: string) => void;
  onError?: (e: string) => void;
  onEnd?: () => void;
  lang?: string;
}): VoiceListener | null {
  const Ctor = getSpeechRecognition();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = opts.lang ?? "fr-FR";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.continuous = false;
  rec.onresult = (ev: any) => {
    const t = ev.results?.[0]?.[0]?.transcript ?? "";
    if (t) opts.onResult(t);
  };
  rec.onerror = (ev: any) => opts.onError?.(ev.error ?? "unknown");
  rec.onend = () => opts.onEnd?.();
  return { start: () => rec.start(), stop: () => rec.stop() };
}

// Map a free-form sentence to an operation id from a small synonym dictionary.
export function matchOperationFromVoice(transcript: string): string | null {
  const t = transcript.toLowerCase();
  const map: Array<[string, string[]]> = [
    ["pontage-coronarien", ["coeur", "cœur", "cardiaque", "pontage", "coronaire", "heart", "bypass"]],
    ["appendicectomie", ["appendice", "appendicite", "ventre", "abdomen", "appendix"]],
    ["fracture-tibia", ["tibia", "jambe", "fracture", "os", "leg", "bone"]],
  ];
  for (const [id, kws] of map) if (kws.some((k) => t.includes(k))) return id;
  return null;
}
