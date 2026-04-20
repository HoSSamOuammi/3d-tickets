# 3D Impact

Frontend Vite + React for event registration, badge generation, EmailJS delivery, and a local admin dashboard.

## Project structure

```text
.
|-- src/              React + TypeScript source
|-- public/           Static assets exposed directly by Vite
|-- alwaysdata/       PHP + SQLite fallback API for shared hosting
|-- scripts/          Build and deployment scripts
|-- docs/             Additional repository documentation
|-- tmp/              Local temporary files and debug artifacts
|-- .env.example      Environment template
`-- README.md         Main setup guide
```

More detail is available in [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md).

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create your local environment file from the example:

```powershell
Copy-Item .env.example .env
```

3. Fill in your EmailJS values inside `.env`.

4. Start the app:

```bash
npm run dev
```

## Environment variables

The app currently reads these variables at build time:

- `VITE_EMAILJS_SERVICE_ID`
- `VITE_EMAILJS_TEMPLATE_ID`
- `VITE_EMAILJS_COMMITTEE_TEMPLATE_ID`
- `VITE_EMAILJS_COMMITTEE_MEMBER_TEMPLATE_ID`
- `VITE_EMAILJS_PROFESSOR_TEMPLATE_ID`
- `VITE_EMAILJS_PUBLIC_KEY`
- `VITE_PUBLIC_SITE_URL` (optional, recommended for email images when testing locally)
- `VITE_CHECKIN_ADMIN_USERNAME` (optional, local fallback)
- `VITE_LOCAL_CHECKIN_ADMIN_PASSWORD` (optional, local fallback)
- `VITE_CHECKIN_COMMITTEE_EMAIL` (optional, local fallback)
- `VITE_CHECKIN_COMMITTEE_PASSWORD` (optional, local fallback)
- `VITE_LOCAL_ADMIN_ACCESS_HASH` (optional, local fallback)
- `VITE_LOCAL_ADMIN_DELETE_PASSWORD_HASH` (optional, local fallback)

Important:

- `VITE_*` values are bundled into the frontend and can be seen by the browser.
- They should be treated as public client configuration, not as backend secrets.
- If you want truly secure email sending or admin authentication, move that logic to a backend.

## Free deployment on Vercel

This project is ready to deploy on Vercel as a static Vite app.

### Recommended setup

1. Push this folder to GitHub.
2. Import the repository in Vercel.
3. Keep or confirm these settings:
   Build Command: `npm run build`
   Output Directory: `dist`
4. Add the same `VITE_*` environment variables in Vercel Project Settings.
5. Deploy.

### Notes

- `vercel.json` is included for SPA-style fallback routing to `index.html`.
- Preview deployments will work automatically for non-production branches.
- Custom domains can be added later from the Vercel dashboard.

## Put the project on GitHub

If this folder is not already connected to a remote GitHub repository:

```bash
git init
git add .
git commit -m "Initial project structure"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

If the repository already exists locally and you only need to publish the current work:

```bash
git add .
git commit -m "Organize repository structure"
git push
```

Before pushing:

- make sure `.env` is not staged
- review `git status`
- keep `tmp/` and local storage data out of the repository

## Before production

- Verify your EmailJS template uses `{{to_email}}` as the recipient.
- Verify the committee EmailJS template uses `{{to_email}}` as the recipient and supports:
  `{{committee_user_name}}`, `{{committee_login_email}}`, `{{committee_login_password}}`, `{{check_in_url}}`
- If you use a dedicated professor template, verify it uses `{{to_email}}` as the recipient and supports:
  `{{professor_name}}`, `{{professor_email}}`, `{{professor_secondary_email}}`, `{{event_name}}`
- The registration flow no longer uploads participant photos, so your EmailJS template should not include a photo block.
- Test one internal registration and one external registration after deployment.
- Confirm CSV export works from the admin dashboard.
- Do not commit your local `.env` file.

## Shared deployment on alwaysdata

This repository now includes a small PHP + SQLite API for alwaysdata so the admin dashboard can use shared registrations instead of browser-only `localStorage`.

### Build the deployable package

```bash
npm run build:alwaysdata
```

This creates a ready-to-upload `deploy/` folder containing:

- the built frontend
- `api/` PHP endpoints
- `storage/` for the SQLite database

### Upload on alwaysdata

1. Create or edit a `PHP` site on alwaysdata.
2. Upload the full contents of `deploy/` to the site root.
3. Make sure the `storage/` folder is writable by PHP.
4. Open the site and test:
   - one public registration
   - admin login
   - one external confirmation

### Important note

- Shared registrations and the external ticket price now come from the PHP API when `/api/bootstrap.php` is available.
- If the API is not present, the app falls back to the local browser mode for development.
- The check-in route also supports an optional server-side fallback login via `alwaysdata/api/_config.php` if you define `CHECK_IN_LOGIN_EMAIL` and `CHECK_IN_LOGIN_PASSWORD_HASH`.
- Email sending still uses EmailJS from the frontend, so your EmailJS template and service must still be configured correctly.
