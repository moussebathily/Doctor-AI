# 🩺 Doctor AI + Virtual Lab

> Plateforme IA santé tout-en-un : assistant médical, laboratoire virtuel, recherche scientifique et rappels médicaments.
> Conçue pour l'Afrique et le monde 🌍

[![Made with Lovable](https://img.shields.io/badge/Made%20with-Lovable-ff69b4)](https://lovable.dev)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TanStack Start](https://img.shields.io/badge/TanStack-Start-blue)](https://tanstack.com/start)
[![Supabase](https://img.shields.io/badge/Powered%20by-Supabase-3FCF8E)](https://supabase.com)

---

## ✨ Fonctionnalités

| Module | Description |
|---|---|
| 🧑‍⚕️ **AI Doctor** | Chat médical IA en français, analyse de symptômes, orientation. Capable de **créer vos rappels** ou **lancer une analyse virtuelle** directement depuis la conversation. |
| 🧪 **Virtual Lab** | Simulation pédagogique d'analyses (sang, urine, rein, cœur) + génération de cas cliniques pour patients virtuels. |
| 📚 **Recherche médicale** | Synthèses scientifiques pédagogiques générées par IA (sources type PubMed/OMS). |
| 🔔 **Rappels santé** | Médicaments, rendez-vous, analyses — avec adhérence et historique. |
| 🔐 **Auth & sécurité** | Comptes utilisateurs, RLS Supabase, données chiffrées au repos. |

## 🛠 Stack technique

- **Frontend** : React 19 + TanStack Start + Tailwind v4 + shadcn/ui
- **Backend** : Supabase (Postgres + Auth + RLS) + Edge Functions Deno
- **IA** : Lovable AI Gateway (Gemini 2.5 / 3 Flash, GPT-5)
- **Déploiement** : Cloudflare Workers via Lovable

## 🚀 Démarrage rapide

```bash
# 1. Cloner
git clone https://github.com/<votre-user>/doctor-ai-virtual-lab.git
cd doctor-ai-virtual-lab

# 2. Installer
bun install   # ou npm install / pnpm install

# 3. Configurer l'environnement
cp .env.example .env
# Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY

# 4. Lancer
bun run dev
```

Ouvrez http://localhost:5173

## 🔑 Variables d'environnement

Voir [`.env.example`](.env.example).

| Variable | Visibilité | Utilité |
|---|---|---|
| `VITE_SUPABASE_URL` | client | URL projet Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client | Clé publique anon |
| `LOVABLE_API_KEY` | edge function | Accès AI Gateway (configuré dans Supabase secrets) |

## 📦 Structure

```
src/
  routes/           # Pages (TanStack file-based routing)
    index.tsx       # Landing + dashboard
    doctor.tsx      # Chat IA avec tool-calling
    lab.tsx         # Simulations
    research.tsx    # Synthèses scientifiques
    reminders.tsx   # CRUD rappels
    auth.tsx        # Login / Signup
  components/
    AppShell.tsx    # Sidebar + nav
    MedicalDisclaimer.tsx
  integrations/supabase/   # Clients (auto-générés, ne pas éditer)
supabase/
  functions/medical-ai/    # Edge function unifiée (modes: doctor, lab, research, patient)
  migrations/              # Schéma SQL versionné
```

## 🤖 Tool-calling : comment ça marche

L'AI Doctor peut **agir** dans l'app, pas seulement répondre :

> Utilisateur : "Rappelle-moi de prendre mon Doliprane à 20h"
> Doctor AI : *appelle `create_reminder({type:"medicament", title:"Doliprane", time:"20:00"})`* → ajoute le rappel → confirme.

> Utilisateur : "Simule une NFS pour une femme de 35 ans fatiguée"
> Doctor AI : *appelle `run_lab_simulation(...)`* → présente les valeurs.

Voir [`src/lib/medical-tools.ts`](src/lib/medical-tools.ts).

## 🚢 Déploiement

Voir [DEPLOYMENT.md](DEPLOYMENT.md).

## ⚠️ Avertissement médical

**Cette application ne remplace en aucun cas l'avis d'un professionnel de santé.**
Les informations fournies sont à but pédagogique et informatif uniquement. En cas d'urgence, contactez immédiatement les services médicaux.

## 📄 Licence

MIT — voir [LICENSE](LICENSE).

## 🙌 Crédits

Construit avec [Lovable](https://lovable.dev) ❤️
