import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Stethoscope, FlaskConical, BookOpen, Bell, Sparkles, ShieldCheck,
  Globe, ArrowRight, Activity, Heart, Brain, MessageSquare, Pill, CalendarDays, Beaker, TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Doctor AI — Plateforme IA santé" },
      { name: "description", content: "Assistant médical IA, laboratoire virtuel, recherche scientifique et rappels de médicaments." },
    ],
  }),
  component: Index,
});

const MODULES = [
  { to: "/doctor", icon: Stethoscope, title: "AI Doctor", desc: "Chat médical IA capable d'agir : crée vos rappels, lance des analyses.", accent: "accent" },
  { to: "/lab", icon: FlaskConical, title: "Virtual Lab", desc: "Simulez analyses sang, urine, rein, cœur — patient virtuel.", accent: "teal" },
  { to: "/research", icon: BookOpen, title: "Recherche médicale", desc: "Synthèses scientifiques pédagogiques.", accent: "primary" },
  { to: "/reminders", icon: Bell, title: "Rappels santé", desc: "Médicaments, rendez-vous, analyses.", accent: "warning" },
] as const;

function Index() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [stats, setStats] = useState({ reminders: 0, sims: 0, conversations: 0, loading: true });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser({ id: data.user.id, email: data.user.email ?? "" });
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [r, s, c] = await Promise.all([
        supabase.from("reminders").select("*", { count: "exact", head: true }),
        supabase.from("lab_simulations").select("*", { count: "exact", head: true }),
        supabase.from("conversations").select("*", { count: "exact", head: true }),
      ]);
      setStats({ reminders: r.count ?? 0, sims: s.count ?? 0, conversations: c.count ?? 0, loading: false });
    })();
  }, [user]);

  return (
    <AppShell>
      {user ? <Dashboard email={user.email} stats={stats} /> : <Landing />}
      <section className="px-6 md:px-12 pb-16 max-w-6xl">
        <MedicalDisclaimer />
      </section>
    </AppShell>
  );
}

function Dashboard({ email, stats }: { email: string; stats: { reminders: number; sims: number; conversations: number; loading: boolean } }) {
  const firstName = email.split("@")[0];
  const STATS = [
    { label: "Conversations", value: stats.conversations, icon: MessageSquare, color: "text-accent bg-accent/10" },
    { label: "Rappels actifs", value: stats.reminders, icon: Pill, color: "text-warning bg-warning/15" },
    { label: "Simulations", value: stats.sims, icon: Beaker, color: "text-teal bg-teal/15" },
  ];
  const SHORTCUTS = [
    { to: "/doctor", icon: Stethoscope, label: "Nouvelle consultation", sub: "Chat avec Doctor AI" },
    { to: "/reminders", icon: Bell, label: "Ajouter un rappel", sub: "Médicament, RDV, analyse" },
    { to: "/lab", icon: FlaskConical, label: "Lancer une simulation", sub: "Analyse virtuelle" },
    { to: "/research", icon: BookOpen, label: "Rechercher", sub: "Synthèse scientifique" },
  ] as const;

  return (
    <div className="px-6 md:px-12 py-8 md:py-12 max-w-6xl space-y-8 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">Bonjour 👋</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold capitalize">{firstName}</h1>
        </div>
        <Link to="/doctor">
          <Button size="lg" className="shadow-soft">
            <Stethoscope className="w-4 h-4 mr-2" /> Démarrer une consultation
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-3">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-5 hover:shadow-elegant transition-all">
            <div className="flex items-center justify-between">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <TrendingUp className="w-4 h-4 text-muted-foreground/60" />
            </div>
            <div className="mt-4 font-display text-3xl font-bold">{stats.loading ? "—" : s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="font-display text-xl font-bold mb-4">Actions rapides</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SHORTCUTS.map((s) => (
            <Link key={s.to} to={s.to} className="group rounded-xl border border-border bg-card p-4 hover:border-accent hover:shadow-soft transition-all">
              <s.icon className="w-5 h-5 text-accent" />
              <div className="mt-3 font-medium text-sm">{s.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.sub}</div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground mt-3 group-hover:translate-x-1 transition-transform" />
            </Link>
          ))}
        </div>
      </div>

      {/* Modules detail */}
      <div>
        <h2 className="font-display text-xl font-bold mb-4">Modules</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {MODULES.map((m) => (
            <Link key={m.to} to={m.to} className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 hover:shadow-elegant transition-all">
              <div className="flex items-start justify-between">
                <div className={`w-12 h-12 rounded-xl text-white flex items-center justify-center shadow-soft ${
                  m.accent === "accent" ? "bg-accent" : m.accent === "teal" ? "bg-teal" : m.accent === "warning" ? "bg-warning" : "bg-primary"
                }`}>
                  <m.icon className="w-6 h-6" />
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="mt-4 font-display font-semibold text-lg">{m.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{m.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Landing() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-95" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_50%)]" />
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-teal/30 blur-3xl animate-pulse" />
        <div className="relative px-6 md:px-12 py-16 md:py-28 max-w-6xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white/90 text-xs backdrop-blur border border-white/20 mb-6 animate-fade-in">
            <Sparkles className="w-3 h-3" />
            Plateforme IA santé — pour l'Afrique et le monde
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-bold text-white leading-[1.05] max-w-3xl animate-fade-in">
            Votre assistant médical intelligent
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-cyan-200">tout-en-un.</span>
          </h1>
          <p className="mt-5 text-base md:text-lg text-white/85 max-w-2xl">
            Chat médical IA, laboratoire virtuel, recherche scientifique et rappels — une plateforme unique pour comprendre, apprendre et se soigner.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 shadow-elegant hover-scale">
                <Sparkles className="w-4 h-4 mr-2" /> Commencer gratuitement
              </Button>
            </Link>
            <Link to="/doctor">
              <Button size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                <Stethoscope className="w-4 h-4 mr-2" /> Essayer Doctor AI
              </Button>
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl">
            {[
              { icon: ShieldCheck, label: "Données chiffrées" },
              { icon: Globe, label: "Multilingue" },
              { icon: Brain, label: "IA médicale" },
              { icon: Heart, label: "Prévention" },
            ].map((b) => (
              <div key={b.label} className="flex items-center gap-2 text-white/80 text-xs">
                <b.icon className="w-4 h-4" />{b.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="px-6 md:px-12 py-12 md:py-16 max-w-6xl">
        <div className="mb-8">
          <h2 className="font-display text-2xl md:text-3xl font-bold">Quatre modules, une seule plateforme</h2>
          <p className="text-muted-foreground text-sm mt-1">Chaque module est conçu pour un usage quotidien.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {MODULES.map((m) => (
            <Link key={m.to} to={m.to} className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 hover:shadow-elegant transition-all">
              <div className={`w-12 h-12 rounded-xl text-white flex items-center justify-center mb-4 shadow-soft ${
                m.accent === "accent" ? "bg-accent" : m.accent === "teal" ? "bg-teal" : m.accent === "warning" ? "bg-warning" : "bg-primary"
              }`}>
                <m.icon className="w-6 h-6" />
              </div>
              <h3 className="font-display font-semibold text-lg">{m.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{m.desc}</p>
              <div className="mt-4 flex items-center text-sm font-medium text-primary group-hover:gap-2 transition-all">
                Découvrir <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 md:px-12 py-12 max-w-6xl">
        <h2 className="font-display text-2xl md:text-3xl font-bold mb-8">Conçu pour votre quotidien</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: Activity, t: "Suivi adhérence", d: "Statistiques de prise et alertes en cas d'oubli." },
            { icon: Brain, t: "IA explicable", d: "Hypothèses, niveau d'urgence, conseils clairs." },
            { icon: CalendarDays, t: "Tout en un seul chat", d: "Doctor AI crée vos rappels et lance les analyses." },
          ].map((f) => (
            <div key={f.t} className="rounded-xl border border-border bg-card p-5 hover:shadow-soft transition-all">
              <f.icon className="w-5 h-5 text-accent mb-3" />
              <h3 className="font-display font-semibold">{f.t}</h3>
              <p className="text-sm text-muted-foreground mt-1">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
