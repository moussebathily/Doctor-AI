import { supabase } from "@/integrations/supabase/client";
import { fetchNearbyPharmacies, getUserLocation } from "@/lib/pharmacy";

// OpenAI-compatible tool schema for Lovable AI Gateway
export const MEDICAL_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Crée un rappel santé pour l'utilisateur (médicament, rendez-vous médical, ou analyse à effectuer). À utiliser dès que l'utilisateur demande de lui rappeler quelque chose.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["medicament", "rdv", "analyse"], description: "Type de rappel" },
          title: { type: "string", description: "Titre court (ex: 'Doliprane 500mg', 'Cardiologue Dr X', 'Prise de sang')" },
          dose: { type: "string", description: "Posologie pour un médicament (ex: '1 comprimé matin et soir'). Optionnel." },
          time: { type: "string", description: "Heure HH:MM (ex: '20:00'). Optionnel." },
          date: { type: "string", description: "Date YYYY-MM-DD. Optionnel." },
          notes: { type: "string", description: "Notes supplémentaires. Optionnel." },
        },
        required: ["type", "title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_reminders",
      description: "Liste les rappels actifs de l'utilisateur. À utiliser quand l'utilisateur demande à voir / vérifier ses rappels.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "run_lab_simulation",
      description: "Lance une simulation pédagogique d'analyse médicale pour un patient virtuel (sang, urine, rein ou cœur). Retourne valeurs simulées + interprétation.",
      parameters: {
        type: "object",
        properties: {
          analysis_type: { type: "string", enum: ["sang", "urine", "rein", "coeur"], description: "Type d'analyse" },
          age: { type: "number", description: "Âge du patient" },
          sex: { type: "string", enum: ["femme", "homme"] },
          symptoms: { type: "string", description: "Symptômes décrits par le patient" },
        },
        required: ["analysis_type", "age", "sex", "symptoms"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_pharmacies",
      description: "Trouve les pharmacies réelles autour de l'utilisateur via géolocalisation. Retourne nom, adresse, distance.",
      parameters: {
        type: "object",
        properties: {
          radius_km: { type: "number", description: "Rayon de recherche en km (défaut 3)", default: 3 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_medication",
      description: "Recherche un médicament dans le catalogue (nom commercial ou DCI). Retourne posologie, ordonnance, interactions connues.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Nom du médicament (ex: Doliprane, ibuprofène)" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_drug_interactions",
      description: "Vérifie s'il existe des interactions dangereuses entre une liste de médicaments.",
      parameters: {
        type: "object",
        properties: {
          medications: { type: "array", items: { type: "string" }, description: "Liste de noms de médicaments" },
        },
        required: ["medications"],
        additionalProperties: false,
      },
    },
  },
] as const;

const ANALYSIS_LABELS: Record<string, string> = {
  sang: "Sang (NFS, glycémie)",
  urine: "Urinaire (ECBU)",
  rein: "Bilan rénal",
  coeur: "Bilan cardiaque",
};

// Execute a tool call client-side (uses authenticated supabase client)
export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    if (name === "create_reminder") {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return JSON.stringify({ error: "Vous devez être connecté." });
      const payload = {
        user_id: u.user.id,
        type: String(args.type),
        title: String(args.title),
        dose: args.dose ? String(args.dose) : null,
        time: args.time ? String(args.time) : null,
        date: args.date ? String(args.date) : null,
        notes: args.notes ? String(args.notes) : null,
      };
      const { data, error } = await supabase.from("reminders").insert(payload).select().single();
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, reminder: data });
    }

    if (name === "list_reminders") {
      const { data, error } = await supabase.from("reminders").select("type,title,dose,time,date,notes,status").order("created_at", { ascending: false }).limit(50);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ count: data?.length ?? 0, reminders: data });
    }

    if (name === "run_lab_simulation") {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/medical-ai`;
      const label = ANALYSIS_LABELS[String(args.analysis_type)] ?? "Analyse";
      const prompt = `Patient virtuel : ${args.age} ans, ${args.sex}. Symptômes : ${args.symptoms}. Génère une analyse "${label}" cohérente.`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "lab", prompt, stream: false }),
      });
      const j = await r.json();
      return JSON.stringify(j);
    }

    return JSON.stringify({ error: `Tool inconnu : ${name}` });
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" });
  }
}
