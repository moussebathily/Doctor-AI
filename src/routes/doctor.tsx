import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Stethoscope, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/doctor")({
  head: () => ({
    meta: [
      { title: "Doctor AI — Chat médical" },
      { name: "description", content: "Discutez avec un assistant médical IA en français." },
    ],
  }),
  component: DoctorPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "J'ai mal à la tête depuis 3 jours, que faire ?",
  "Quels symptômes pour le paludisme ?",
  "Ma tension est de 14/9, est-ce grave ?",
  "Comment soigner une plaie superficielle ?",
];

function DoctorPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/medical-ai`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "doctor", messages: [...messages, userMsg], stream: true }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error("Trop de requêtes. Réessayez dans un instant.");
        else if (resp.status === 402) toast.error("Crédits IA épuisés.");
        else toast.error("Erreur de connexion à l'IA.");
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";
      let done = false;

      setMessages((p) => [...p, { role: "assistant", content: "" }]);

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages((p) => p.map((m, i) => i === p.length - 1 ? { ...m, content: assistantContent } : m));
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Une erreur est survenue.");
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
            <div>
              <h1 className="font-display font-bold text-xl">Doctor AI</h1>
              <p className="text-xs text-muted-foreground">Assistant médical IA — réponses en français</p>
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="max-w-2xl mx-auto text-center pt-10">
              <div className="inline-flex w-14 h-14 rounded-2xl gradient-hero items-center justify-center mb-4 shadow-elegant">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h2 className="font-display text-2xl font-bold">Comment puis-je vous aider ?</h2>
              <p className="text-muted-foreground text-sm mt-2">Décrivez vos symptômes ou posez une question médicale.</p>
              <div className="mt-6 grid sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="text-left text-sm p-3 rounded-xl border border-border hover:border-accent hover:bg-accent/5 transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] md:max-w-[75%] px-4 py-3 rounded-2xl whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-card border border-border rounded-bl-sm shadow-soft"
              }`}>
                {m.content || (loading && i === messages.length - 1 ? <Loader2 className="w-4 h-4 animate-spin" /> : "")}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border p-4 bg-card/50 backdrop-blur space-y-2">
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder="Décrivez vos symptômes..."
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
