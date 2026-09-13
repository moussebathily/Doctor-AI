import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { HeartSimulation } from "@/components/cardiac/HeartSimulation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, Syringe, HeartPulse, RotateCcw, Send, Loader2, Timer, Bot } from "lucide-react";
import { TURN_SECONDS, type CardiacAction, type CardiacSession } from "@/lib/cardiac-game";
import {
  actOnCardiacSession,
  aiManageCardiacSession,
  askCardiacAI,
  createCardiacSession,
  getCardiacSession,
  listCardiacSessions,
  tickCardiacSession,
} from "@/lib/cardiac.functions";

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

type ChatMsg = { role: string; content: string };

function CardiacChallengePage() {
  const list = useServerFn(listCardiacSessions);
  const create = useServerFn(createCardiacSession);
  const get = useServerFn(getCardiacSession);
  const act = useServerFn(actOnCardiacSession);
  const tick = useServerFn(tickCardiacSession);
  const ask = useServerFn(askCardiacAI);
  const aiPlay = useServerFn(aiManageCardiacSession);

  const [session, setSession] = useState<CardiacSession | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // Reprise de la dernière partie active, sinon création d'un nouveau patient.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sessions = await list();
        const active = sessions.find((s) => s.status === "active");
        if (active) {
          const loaded = await get({ data: { id: active.id } });
          if (!cancelled && loaded) {
            setSession(loaded.session);
            setChat(loaded.messages.map((m) => ({ role: m.role, content: m.content })));
          }
        } else {
          const fresh = await create();
          if (!cancelled) setSession(fresh);
        }
      } catch (e) {
        if (!cancelled) setFatal((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [list, get, create]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [session?.logs]);
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [chat, thinking]);

  // Compte à rebours local + synchronisation serveur à chaque tour réel.
  useEffect(() => {
    if (!session || session.status !== "active") return;
    const id = setInterval(() => {
      setSession((s) => (s && s.status === "active" ? { ...s, time_remaining: Math.max(0, s.time_remaining - 1) } : s));
    }, 1000);
    return () => clearInterval(id);
  }, [session?.id, session?.status]);

  const sessionId = session?.id;
  const syncNow = useCallback(async () => {
    if (!sessionId) return;
    try {
      const fresh = await tick({ data: { id: sessionId } });
      setSession(fresh);
    } catch {
      /* réessaiera au tour suivant */
    }
  }, [sessionId, tick]);

  useEffect(() => {
    if (!session || session.status !== "active") return;
    const id = setInterval(() => void syncNow(), TURN_SECONDS * 1000);
    return () => clearInterval(id);
  }, [session?.id, session?.status, syncNow]);

  const doAction = async (action: CardiacAction) => {
    if (!session || session.status !== "active" || busy) return;
    if (action === "SHOCK") {
      setFlash(true);
      setTimeout(() => setFlash(false), 400);
    }
    setBusy(true);
    try {
      setSession(await act({ data: { id: session.id, action } }));
    } catch (e) {
      setFatal((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const letAIPlay = async () => {
    if (!session || session.status !== "active" || busy) return;
    setBusy(true);
    try {
      const res = await aiPlay({ data: { id: session.id } });
      setSession(res.session);
    } catch (e) {
      setFatal((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const restart = async () => {
    setBusy(true);
    try {
      setSession(await create());
      setChat([]);
    } catch (e) {
      setFatal((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendQuestion = async (text: string) => {
    const q = text.trim();
    if (!q || thinking || !session) return;
    setInput("");
    setChat((c) => [...c, { role: "user", content: q }]);
    setThinking(true);
    try {
      const res = await ask({ data: { id: session.id, question: q } });
      setChat((c) => [...c, { role: "assistant", content: res.answer }]);
    } catch (e) {
      setChat((c) => [...c, { role: "assistant", content: (e as Error).message }]);
    } finally {
      setThinking(false);
    }
  };

  if (fatal) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto p-8 text-center space-y-3">
          <p className="text-destructive font-semibold">{fatal}</p>
          <p className="text-sm text-muted-foreground">Connectez-vous pour enregistrer et reprendre vos parties.</p>
        </div>
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell>
        <div className="h-[60vh] grid place-items-center text-muted-foreground">
          <p className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement de la salle d'urgence…
          </p>
        </div>
      </AppShell>
    );
  }

  const victory = session.status === "won";
  const defeat = session.status === "lost";

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Défi : Urgence cardiaque</h1>
            <p className="text-sm text-muted-foreground">
              {session.patient_name}, {session.patient_age} ans — {session.scenario}. Un tour dure {TURN_SECONDS}s
              réelles ; la partie est enregistrée automatiquement.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`flex items-center gap-1.5 font-mono text-xl font-bold ${
                session.time_remaining < 20 && session.status === "active"
                  ? "text-destructive animate-pulse"
                  : "text-foreground"
              }`}
            >
              <Timer className="w-5 h-5" /> {session.time_remaining}s
            </span>
            <Button variant="outline" size="sm" onClick={() => void restart()} disabled={busy}>
              <RotateCcw className="w-4 h-4 mr-1.5" /> Nouveau patient
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <HeartSimulation state={session} onShock={() => void doAction("SHOCK")} flash={flash} />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button
                onClick={() => void doAction("SHOCK")}
                disabled={session.status !== "active" || busy}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                <Zap className="w-4 h-4 mr-1.5" /> Choc 200 J
              </Button>
              <Button variant="secondary" onClick={() => void doAction("MEDS")} disabled={session.status !== "active" || busy}>
                <Syringe className="w-4 h-4 mr-1.5" /> Adrénaline
              </Button>
              <Button variant="secondary" onClick={() => void doAction("CPR")} disabled={session.status !== "active" || busy}>
                <HeartPulse className="w-4 h-4 mr-1.5" /> RCP
              </Button>
              <Button variant="outline" onClick={() => void letAIPlay()} disabled={session.status !== "active" || busy}>
                <Bot className="w-4 h-4 mr-1.5" /> Laisser l'IA agir
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-semibold mb-2 text-sm">Journal d'événements</h2>
              <div
                ref={logRef}
                className="h-36 overflow-y-auto rounded-lg bg-slate-950 p-2 font-mono text-xs text-emerald-400 space-y-1"
              >
                {session.logs.map((log, i) => (
                  <p key={i}>&gt; {log}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card flex flex-col h-[640px]">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold">Dr. AI — assistant de réanimation</h2>
              <p className="text-xs text-muted-foreground">
                Historique conservé avec la partie. Posez une vraie question clinique.
              </p>
            </div>

            <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {chat.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Exemple : « Quelle énergie et quelle drogue après un 3e choc inefficace ? »
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
              {thinking && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours…
                </p>
              )}
              {victory && (
                <div className="p-4 rounded-lg bg-emerald-500/15 text-emerald-400 text-center font-bold">
                  Mission accomplie — patient stabilisé avec {session.shock_count} choc(s).
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
                void sendQuestion(input);
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ex : dose d'adrénaline en arrêt cardiaque ?"
              />
              <Button type="submit" disabled={thinking || !input.trim()}>
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
