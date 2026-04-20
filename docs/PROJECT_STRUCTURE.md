# Project Structure

This repository is organized to keep the frontend, deployment assets, backend fallback API, and temporary local artifacts clearly separated.

## Main layout

```text
.
|-- src/                 React + TypeScript application source
|   |-- components/      UI views and feature components
|   |-- lib/             Shared helpers and business utilities
|   |-- security/        Local security and guard helpers
|   |-- assets/          Bundled assets imported by the app
|   `-- main.tsx         Application entrypoint
|-- public/              Static files served as-is
|   |-- docs/            Public PDF documents
|   |-- logo/            Public logo exports used by the app and emails
|   `-- programme/       Event programme images
|-- alwaysdata/          PHP + SQLite fallback API for shared hosting
|   |-- api/             PHP endpoints
|   `-- storage/         Runtime SQLite storage (kept out of Git)
|-- scripts/            Build and deployment helper scripts
|-- docs/               Project documentation
|-- tmp/                Local debug files and temporary previews
|-- README.md           Main setup and deployment guide
`-- .env.example        Safe environment template
```

## Organization rules

- Keep runtime code inside `src/`.
- Keep browser-public static files inside `public/`.
- Keep hosting-specific backend files inside `alwaysdata/`.
- Keep one-off debug exports, previews, logs, and experiments inside `tmp/`.
- Never commit `.env`, temporary preview files, or generated SQLite data.

## Recommended workflow

1. Add new frontend logic in `src/components`, `src/lib`, or `src/security`.
2. Add public assets only if they must be directly reachable by URL.
3. Put deployment helpers in `scripts/`.
4. Put project documentation updates in `docs/` or `README.md`.
