# Forgmind Workspace

Personal task board + diary with AI summary/grammar features. Rebuilt in React + TypeScript + Tailwind + Vite + Supabase.

## Stack

- **Vite** + **React 18** + **TypeScript** — SPA with fast HMR
- **Tailwind CSS** — utility-first styling, dark/red theme
- **React Router 6** — client-side routing with protected routes
- **Supabase** — auth (email/password) + Postgres (tasks, diary)
- **Google Gemini** — free AI for diary summaries and grammar fixes (BYOK)

## First-time setup

```bash
cd web
npm install
```

## Development

```bash
npm run dev
```

Open http://localhost:5173

## Production build

```bash
npm run build
```

Output goes to `web/dist/`. Deploy that folder to Netlify/Vercel/any static host.

## Features

- Login / register with Supabase Auth
- Three-column task board (Work Start → In Progress → Completed) with native HTML5 drag-and-drop
- Diary with auto-logged task activity (add / move / complete / edit / delete events)
- Diary filters: source (manual / task), date range, text search
- AI "Summarize" and "Fix Grammar" on diary entries via Google Gemini (BYOK, stored in localStorage)
- Dark theme with red accents, responsive down to mobile

## Project structure

```
web/
├── src/
│   ├── components/        # Layout, Modal (shared UI)
│   ├── contexts/          # AuthContext (session state)
│   ├── lib/               # supabase client, ai helpers, types
│   ├── routes/            # Login, Board, Diary (page components)
│   ├── App.tsx            # router + auth guard
│   ├── main.tsx           # app entry
│   └── index.css          # tailwind + custom component classes
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## Supabase schema

The app expects these tables in the Supabase project configured in `src/lib/supabase.ts`:

- `tasks` (id, user_id, text, priority, column_name, created_at)
- `diary_entries` (id, user_id, title, content, entry_date, source, created_at, updated_at)

Both use row-level security scoped to `auth.uid() = user_id`. See the root-level project notes for the SQL.

## Deployment to Netlify

1. Connect this repo to Netlify
2. Base directory: `web`
3. Build command: `npm run build`
4. Publish directory: `web/dist`
5. Add a `_redirects` file (SPA fallback) by placing `/*  /index.html  200` in `web/public/_redirects` (create the folder if needed) — this makes direct URLs like `/diary` work after refresh.
