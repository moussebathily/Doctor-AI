# 🚢 Déploiement

## Option 1 — Lovable (recommandé)

1. Ouvrez le projet dans [Lovable](https://lovable.dev)
2. Cliquez sur **Publish** en haut à droite
3. Votre app est en ligne sur `your-project.lovable.app`

Lovable Cloud gère automatiquement :
- Hébergement Cloudflare Workers (SSR + edge)
- Base Postgres Supabase
- Edge Functions Deno
- Secrets (LOVABLE_API_KEY déjà provisionné)

## Option 2 — Self-hosted

### Prérequis
- Compte [Supabase](https://supabase.com) (gratuit)
- Hébergeur supportant SSR Workers / Node : Cloudflare Workers, Vercel, Netlify

### Étapes

```bash
# 1. Créer un projet Supabase, récupérer l'URL et la clé anon
# 2. Lancer les migrations
supabase link --project-ref YOUR_REF
supabase db push

# 3. Déployer l'edge function
supabase functions deploy medical-ai --no-verify-jwt

# 4. Configurer les secrets de l'edge function
supabase secrets set LOVABLE_API_KEY=sk-...

# 5. Build front
bun run build

# 6. Déployer sur Cloudflare Workers
bunx wrangler deploy
```

### Variables d'environnement de production

Dans votre hébergeur, configurez :
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Option 3 — Docker / VPS

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build
EXPOSE 3000
CMD ["bun", "run", "start"]
```

## Variables Supabase à configurer

| Secret | Où | Pourquoi |
|---|---|---|
| `LOVABLE_API_KEY` | Supabase Edge Function secrets | Accès AI Gateway |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-provisionné | Admin queries server-side |

## Vérification post-déploiement

- [ ] Page d'accueil charge
- [ ] Inscription / connexion fonctionnent
- [ ] Chat Doctor AI répond
- [ ] Création d'un rappel persiste après refresh
- [ ] Simulation Lab retourne JSON valide
