import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Connexion — Doctor AI" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [signup, setSignup] = useState({ email: "", password: "", name: "" });
  const [login, setLogin] = useState({ email: "", password: "" });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/" });
    });
  }, [navigate]);

  const doSignup = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signup.email,
      password: signup.password,
      options: {
        data: { full_name: signup.name },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Compte créé. Vérifiez votre email pour confirmer.");
  };

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: login.email, password: login.password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Connecté !");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex relative gradient-hero items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="relative max-w-md text-white">
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mb-6">
            <Heart className="w-7 h-7" fill="white" />
          </div>
          <h2 className="font-display text-4xl font-bold leading-tight">Votre santé,<br />guidée par l'IA.</h2>
          <p className="mt-4 text-white/85">Rejoignez Doctor AI : chat médical, laboratoire virtuel, recherche scientifique et rappels santé.</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12 bg-background">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl gradient-teal flex items-center justify-center"><Heart className="w-5 h-5 text-white" fill="white" /></div>
            <span className="font-display font-bold text-lg">Doctor AI</span>
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Bienvenue</h1>
            <p className="text-sm text-muted-foreground mt-1">Connectez-vous ou créez votre compte.</p>
          </div>

          <Tabs defaultValue="login">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Connexion</TabsTrigger>
              <TabsTrigger value="signup">Inscription</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4">
              <form onSubmit={doLogin} className="space-y-3">
                <div><Label className="text-xs">Email</Label><Input type="email" required value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} /></div>
                <div><Label className="text-xs">Mot de passe</Label><Input type="password" required value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} /></div>
                <Button type="submit" disabled={loading} className="w-full">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Se connecter"}</Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-4">
              <form onSubmit={doSignup} className="space-y-3">
                <div><Label className="text-xs">Nom complet</Label><Input required value={signup.name} onChange={(e) => setSignup({ ...signup, name: e.target.value })} /></div>
                <div><Label className="text-xs">Email</Label><Input type="email" required value={signup.email} onChange={(e) => setSignup({ ...signup, email: e.target.value })} /></div>
                <div><Label className="text-xs">Mot de passe</Label><Input type="password" required minLength={6} value={signup.password} onChange={(e) => setSignup({ ...signup, password: e.target.value })} /></div>
                <Button type="submit" disabled={loading} className="w-full">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer mon compte"}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
