// Doctor AI - unified medical AI endpoint
// Modes: doctor (chat streaming), lab, research, patient
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPTS: Record<string, string> = {
  doctor: `Tu es Doctor AI, un assistant médical IA en français. Tu aides à comprendre des symptômes, oriente vers le bon professionnel, donne des conseils prudents.
RÈGLES STRICTES :
- Toujours répondre en français clair.
- Pose des questions de clarification (durée, intensité, antécédents).
- Donne 2-3 hypothèses possibles + niveau d'urgence (faible / modéré / ÉLEVÉ — appelez les urgences).
- Termine TOUJOURS par : "⚠️ Ceci ne remplace pas un avis médical. Consultez un professionnel de santé."
- Si urgence vitale détectée (douleur thoracique intense, AVC, hémorragie...), commence par "🚨 URGENCE" et donne les gestes immédiats.`,

  lab: `Tu es un simulateur d'analyses médicales (PÉDAGOGIQUE UNIQUEMENT). Génère des résultats RÉALISTES en JSON strict pour un patient virtuel.
Format de sortie OBLIGATOIRE (JSON uniquement, sans markdown) :
{
  "values": [{"name":"...","value":"...","unit":"...","normal":"...","status":"normal|bas|élevé|critique"}],
  "interpretation": "explication courte en français",
  "recommendations": ["..."],
  "severity": "normal|attention|critique"
}`,

  research: `Tu es un moteur de recherche médicale IA. Pour la requête de l'utilisateur, fournis une synthèse pédagogique en français.
Format Markdown :
## Résumé simple
(2-3 phrases grand public)
## Détails médicaux
(mécanisme, traitements, références bibliographiques type "PubMed / OMS")
## À retenir
- bullet
## Limites
(rappel : ne remplace pas un médecin)`,

  patient: `Tu génères un cas clinique virtuel. Réponds en JSON strict :
{
  "diagnosis_likely": "...",
  "differential": ["...", "..."],
  "evolution": "court paragraphe",
  "recommended_tests": ["..."],
  "treatment_options": ["..."]
}`,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode = "doctor", messages = [], prompt, stream = true, model = "google/gemini-3-flash-preview", tools } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sys = SYSTEM_PROMPTS[mode] ?? SYSTEM_PROMPTS.doctor;
    const finalMessages = messages.length > 0 ? messages : [{ role: "user", content: prompt ?? "" }];
    // When tools are provided we must use non-streaming so the client can run the agent loop
    const useStream = stream && mode === "doctor" && !tools;

    const body: Record<string, unknown> = {
      model,
      messages: [{ role: "system", content: sys }, ...finalMessages],
      stream: useStream,
    };
    if (tools && Array.isArray(tools) && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans un instant." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Crédits IA épuisés, ajoutez du crédit dans Lovable." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (useStream) {
      return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    const data = await response.json();
    // If tools were provided, return the full message (may include tool_calls)
    if (tools) {
      const message = data.choices?.[0]?.message ?? { role: "assistant", content: "" };
      const finish_reason = data.choices?.[0]?.finish_reason ?? null;
      return new Response(JSON.stringify({ message, finish_reason }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    let content: string = data.choices?.[0]?.message?.content ?? "";
    // Try parse JSON for non-doctor modes that expect JSON
    if (mode === "lab" || mode === "patient") {
      try {
        const cleaned = content.replace(/```json\n?|```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch {
        return new Response(JSON.stringify({ raw: content, error: "JSON parse failed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    return new Response(JSON.stringify({ content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("medical-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
