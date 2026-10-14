# Guide de configuration — Emploi du temps enseignant

## 1. Configuration de Supabase

### 1.1 Variables d'environnement

Copiez le fichier `.env.example` en `.env` et renseignez vos clés Supabase :

```
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-clé-anon
SUPABASE_SERVICE_ROLE_KEY=votre-clé-service-role
```

Vous trouverez ces clés dans : **Supabase Dashboard → Settings → API**

- `NEXT_PUBLIC_SUPABASE_URL` : Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` : anon public key
- `SUPABASE_SERVICE_ROLE_KEY` : service_role key (secrète, côté serveur uniquement)

### 1.2 Base de données

Les tables et la fonction RPC sont déjà créées via migration. Si vous recréez le projet,
la migration s'applique automatiquement.

## 2. Créer le compte administrateur

La connexion administrateur utilise Supabase Auth (email + mot de passe).

### Option A : Via le tableau de bord Supabase

1. Allez dans **Supabase Dashboard → Authentication → Users**
2. Cliquez sur **"Add user"**
3. Saisissez l'email et le mot de passe de l'administrateur
4. Décochez **"Auto Confirm User"** si vous voulez confirmer manuellement (recommandé)
5. Cliquez sur **"Create user"**

### Option B : Via SQL (création directe)

Dans **Supabase Dashboard → SQL Editor**, exécutez :

```sql
-- Remplacez par votre email et mot de passe
-- Le mot de passe doit faire au moins 6 caractères
SELECT auth.admin_create_user(
  'admin@votre-domaine.fr',
  'votre-mot-de-passe',
  '{}'::jsonb,
  true  -- auto_confirm = true
);
```

## 3. Accès à l'application

### Page enseignant (publique)
- URL : `/`
- Accessible sans connexion
- Les enseignants remplissent le formulaire et l'envoient

### Page administrateur (sécurisée)
- URL : `/admin`
- Connexion avec l'email et le mot de passe définis ci-dessus
- Aucun lien visible sur la page d'accueil vers l'espace admin

## 4. Sécurité

- Les réponses des enseignants ne sont **pas consultables publiquement** (RLS)
- Seul l'administrateur connecté peut consulter les données
- La clé `service_role` reste côté serveur, jamais exposée au navigateur
- Les soumissions passent par une route API Next.js avec validation serveur
- L'insertion est atomique (fonction RPC `submit_teacher_schedule`)

## 5. Lancer l'application en local

```bash
npm install
npm run dev
```

L'application sera disponible sur `http://localhost:3000`

## 6. Déploiement

L'application est configurée pour Netlify. Pour déployer :

1. Poussez le code sur votre dépôt Git
2. Connectez le dépôt à Netlify
3. Dans les variables d'environnement Netlify, ajoutez :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Déployez
