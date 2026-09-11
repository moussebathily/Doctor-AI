import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { HeartSimulation } from "@/components/cardiac/HeartSimulation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, Syringe, HeartPulse, RotateCcw, Send, Loader2, Timer } from "lucide-react";
import {
  initCardiacScenario,
  processCardiacAction,
  timeoutDeath,
  type CardiacAction,
  type CardiacState,
} from "@/lib/cardiac-game";

export const Route = createFileRoute("/urgence-cardiaque")({
  head: () => ({
    meta: [
      { title: "Défi Urgence Cardiaque — Doctor AI" },
      {
        name: "description",
        content:
          "Simulation 3D d'un arrêt cardiaque : défibrillez, administrez l'adrénaline et sauvez le patient avant la fin du chrono.",
      },
      { property: "og:title", content: "Défi Urgence Cardiaque — Doctor AI" },
      {
        property: "og:description",
        content: "Entraînement immersif à la réanimation cardiaque avec cœur 3D animé et assistant IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CardiacChallengePage,
});

const TOTAL_TIME = 60;

type ChatMsg = { role: "user" | "assistant"; content: string };

function CardiacChallengePage() {
  const [state, setState] = useState<CardiacState>(() => initCardiacScenario());
  const [timer, setTimer] = useState(TOTAL_TIME);
  const [flash, setFlash] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [state.logs]);
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [chat, loading]);

  // Chrono
  useEffect(() => {
    if (state.isGameOver) return;
    const id = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          setState((s) => timeoutDeath(s));
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [state.isGameOver]);

  // Dégradation continue en VFIB
  useEffect(() => {
    if (state.isGameOver || state.rhythm !== "VFIB") return;
    const id = setInterval(() => setState((s) => processCardiacAction(s, "WAIT")), 8000);
    return () => clearInterval(id);
  }, [state.isGameOver, state.rhythm]);

  const act = (action: CardiacAction) => {
    if (state.isGameOver) return;
    if (action === "SHOCK") {
      setFlash(true);
      setTimeout(() => setFlash(false), 400);
    }
    setState((s) => processCardiacAction(s, action));
  };

  const restart = () => {
    setState(initCardiacScenario());
    setTimer(TOTAL_TIME);
    setChat([]);
  };

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");
    const history: ChatMsg[] = [...chat, { role: "user", content: q }];
    setChat(history);
    setLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/medical-ai`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "doctor",
          stream: false,
          messages: [
            {
              role: "user",
              content:
                `Contexte de simulation (entraînement pédagogique, arrêt cardiaque) : rythme=${state.rhythm}, ` +
                `santé=${state.health}%, chocs délivrés=${state.shockCount}, temps restant=${timer}s. ` +
                `Réponds brièvement en français selon le protocole ACLS.`,
            },
            ...history,
          ],
        }),
      });
      if (!resp.ok) {
        throw new Error(
          resp.status === 429
            ? "Trop de requêtes, réessayez dans un instant."
            : resp.status === 402
              ? "Crédits IA épuisés."
              : "L'assistant est indisponible.",
        );
      }
      const data = await resp.json();
      const content: string = data?.message?.content ?? data?.choices?.[0]?.message?.content ?? "…";
      setChat((c) => [...c, { role: "assistant", content }]);
    } catch (e) {
      setChat((c) => [...c, { role: "assistant", content: (e as Error).message }]);
    } finally {
      setLoading(false);
    }
  };

  const victory = state.isGameOver && state.victory;
  const defeat = state.isGameOver && !state.victory;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Défi : Urgence cardiaque</h1>
            <p className="text-sm text-muted-foreground">
              Le patient est en fibrillation ventriculaire. Rétablissez un rythme sinusal avant la fin du chrono.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`flex items-center gap-1.5 font-mono text-xl font-bold ${
                timer < 10 ? "text-destructive animate-pulse" : "text-foreground"
              }`}
            >
              <Timer className="w-5 h-5" /> {timer}s
            </span>
            <Button variant="outline" size="sm" onClick={restart}>
              <RotateCcw className="w-4 h-4 mr-1.5" /> Rejouer
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <HeartSimulation state={state} onShock={() => act("SHOCK")} flash={flash} />

            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={() => act("SHOCK")}
                disabled={state.isGameOver}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                <Zap className="w-4 h-4 mr-1.5" /> Choc 200 J
              </Button>
              <Button variant="secondary" onClick={() => act("MEDS")} disabled={state.isGameOver}>
                <Syringe className="w-4 h-4 mr-1.5" /> Adrénaline
              </Button>
              <Button variant="secondary" onClick={() => act("CPR")} disabled={state.isGameOver}>
                <HeartPulse className="w-4 h-4 mr-1.5" /> RCP
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-semibold mb-2 text-sm">Journal d'événements</h2>
              <div
                ref={logRef}
                className="h-36 overflow-y-auto rounded-lg bg-slate-950 p-2 font-mono text-xs text-emerald-400 space-y-1"
              >
                {state.logs.map((log, i) => (
                  <p key={i}>&gt; {log}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card flex flex-col h-[560px]">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold">Dr. AI — assistant de réanimation</h2>
              <p className="text-xs text-muted-foreground">Demandez le protocole, une dose ou la conduite à tenir.</p>
            </div>

            <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {chat.length === 0 && !victory && !defeat && (
                <p className="text-sm text-muted-foreground">
                  Exemple : « Quel est le protocole ACLS après un choc inefficace ? »
                </p>
              )}
              {chat.map((m, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg text-sm whitespace-pre-wrap ${
                    m.role === "user" ? "bg-primary/10 ml-8" : "bg-muted mr-8"
                  }`}
                >
                  <strong>{m.role === "user" ? "Vous" : "Dr. AI"} : </strong>
                  {m.content}
                </div>
              ))}
              {loading && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours…
                </p>
              )}
              {victory && (
                <div className="p-4 rounded-lg bg-emerald-500/15 text-emerald-400 text-center font-bold">
                  Mission accomplie — patient stabilisé en {TOTAL_TIME - timer}s avec {state.shockCount} choc(s).
                </div>
              )}
              {defeat && (
                <div className="p-4 rounded-lg bg-destructive/15 text-destructive text-center font-bold">
                  Échec critique — le patient est décédé. Analysez le journal et rejouez.
                </div>
              )}
            </div>

            <form
              className="p-4 border-t border-border flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void ask(input);
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ex : dose d'adrénaline en arrêt cardiaque ?"
              />
              <Button type="submit" disabled={loading || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>

        <MedicalDisclaimer />
      </div>
    </AppShell>
  );
}
