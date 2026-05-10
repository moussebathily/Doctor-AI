import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, Stethoscope, FlaskConical, BookOpen, Bell, User, LogOut, Heart, Boxes, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Accueil", icon: Activity },
  { to: "/doctor", label: "Doctor AI", icon: Stethoscope },
  { to: "/lab", label: "Virtual Lab", icon: FlaskConical },
  { to: "/simulation", label: "Simulation 3D", icon: Boxes },
  { to: "/pharmacy", label: "Pharmacies", icon: MapPin },
  { to: "/research", label: "Recherche", icon: BookOpen },
  { to: "/reminders", label: "Rappels", icon: Bell },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { location } = useRouterState();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user?.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card/60 backdrop-blur sticky top-0 h-screen">
        <Link to="/" className="flex items-center gap-2 px-6 py-5 border-b border-border">
          <div className="w-9 h-9 rounded-xl gradient-teal flex items-center justify-center shadow-soft">
            <Heart className="w-5 h-5 text-white" fill="white" />
          </div>
          <div>
            <div className="font-display font-bold text-lg leading-none">Doctor AI</div>
            <div className="text-[10px] text-muted-foreground tracking-wider uppercase">Virtual Lab</div>
          </div>
        </Link>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const active = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          {email ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-2 text-xs">
                <div className="w-7 h-7 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-semibold text-[11px]">
                  {email[0].toUpperCase()}
                </div>
                <span className="truncate text-muted-foreground">{email}</span>
              </div>
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => supabase.auth.signOut()}>
                <LogOut className="w-3.5 h-3.5 mr-2" />Se déconnecter
              </Button>
            </div>
          ) : (
            <Link to="/auth">
              <Button className="w-full" size="sm">
                <User className="w-3.5 h-3.5 mr-2" />Connexion
              </Button>
            </Link>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 bg-card/90 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-teal flex items-center justify-center">
              <Heart className="w-4 h-4 text-white" fill="white" />
            </div>
            <span className="font-display font-bold">Doctor AI</span>
          </Link>
          {!email && (
            <Link to="/auth"><Button size="sm" variant="outline">Connexion</Button></Link>
          )}
        </div>
        <nav className="flex overflow-x-auto px-2 pb-2 gap-1 no-scrollbar">
          {NAV.map((item) => {
            const active = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap",
                active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                <Icon className="w-3.5 h-3.5" />{item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 min-w-0 pt-28 md:pt-0">
        {children}
      </main>
    </div>
  );
}
