import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Stethoscope,
  FlaskConical,
  BookOpen,
  Bell,
  LogOut,
  Heart,
  Boxes,
  MapPin,
  Search,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Accueil", icon: Activity },
  { to: "/doctor", label: "Doctor AI", icon: Stethoscope },
  { to: "/lab", label: "Virtual Lab", icon: FlaskConical },
  { to: "/simulation", label: "Simulation 3D", icon: Boxes },
  { to: "/pharmacy", label: "Pharmacies", icon: MapPin },
  { to: "/research", label: "Recherche", icon: Search },
  { to: "/reminders", label: "Rappels", icon: BookOpen },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { location } = useRouterState();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user?.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const displayName = email ? email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "Invité";
  const initial = (email?.[0] ?? "G").toUpperCase();

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[oklch(0.14_0.03_255)] via-[oklch(0.16_0.035_252)] to-[oklch(0.13_0.03_255)] text-slate-100">
      {/* Top nav — matches mockup */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[oklch(0.14_0.03_255/0.85)] border-b border-white/5">
        <div className="max-w-[1600px] mx-auto px-3 md:px-6 h-16 flex items-center gap-2 md:gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center shadow-[0_0_18px_-4px_oklch(0.72_0.15_220/0.9)]">
              <Heart className="w-5 h-5 text-white" fill="white" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-white hidden sm:inline">Doctor AI</span>
          </Link>

          {/* Nav */}
          <nav className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar">
            {NAV.map((item) => {
              const active = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                    active ? "text-white" : "text-slate-400 hover:text-slate-100",
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                  {active && (
                    <span className="absolute -bottom-[1px] left-2 right-2 h-[2px] rounded-full bg-gradient-to-r from-sky-400 to-cyan-400 shadow-[0_0_10px_oklch(0.72_0.15_220/0.9)]" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right cluster */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="relative w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-slate-300"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500" />
            </button>

            <div className="hidden md:flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl bg-white/5 border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-slate-900 flex items-center justify-center font-bold text-sm">
                {initial}
              </div>
              <div className="leading-tight pr-1">
                <div className="text-xs font-semibold text-white">{displayName}</div>
                <div className="text-[10px] text-amber-400 font-semibold tracking-wide">Premium</div>
              </div>
            </div>

            {email ? (
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className="w-9 h-9 rounded-lg bg-white/5 hover:bg-rose-500/20 border border-white/5 flex items-center justify-center text-slate-300 hover:text-rose-300 transition-colors"
                aria-label="Se déconnecter"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <Link to="/auth">
                <Button size="sm" className="h-9 bg-sky-500 hover:bg-sky-400 text-white">
                  <User className="w-4 h-4 mr-1.5" /> Connexion
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="min-w-0">{children}</main>
    </div>
  );
}
