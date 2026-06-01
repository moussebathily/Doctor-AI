## Objectif

Reproduire l'interface des deux maquettes (style AfriDoctor AI / Doctor AI) sur la route `/simulation` et remplacer la silhouette Three.js actuelle par un vrai modèle anatomique 3D réaliste (GLB), tout en gardant le projet **web** (TanStack Start) — pas React Native/Expo, qui n'est pas supporté par Lovable.

Note importante : le projet actuel est web. Les composants seront structurés pour pouvoir être portés plus tard vers React Native, mais l'implémentation reste React/Three.js/WebGL.

## Nouvelle mise en page de `/simulation`

```text
┌────────────────────────────────────────────────────────────────────────┐
│  Header global existant (AppShell)                                     │
├──────────┬─────────────────────────────────────┬───────────────────────┤
│ SIDEBAR  │   OPÉRATION: APPENDICITE      🔴   │  ÉTAPES OPÉRATION    │
│ SYSTÈMES │  ┌───────────────────────────────┐  │  ① Incision      ✓  │
│ Digestif │  │                               │  │  ② Exploration   ✓  │
│ Osseux   │  │     CANVAS 3D — GLB           │  │  ③ Identification ◉ │
│ Muscul.  │  │     (modèle anatomique)       │  │  ④ Section …       │
│ Cardio   │  │                               │  │  …                  │
│ Nerveux  │  │                               │  ├───────────────────────┤
│ Respir.  │  └───────────────────────────────┘  │  OUTILS 3D           │
│ Urinaire │  ┌─── Mini-map VUE 3D ───┐          │  Bistouri  Pince     │
│          │  │ rotate / zoom +/- /   │          │  Ciseaux   Caméra    │
│ VUES     │  │ recadrer / cube       │          │  Aspirateur Écarteur│
│ Complète │  └──────────────────────┘          ├───────────────────────┤
│ Trans.   │                                     │  MONITEUR PATIENT     │
│ Organes  │                                     │  ECG  FC  SpO₂  Temp │
│ Couches  │                                     ├───────────────────────┤
│          │                                     │  VUE LAPAROSCOPIQUE   │
│          │                                     │  (image cyclique)     │
├──────────┴─────────────────────────────────────┴───────────────────────┤
│ Étape N : description           [ IA Assistant ] [ Suivant ]          │
├────────────────────────────────────────────────────────────────────────┤
│ IDÉES INNOVANTES : IA Coach · AR · Urgence · Multijoueur · Rapports   │
└────────────────────────────────────────────────────────────────────────┘
```

Thème : fond `slate-950` → `slate-900`, accents teal/bleu médical, bordures subtiles glassmorphism (`bg-card/60 backdrop-blur`), néons doux via `box-shadow` sur les panneaux actifs. Tous les tokens via `src/styles.css` (semantic tokens existants).

## Modèle 3D réaliste

- Étendre `HumanBody3D.tsx` :
  - Nouvelles props : `system` (`digestive|skeletal|muscular|circulatory|nervous|respiratory|urinary|full`), `viewMode` (`complete|transparent|organs|layers`), `glbUrl` (override), `onPickOrgan(name)`.
  - Le composant `GLBModel` parcourt la scène, regroupe les meshes par système anatomique (heuristique sur les noms : `liver`, `bone_*`, `muscle_*`, `heart`, `vein`, etc.) et applique opacité / visibilité selon `system` + `viewMode`.
  - Raycasting déjà en place : conservé. Le clic sur un mesh émet `onPickOrgan` qui ouvre `OrganInfoPanel`.
  - Contrôles : `OrbitControls` (rotation+zoom), bouton "Recadrer" qui reset camera, bouton "Mode déplacement" qui active `enablePan`.

- Source du GLB :
  - Ajouter un champ texte (dialog "Charger modèle") dans la sidebar pour coller une URL GLB publique.
  - URL par défaut : modèle anatomique libre (sample Khronos `Fox.glb` en fallback si rien — clairement étiqueté "Modèle démo" pour inciter à fournir un vrai modèle anatomique). Le code est prêt à recevoir n'importe quel `.glb` réaliste fourni plus tard via upload (asset Lovable CDN) ou URL.
  - Persistance de l'URL choisie dans `localStorage` (clé `doctorai_glb_url_v1`).

## Nouveaux composants

```text
src/components/simulation/
  SimulationLayout.tsx     — grille 3 colonnes responsive
  SystemSidebar.tsx        — liste systèmes + vues + bouton "Charger modèle"
  OperationHeader.tsx      — barre titre opération + indicateur live
  Viewport3D.tsx           — wrapper Canvas + mini-map + boutons rotate/zoom/recadrer
  StepsPanel.tsx           — étapes opératoires avec checkmarks et étape courante
  ToolsPanel.tsx           — grille 6 outils chirurgicaux + "Changer d'outil"
  LaparoscopicView.tsx     — carrousel d'images endoscopiques (slides existantes)
  InnovativeIdeasBar.tsx   — bandeau bas 5 cartes
  OrganInfoPanel.tsx       — popover explication organe (utilise medical-ai)
  DoctorAIPanel.tsx        — chat IA contextuel à l'étape courante (réutilise medical-ai)
```

Les composants existants `PatientMonitor`, `VoiceCommand`, `PatientGenerator`, `PharmacyCheckout` sont conservés et réintégrés dans la nouvelle disposition.

## Intégration IA / pharmacie / persistance

- `DoctorAIPanel` : appelle `supabase/functions/medical-ai` avec contexte `{ operation, currentStep, pickedOrgan, vitals }` et stream la réponse markdown.
- `OrganInfoPanel` : ouverture au clic sur un organe → fiche (fonction / pathologies courantes / lien pharmacie via `setPharmacyPrefill`).
- La persistance `surgery_progress` (elapsed_seconds, patient, current_step, score) déjà en place reste branchée sur le nouveau layout.

## Détails techniques

- Aucune modification de `src/integrations/supabase/*` ni `src/routeTree.gen.ts` (auto-géré).
- `HumanBody3D` reste exporté avec la même signature publique + nouvelles props optionnelles (rétrocompat).
- Pas de nouvelle migration SQL nécessaire.
- Pas de dépendance npm à ajouter (`three`, `@react-three/fiber`, `@react-three/drei` déjà installés).
- Garde le code AR-ready : `Viewport3D` expose `getSceneRef()` pour brancher plus tard WebXR (`<XR>` de `@react-three/xr`) — non installé maintenant.

## Hors scope (explicitement)

- Pas de portage React Native / Expo (non supporté par Lovable web).
- Pas de fourniture du fichier `human_anatomy.glb` lui-même — l'utilisateur le fournit (URL ou upload).
- Pas de modification du checkout pharmacie existant.

## Fichiers touchés

Créés :
- `src/components/simulation/SimulationLayout.tsx`
- `src/components/simulation/SystemSidebar.tsx`
- `src/components/simulation/OperationHeader.tsx`
- `src/components/simulation/Viewport3D.tsx`
- `src/components/simulation/StepsPanel.tsx`
- `src/components/simulation/ToolsPanel.tsx`
- `src/components/simulation/LaparoscopicView.tsx`
- `src/components/simulation/InnovativeIdeasBar.tsx`
- `src/components/simulation/OrganInfoPanel.tsx`
- `src/components/simulation/DoctorAIPanel.tsx`

Modifiés :
- `src/components/HumanBody3D.tsx` (props `system`, `viewMode`, filtrage meshes)
- `src/routes/simulation.tsx` (refonte complète du JSX, branche les nouveaux panneaux, conserve toute la logique de persistance/régénération existante)
- `src/styles.css` (1-2 tokens glassmorphism + glow néon si nécessaire)
