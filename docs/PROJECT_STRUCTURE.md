# Project Structure

This repository now contains only the frontend application and its local project files.

## Main layout

```text
.
|-- src/                 React + TypeScript application source
|   |-- components/      UI views and feature components
|   |-- lib/             Shared helpers and business utilities
|   |-- security/        Local guard and validation helpers
|   |-- assets/          Bundled assets imported by the app
|   `-- main.tsx         Application entrypoint
|-- public/              Static files served as-is
|   |-- docs/            Public PDF documents
|   |-- logo/            Public logo exports used by the app and emails
|   `-- programme/       Event programme images
|-- docs/                Project documentation
|-- tmp/                 Local debug files and temporary previews
|-- README.md            Main setup guide
`-- .env.example         Safe environment template
```

## Organization rules

- Keep runtime code inside `src/`.
- Keep browser-public static files inside `public/`.
- Keep one-off debug exports, previews, logs, and experiments inside `tmp/`.
- Never commit `.env` or temporary preview files.

## Recommended workflow

1. Add frontend logic in `src/components`, `src/lib`, or `src/security`.
2. Add public assets only if they must be directly reachable by URL.
3. Put project documentation updates in `docs/` or `README.md`.
