import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  advanceTime,
  applyAction,
  newPatient,
  type CardiacAction,
  type CardiacSession,
} from "@/lib/cardiac-game";

const SESSION_COLUMNS =
  "id, patient_name, patient_age, scenario, health, rhythm, shock_count, time_remaining, status, logs, last_tick_at, created_at, updated_at";

type Row = Record<string, unknown>;

function toSession(row: Row): CardiacSession {
  return {
    id: String(row['id']),
    patient_name: String(row['patient_name']),
    patient_age: Number(row['patient_age']),
    scenario: String(row['scenario']),
    health: Number(row['health']),
    rhythm: row['rhythm'] as CardiacSession["rhythm"],
    shock_count: Number(row['shock_count']),
    time_remaining: Number(row['time_remaining']),
    status: row['status'] as CardiacSession["status"],
    logs: Array.isArray(row['logs']) ? (row['logs'] as string[]) : [],
    last_tick_at: String(row['last_tick_at']),
    created_at: String(row['created_at']),
    updated_at: String(row['updated_at']),
  };
}

/** Rattrape le temps réel écoulé depuis le dernier tick et persiste le résultat. */
async function syncSession(
  supabase: { from: (t: string) => any },
  session: CardiacSession,
): Promise<CardiacSession> {
  if (session.status !== "active") return session;
  const elapsed = Math.floor((Date.now() - new Date(session.last_tick_at).getTime()) / 1000);
  if (elapsed < 1) return session;
  const core = advanceTime(session, elapsed);
  const { data, error } = await supabase
    .from("cardiac_sessions")
    .update({
      health: core.health,
      rhythm: core.rhythm,
      time_remaining: core.time_remaining,
      status: core.status,
      logs: core.logs,
      last_tick_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .select(SESSION_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toSession(data as Row);
}

export const listCardiacSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("cardiac_sessions")
      .select(SESSION_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const sessions = await Promise.all(
      (data ?? []).map((r) => syncSession(context.supabase as never, toSession(r as Row))),
    );
    return sessions;
  });

export const createCardiacSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const core = newPatient();
    const { data, error } = await context.supabase
      .from("cardiac_sessions")
      .insert({ ...core, user_id: context.userId, last_tick_at: new Date().toISOString() })
      .select(SESSION_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return toSession(data as Row);
  });

export const getCardiacSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data: input, context }) => {
    const { data, error } = await context.supabase
      .from("cardiac_sessions")
      .select(SESSION_COLUMNS)
      .eq("id", input.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const session = await syncSession(context.supabase as never, toSession(data as Row));
    const { data: msgs } = await context.supabase
      .from("cardiac_messages")
      .select("id, role, content, created_at")
      .eq("session_id", input.id)
      .order("created_at", { ascending: true });
    return { session, messages: (msgs ?? []) as { id: string; role: string; content: string; created_at: string }[] };
  });

export const actOnCardiacSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; action: CardiacAction }) => input)
  .handler(async ({ data: input, context }) => {
    const { data, error } = await context.supabase
      .from("cardiac_sessions")
      .select(SESSION_COLUMNS)
      .eq("id", input.id)
      .single();
    if (error) throw new Error(error.message);
    const synced = await syncSession(context.supabase as never, toSession(data as Row));
    if (synced.status !== "active") return synced;
    const core = applyAction(synced, input.action);
    const { data: updated, error: upErr } = await context.supabase
      .from("cardiac_sessions")
      .update({
        health: core.health,
        rhythm: core.rhythm,
        shock_count: core.shock_count,
        time_remaining: core.time_remaining,
        status: core.status,
        logs: core.logs,
        last_tick_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .select(SESSION_COLUMNS)
      .single();
    if (upErr) throw new Error(upErr.message);
    return toSession(updated as Row);
  });

export const tickCardiacSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data: input, context }) => {
    const { data, error } = await context.supabase
      .from("cardiac_sessions")
      .select(SESSION_COLUMNS)
      .eq("id", input.id)
      .single();
    if (error) throw new Error(error.message);
    return syncSession(context.supabase as never, toSession(data as Row));
  });

export const deleteCardiacSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data: input, context }) => {
    const { error } = await context.supabase.from("cardiac_sessions").delete().eq("id", input.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const SYSTEM_PROMPT = `Tu es Dr. AI, médecin urgentiste sénior qui encadre une SIMULATION PÉDAGOGIQUE de réanimation cardiaque.
Réponds toujours en français, de façon précise, structurée et concrète.
Appuie-toi sur les recommandations ACLS/ERC : rythmes choquables (FV/TV sans pouls) vs non choquables (asystolie/AESP),
énergie de défibrillation, adrénaline 1 mg IV/IO toutes les 3-5 min, amiodarone 300 mg après le 3e choc,
RCP 30:2, 100-120 compressions/min, causes réversibles (4H/4T).
Réponds vraiment à la question posée, avec des doses et des étapes chiffrées. 4 à 8 lignes maximum.
Termine par une ligne : "⚠️ Simulation pédagogique — ne remplace pas un avis médical."`;

async function callGateway(messages: { role: string; content: string }[]): Promise<string> {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) throw new Error("Assistant IA non configuré.");
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({ model: "google/gemini-3.8-flash", messages, stream: false }),
  });
  if (!resp.ok) {
    if (resp.status === 429) throw new Error("Trop de requêtes IA, réessayez dans quelques secondes.");
    if (resp.status === 402) throw new Error("Crédits IA épuisés — ajoutez du crédit pour continuer.");
    throw new Error(`Assistant indisponible (${resp.status}).`);
  }
  const json = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() || "Je n'ai pas pu formuler de réponse.";
}

function contextLine(s: CardiacSession) {
  return `État actuel du patient simulé : ${s.patient_name}, ${s.patient_age} ans, scénario "${s.scenario}". Rythme=${s.rhythm}, santé=${s.health}%, chocs délivrés=${s.shock_count}, temps restant=${s.time_remaining}s, statut=${s.status}.`;
}

export const askCardiacAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; question: string }) => {
    if (!input.question.trim()) throw new Error("Question vide");
    return input;
  })
  .handler(async ({ data: input, context }) => {
    const { data: row, error } = await context.supabase
      .from("cardiac_sessions")
      .select(SESSION_COLUMNS)
      .eq("id", input.id)
      .single();
    if (error) throw new Error(error.message);
    const session = toSession(row as Row);

    const { data: history } = await context.supabase
      .from("cardiac_messages")
      .select("role, content")
      .eq("session_id", input.id)
      .order("created_at", { ascending: true })
      .limit(30);

    await context.supabase.from("cardiac_messages").insert({
      session_id: input.id,
      user_id: context.userId,
      role: "user",
      content: input.question,
    });

    const answer = await callGateway([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: contextLine(session) },
      ...((history ?? []) as { role: string; content: string }[]),
      { role: "user", content: input.question },
    ]);

    const { data: saved } = await context.supabase
      .from("cardiac_messages")
      .insert({ session_id: input.id, user_id: context.userId, role: "assistant", content: answer })
      .select("id, role, content, created_at")
      .single();

    return { answer, message: saved };
  });

/** L'IA choisit et applique la meilleure action pour un patient (mode gestion automatique). */
export const aiManageCardiacSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data: input, context }) => {
    const { data: row, error } = await context.supabase
      .from("cardiac_sessions")
      .select(SESSION_COLUMNS)
      .eq("id", input.id)
      .single();
    if (error) throw new Error(error.message);
    const synced = await syncSession(context.supabase as never, toSession(row as Row));
    if (synced.status !== "active") return { session: synced, action: null as CardiacAction | null, rationale: "Partie terminée." };

    const raw = await callGateway([
      {
        role: "system",
        content:
          "Tu pilotes une simulation ACLS. Choisis UNE action parmi SHOCK, MEDS, CPR, WAIT. " +
          'Réponds uniquement au format "ACTION|justification en une phrase française".',
      },
      { role: "user", content: contextLine(synced) },
    ]);
    const [tagRaw, ...rest] = raw.split("|");
    const tag = (tagRaw ?? "").toUpperCase().replace(/[^A-Z]/g, "");
    const action: CardiacAction = (["SHOCK", "MEDS", "CPR", "WAIT"] as const).includes(tag as CardiacAction)
      ? (tag as CardiacAction)
      : synced.rhythm === "VFIB"
        ? "SHOCK"
        : "CPR";
    const rationale = rest.join("|").trim() || "Décision IA selon le protocole ACLS.";

    const core = applyAction(synced, action);
    core.logs = [...core.logs, `[IA] ${action} — ${rationale}`];
    const { data: updated, error: upErr } = await context.supabase
      .from("cardiac_sessions")
      .update({
        health: core.health,
        rhythm: core.rhythm,
        shock_count: core.shock_count,
        time_remaining: core.time_remaining,
        status: core.status,
        logs: core.logs,
        last_tick_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .select(SESSION_COLUMNS)
      .single();
    if (upErr) throw new Error(upErr.message);
    return { session: toSession(updated as Row), action, rationale };
  });

/** Synthèse de triage IA sur l'ensemble des patients actifs. */
export const aiTriageReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("cardiac_sessions")
      .select(SESSION_COLUMNS)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    const sessions = await Promise.all(
      (data ?? []).map((r) => syncSession(context.supabase as never, toSession(r as Row))),
    );
    if (sessions.length === 0) return { report: "Aucun patient actif à trier." };
    const list = sessions.map((s, i) => `${i + 1}. ${contextLine(s)}`).join("\n");
    const report = await callGateway([
      {
        role: "system",
        content:
          "Tu es le régulateur IA d'un service d'urgences simulé. Classe les patients par priorité, " +
          "donne pour chacun l'action immédiate recommandée. Français, liste courte, une ligne par patient.",
      },
      { role: "user", content: list },
    ]);
    return { report };
  });
