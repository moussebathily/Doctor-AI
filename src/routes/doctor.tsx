import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/AppShell";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Stethoscope, Loader2, Sparkles, Wrench, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { MEDICAL_TOOLS, executeTool } from "@/lib/medical-tools";

export const Route = createFileRoute("/doctor")({
  head: () => ({
    meta: [
      { title: "Doctor AI — Chat médical" },
      { name: "description", content: "Discutez avec un assistant médical IA en français." },
    ],
  }),
  component: DoctorPage,
});

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type Msg =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string; name: string };

const SUGGESTIONS = [
  "Rappelle-moi de prendre Doliprane à 20h",
  "Quels symptômes pour le paludisme ?",
  "Simule une analyse de sang pour une femme de 35 ans fatiguée",
  "Liste mes rappels actifs",
];

function DoctorPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const callAI = async (history: Msg[]): Promise<{ message: { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }; finish_reason: string | null }> => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/medical-ai`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "doctor", messages: history, tools: MEDICAL_TOOLS, stream: false }),
    });
    if (!resp.ok) {
      if (resp.status === 429) throw new Error("Trop de requêtes.");
      if (resp.status === 402) throw new Error("Crédits IA épuisés.");
      throw new Error("Erreur IA");
    }
    return resp.json();
  };

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: text };
    let working: Msg[] = [...messages, userMsg];
    setMessages(working);
    setInput("");
    setLoading(true);

    try {
      // Agent loop: up to 5 tool rounds
      for (let i = 0; i < 5; i++) {
        const { message, finish_reason } = await callAI(working);
        const asst: Msg = { role: "assistant", content: message.content ?? "", tool_calls: message.tool_calls };
        working = [...working, asst];
        setMessages(working);

        if (finish_reason !== "tool_calls" || !message.tool_calls?.length) break;

        // Execute each tool call
        for (const tc of message.tool_calls) {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignore */ }
          const result = await executeTool(tc.function.name, args);
          const toolMsg: Msg = { role: "tool", content: result, tool_call_id: tc.id, name: tc.function.name };
          working = [...working, toolMsg];
          setMessages(working);
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-7rem)] md:h-screen max-w-4xl mx-auto">
        <div className="px-6 py-5 border-b border-border bg-card/50 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-teal flex items-center justify-center shadow-soft">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="font-display font-bold text-xl">Doctor AI</h1>
              <p className="text-xs text-muted-foreground">Assistant connecté à vos rappels et au Virtual Lab</p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-accent/10 text-accent font-medium">
              <Wrench className="w-3 h-3" /> Tools actifs
            </span>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="max-w-2xl mx-auto text-center pt-10">
              <div className="inline-flex w-14 h-14 rounded-2xl gradient-hero items-center justify-center mb-4 shadow-elegant">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h2 className="font-display text-2xl font-bold">Comment puis-je vous aider ?</h2>
              <p className="text-muted-foreground text-sm mt-2">Symptômes, rappels, simulations — je peux agir directement dans l'app.</p>
              <div className="mt-6 grid sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="text-left text-sm p-3 rounded-xl border border-border hover:border-accent hover:bg-accent/5 transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            if (m.role === "tool") {
              let label = "Action";
              try {
                const parsed = JSON.parse(m.content);
                if (parsed.ok && m.name === "create_reminder") label = `Rappel ajouté : ${parsed.reminder?.title ?? ""}`;
                else if (m.name === "list_reminders") label = `${parsed.count ?? 0} rappel(s) lus`;
                else if (m.name === "run_lab_simulation") label = "Analyse simulée";
                else if (parsed.error) label = `Erreur : ${parsed.error}`;
              } catch { /* ignore */ }
              return (
                <div key={i} className="flex justify-center">
                  <div className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-success/10 text-success border border-success/20">
                    <CheckCircle2 className="w-3 h-3" /> {label}
                  </div>
                </div>
              );
            }
            if (m.role === "assistant" && !m.content && m.tool_calls?.length) {
              return (
                <div key={i} className="flex justify-start">
                  <div className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-2xl bg-muted text-muted-foreground">
                    <Wrench className="w-3 h-3 animate-pulse" /> Exécution de {m.tool_calls.map((t) => t.function.name).join(", ")}...
                  </div>
                </div>
              );
            }
            return (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] md:max-w-[75%] px-4 py-3 rounded-2xl ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm whitespace-pre-wrap"
                    : "bg-card border border-border rounded-bl-sm shadow-soft"
                }`}>
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none prose-headings:font-display prose-headings:mt-2 prose-p:my-1.5 prose-ul:my-1.5">
                      <ReactMarkdown>{m.content || "..."}</ReactMarkdown>
                    </div>
                  ) : m.content}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-start">
              <div className="px-4 py-3 rounded-2xl bg-card border border-border shadow-soft">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border p-4 bg-card/50 backdrop-blur space-y-2">
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder="Décrivez vos symptômes ou demandez une action..."
              className="min-h-[48px] max-h-32 resize-none"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !input.trim()} size="lg" className="shrink-0">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
          <MedicalDisclaimer compact />
        </div>
      </div>
    </AppShell>
  );
}
