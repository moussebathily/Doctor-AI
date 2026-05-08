import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/research")({
  head: () => ({
    meta: [
      { title: "Recherche médicale — Doctor AI" },
      { name: "description", content: "Synthèses médicales scientifiques générées par IA." },
    ],
  }),
  component: ResearchPage,
});

const EXAMPLES = [
  "Cancer du foie traitement",
  "Diabète type 2 prévention",
  "Paludisme dernières recherches",
  "Hypertension et grossesse",
];

function ResearchPage() {
  const [q, setQ] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const search = async (query: string) => {
    if (!query.trim()) return;
    setLoading(true); setContent("");
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/medical-ai`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "research", prompt: query, stream: false }),
      });
      if (!resp.ok) { toast.error("Erreur"); setLoading(false); return; }
      const data = await resp.json();
      setContent(data.content || "");
    } catch { toast.error("Erreur réseau"); }
    finally { setLoading(false); }
  };

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-10 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl gradient-teal flex items-center justify-center shadow-soft">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold">Recherche médicale</h1>
            <p className="text-sm text-muted-foreground">Synthèses pédagogiques à partir de la littérature scientifique.</p>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); search(q); }} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex : cancer du foie traitement" className="pl-10 h-12" />
          </div>
          <Button type="submit" size="lg" disabled={loading || !q.trim()}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Rechercher"}
          </Button>
        </form>

        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => { setQ(e); search(e); }} className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-accent hover:bg-accent/5 transition">
              {e}
            </button>
          ))}
        </div>

        {loading && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Recherche en cours...
          </div>
        )}

        {content && (
          <article className="rounded-2xl border border-border bg-card p-6">
            <FormattedMarkdown text={content} />
          </article>
        )}

        <MedicalDisclaimer />
      </div>
    </AppShell>
  );
}

// minimal markdown renderer (## headings, - bullets, **bold**)
function FormattedMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="prose-doctor space-y-2">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) return <h2 key={i} className="font-display text-xl font-bold mt-4">{line.slice(3)}</h2>;
        if (line.startsWith("# ")) return <h1 key={i} className="font-display text-2xl font-bold mt-4">{line.slice(2)}</h1>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="ml-5 list-disc text-sm">{renderBold(line.slice(2))}</li>;
        if (!line.trim()) return <div key={i} className="h-2" />;
        return <p key={i} className="text-sm leading-relaxed">{renderBold(line)}</p>;
      })}
    </div>
  );
}
function renderBold(s: string) {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>);
}
