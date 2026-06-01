import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Loader2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { setPharmacyPrefill } from "@/lib/sim-bridge";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

async function callAI(prompt: string): Promise<string> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/medical-ai`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "research", stream: false, prompt }),
  });
  const j = await r.json();
  return j.content ?? j.raw ?? "";
}

export function OrganInfoPanel({ organ, onClose }: { organ: string | null; onClose: () => void }) {
  const [info, setInfo] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!organ) return;
    setInfo("");
    setLoading(true);
    callAI(
      `Fiche médicale concise (markdown, max 8 lignes) sur l'organe / partie anatomique « ${organ} ». Structure :\n## Fonction\n## Pathologies fréquentes\n## Examens utiles\nTermine par une suggestion de **médicaments génériques** (1 ligne) sans mentionner de marques.`,
    )
      .then(setInfo)
      .catch(() => setInfo("Information indisponible."))
      .finally(() => setLoading(false));
  }, [organ]);

  return (
    <Dialog open={!!organ} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display capitalize">
            <Sparkles className="w-4 h-4 text-accent" /> {organ ?? ""}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Analyse IA…
          </div>
        ) : (
          <div className="prose prose-sm max-w-none text-sm prose-headings:text-sm prose-headings:font-display prose-h2:mt-2">
            <ReactMarkdown>{info}</ReactMarkdown>
          </div>
        )}
        <Button
          size="sm"
          className="mt-2 bg-teal hover:bg-teal/90 text-teal-foreground"
          onClick={() => {
            if (!organ) return;
            setPharmacyPrefill({ reason: `Symptômes liés à : ${organ}`, searchTerms: ["paracetamol", "ibuprofen"] });
            toast.success("Panier pharmacie pré-rempli");
            navigate({ to: "/pharmacy" });
          }}
        >
          <ShoppingBag className="w-4 h-4 mr-1" /> Voir traitements en pharmacie
        </Button>
      </DialogContent>
    </Dialog>
  );
}
