# 3D Impact

Frontend Vite + React for event registration, badge generation, EmailJS delivery, and a local admin dashboard.

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
- `VITE_EMAILJS_PUBLIC_KEY`

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

## Before production

- Verify your EmailJS template uses `{{to_email}}` as the recipient.
- Test one internal registration and one external registration after deployment.
- Confirm CSV export works from the admin dashboard.
- Do not commit your local `.env` file.
