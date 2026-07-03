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
  Crown,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";

const NAV = [
  { to: "/", label: "Accueil", icon: Activity },
  { to: "/doctor", label: "Doctor AI", icon: Stethoscope },
  { to: "/lab", label: "Virtual Lab", icon: FlaskConical },
  { to: "/simulation", label: "Simulation 3D", icon: Boxes },
  { to: "/pharmacy", label: "Pharmacies", icon: MapPin },
  { to: "/research", label: "Recherche", icon: Search },
  { to: "/reminders", label: "Rappels", icon: BookOpen },
] as const;

type Notif = { id: string; icon: typeof Bell; title: string; body: string; when: string; tone: "info" | "success" | "warn" };
const DEFAULT_NOTIFS: Notif[] = [
  { id: "1", icon: Sparkles, title: "Nouvelle simulation débloquée", body: "Pontage coronarien — niveau avancé disponible.", when: "il y a 5 min", tone: "info" },
  { id: "2", icon: CheckCircle2, title: "Progression sauvegardée", body: "Votre appendicectomie a été enregistrée.", when: "il y a 1 h", tone: "success" },
  { id: "3", icon: AlertTriangle, title: "Rappel médical", body: "Un traitement arrive à échéance demain.", when: "hier", tone: "warn" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { location } = useRouterState();
  const [email, setEmail] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>(DEFAULT_NOTIFS);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user?.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const displayName = email ? email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "Invité";
  const initial = (email?.[0] ?? "G").toUpperCase();
  const unread = notifs.length;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[oklch(0.14_0.03_255)] via-[oklch(0.16_0.035_252)] to-[oklch(0.13_0.03_255)] text-slate-100">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[oklch(0.14_0.03_255/0.85)] border-b border-white/5">
        <div className="max-w-[1600px] mx-auto px-3 md:px-6 h-16 flex items-center gap-2 md:gap-6">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center shadow-[0_0_18px_-4px_oklch(0.72_0.15_220/0.9)]">
              <Heart className="w-5 h-5 text-white" fill="white" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-white hidden sm:inline">Doctor AI</span>
          </Link>

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

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              className="relative w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-slate-300"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center border border-[oklch(0.14_0.03_255)]">
                  {unread}
                </span>
              )}
            </button>

            {email ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="hidden md:flex items-center gap-2 pl-2 pr-2 py-1 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                    aria-label="Menu profil"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-slate-900 flex items-center justify-center font-bold text-sm">
                      {initial}
                    </div>
                    <div className="leading-tight pr-1 text-left">
                      <div className="text-xs font-semibold text-white">{displayName}</div>
                      <div className="text-[10px] text-amber-400 font-semibold tracking-wide flex items-center gap-0.5">
                        <Crown className="w-2.5 h-2.5" /> Premium · Actif
                      </div>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 bg-[oklch(0.16_0.035_252)] border-white/10 text-slate-100">
                  <DropdownMenuLabel className="text-slate-300">
                    <div className="text-xs font-semibold text-white">{displayName}</div>
                    <div className="text-[10px] text-slate-400 font-normal truncate">{email}</div>
                  </DropdownMenuLabel>
                  <div className="mx-2 my-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-400/30 p-2.5">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-amber-400" />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-white leading-none">Premium</p>
                        <p className="text-[10px] text-amber-300 mt-0.5">Accès complet · valide jusqu'au 31/12/2026</p>
                      </div>
                    </div>
                  </div>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem className="focus:bg-white/10 focus:text-white">
                    <User className="w-4 h-4 mr-2" /> Mon profil
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-white/10 focus:text-white" onClick={() => toast.info("Vous êtes déjà Premium ✨")}>
                    <Crown className="w-4 h-4 mr-2 text-amber-400" /> Gérer Premium
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-white/10 focus:text-white">
                    <Settings className="w-4 h-4 mr-2" /> Paramètres
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onClick={() => supabase.auth.signOut()}
                    className="focus:bg-rose-500/20 focus:text-rose-200 text-rose-300"
                  >
                    <LogOut className="w-4 h-4 mr-2" /> Se déconnecter
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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

      <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
        <SheetContent side="right" className="bg-[oklch(0.14_0.03_255)] border-white/10 text-slate-100 w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-white flex items-center gap-2"><Bell className="w-4 h-4" /> Notifications</SheetTitle>
            <SheetDescription className="text-slate-400">
              {unread === 0 ? "Aucune notification" : `${unread} notification${unread > 1 ? "s" : ""} non lue${unread > 1 ? "s" : ""}`}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {notifs.map((n) => {
              const Icon = n.icon;
              const tone = n.tone === "success" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
                : n.tone === "warn" ? "text-amber-300 bg-amber-500/10 border-amber-500/30"
                : "text-sky-300 bg-sky-500/10 border-sky-500/30";
              return (
                <div key={n.id} className={cn("rounded-xl border p-3 flex gap-3", tone)}>
                  <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{n.title}</p>
                    <p className="text-xs text-slate-300 mt-0.5">{n.body}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{n.when}</p>
                  </div>
                </div>
              );
            })}
            {notifs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full bg-white/5 border-white/10 text-slate-100 hover:bg-white/10"
                onClick={() => { setNotifs([]); toast.success("Notifications marquées comme lues"); }}
              >
                Tout marquer comme lu
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <main className="min-w-0">{children}</main>
    </div>
  );
}
