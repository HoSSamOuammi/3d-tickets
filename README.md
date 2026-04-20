# 3D Impact

Application Vite + React pour les inscriptions, la génération de badges, l'envoi EmailJS et l'administration locale dans le navigateur.

## Structure

```text
.
|-- src/            Code React + TypeScript
|-- public/         Assets statiques servis par Vite
|-- docs/           Documentation du projet
|-- tmp/            Fichiers temporaires locaux
|-- .env.example    Modèle d'environnement local
`-- README.md       Guide principal
```

Plus de détail dans [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md).

## Lancement local

1. Installer les dépendances :

```bash
npm install
```

2. Créer le fichier d'environnement local :

```powershell
Copy-Item .env.example .env
```

3. Compléter `.env` avec vos valeurs EmailJS et, si besoin, vos accès admin/check-in locaux.

4. Démarrer l'application :

```bash
npm run dev
```

## Variables d'environnement

Variables utilisées par l'application :

- `VITE_EMAILJS_SERVICE_ID`
- `VITE_EMAILJS_TEMPLATE_ID`
- `VITE_EMAILJS_COMMITTEE_TEMPLATE_ID`
- `VITE_EMAILJS_COMMITTEE_MEMBER_TEMPLATE_ID`
- `VITE_EMAILJS_PROFESSOR_TEMPLATE_ID`
- `VITE_EMAILJS_PUBLIC_KEY`
- `VITE_PUBLIC_SITE_URL`
- `VITE_CHECKIN_ADMIN_USERNAME`
- `VITE_LOCAL_CHECKIN_ADMIN_PASSWORD`
- `VITE_ADMIN_PASSWORD`
- `VITE_CHECKIN_COMMITTEE_EMAIL`
- `VITE_CHECKIN_COMMITTEE_PASSWORD`
- `VITE_LOCAL_ADMIN_ACCESS_HASH`
- `VITE_LOCAL_ADMIN_DELETE_PASSWORD_HASH`

À garder en tête :

- `.env` est ignoré par Git et doit rester local.
- Les variables `VITE_*` sont intégrées au build frontend et ne doivent pas être traitées comme des secrets serveur.
- Les données de l'application sont stockées localement dans le navigateur.

## Vérifications utiles

- Vérifier que les templates EmailJS utilisent bien `{{to_email}}`.
- Tester au moins une inscription interne, une inscription externe et un envoi de badge.
- Vérifier les opérations admin importantes : suppression, présence, import CSV et envoi d'emails.
- Contrôler `git status` avant chaque push pour confirmer que `.env` n'est pas suivi.
