import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { Button } from "@/components/ui/button";
import { Stethoscope, FlaskConical, BookOpen, Bell, Sparkles, ShieldCheck, Globe, ArrowRight, Activity, Heart, Brain } from "lucide-react";

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
  { to: "/doctor", icon: Stethoscope, title: "AI Doctor", desc: "Chat médical IA, analyse de symptômes et orientation immédiate.", color: "from-blue-500/15 to-teal-500/10", iconBg: "bg-accent" },
  { to: "/lab", icon: FlaskConical, title: "Virtual Lab", desc: "Simulez analyses sang, urine, rein, cœur — patient virtuel et cas cliniques.", color: "from-teal-500/15 to-emerald-500/10", iconBg: "bg-teal" },
  { to: "/research", icon: BookOpen, title: "Recherche médicale", desc: "Synthèses scientifiques pédagogiques générées par IA.", color: "from-indigo-500/15 to-blue-500/10", iconBg: "bg-primary" },
  { to: "/reminders", icon: Bell, title: "Rappels santé", desc: "N'oubliez plus vos médicaments, rendez-vous et analyses.", color: "from-amber-500/15 to-orange-500/10", iconBg: "bg-warning" },
];

function Index() {
  return (
    <AppShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-95" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative px-6 md:px-12 py-16 md:py-24 max-w-6xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white/90 text-xs backdrop-blur border border-white/20 mb-6">
            <Sparkles className="w-3 h-3" />
            Plateforme IA santé — pour l'Afrique et le monde
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-bold text-white leading-[1.05] max-w-3xl">
            Votre assistant médical intelligent
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-cyan-200"> tout-en-un.</span>
          </h1>
          <p className="mt-5 text-base md:text-lg text-white/85 max-w-2xl">
            Chat médical IA, laboratoire virtuel, recherche scientifique, prévention et rappels — une plateforme unique pour comprendre, apprendre et se soigner.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/doctor">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 shadow-elegant">
                <Stethoscope className="w-4 h-4 mr-2" />Parler à Doctor AI
              </Button>
            </Link>
            <Link to="/lab">
              <Button size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                <FlaskConical className="w-4 h-4 mr-2" />Explorer le Lab
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
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold">Modules</h2>
            <p className="text-muted-foreground text-sm mt-1">Quatre puissants outils pour votre santé.</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {MODULES.map((m) => (
            <Link key={m.to} to={m.to} className={`group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${m.color} p-6 hover:shadow-elegant transition-all`}>
              <div className={`w-12 h-12 rounded-xl ${m.iconBg} text-white flex items-center justify-center mb-4 shadow-soft`}>
                <m.icon className="w-6 h-6" />
              </div>
              <h3 className="font-display font-semibold text-lg">{m.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{m.desc}</p>
              <div className="mt-4 flex items-center text-sm font-medium text-primary group-hover:gap-2 transition-all">
                Ouvrir <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section className="px-6 md:px-12 py-12 max-w-6xl">
        <h2 className="font-display text-2xl md:text-3xl font-bold mb-8">Conçu pour votre quotidien</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: Activity, t: "Suivi adhérence", d: "Statistiques de prise et alertes en cas d'oubli." },
            { icon: Brain, t: "IA explicable", d: "Hypothèses, niveau d'urgence, conseils clairs." },
            { icon: Heart, t: "Prévention", d: "Conseils personnalisés et prédiction de risques." },
          ].map((f) => (
            <div key={f.t} className="rounded-xl border border-border bg-card p-5">
              <f.icon className="w-5 h-5 text-accent mb-3" />
              <h3 className="font-display font-semibold">{f.t}</h3>
              <p className="text-sm text-muted-foreground mt-1">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 md:px-12 pb-16 max-w-6xl">
        <MedicalDisclaimer />
      </section>
    </AppShell>
  );
}
