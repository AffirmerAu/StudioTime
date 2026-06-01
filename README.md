# StudioTime

A time-management / project-tracking app for a creative studio. Two roles:

- **Manager** — full access: dashboard, projects, scheduler, clients.
- **Artist** — sees only their assigned projects, logs time, ticks tasks/sub-tasks.

Built with Vite + React + TypeScript + Tailwind, Supabase (Postgres + Auth + RLS),
React Query, React Router, and Recharts.

---

## 1. Prerequisites

- Node.js 18+ installed (`node -v` to check).
- A Supabase project with `schema.sql` already run in the SQL Editor.
- If you ran `schema.sql` *before* this version, also run `migration_timelogs_select.sql`
  once in the SQL Editor (it widens one read policy so artists can see a project's total hours).

## 2. Configure environment

Copy the example env file and fill in your Supabase details:

```bash
cp .env.example .env
```

Then edit `.env`:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Find both under Supabase → **Project Settings → API** (URL, and the `anon` `public` key).
The anon key is safe to ship in a frontend — Row Level Security is what protects your data.

## 3. Run locally

```bash
npm install
npm run dev
```

Open the printed URL (usually http://localhost:5173).

## 4. Accounts & roles

- Create users in Supabase → **Authentication → Users → Add user** (set a password).
- A `profiles` row is auto-created for each new user with role `artist`.
- To make yourself a manager, run in the SQL Editor:

  ```sql
  update public.profiles
  set role = 'manager'
  where id = (select id from auth.users where email = 'you@example.com');
  ```

- Sign in at the app's login screen with that email + password. Managers get the full
  sidebar; artists get the artist home view.

## 5. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel → **Add New → Project**, import the repo. Framework preset: **Vite**.
3. Under **Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   (same values as your `.env`).
4. Deploy. `vercel.json` already routes all paths to `index.html` so deep links / refresh work.

> Note: Vercel's free **Hobby** tier is for personal / non-commercial use. If this is for a
> business, you'll need a paid plan (~$20/mo). Supabase's free tier pauses a project after a
> week of inactivity and has no automatic backups — fine for testing, worth upgrading for real use.

## Scripts

- `npm run dev` — local dev server
- `npm run build` — type-check + production build into `dist/`
- `npm run preview` — preview the production build
- `npm run typecheck` — type-check only

## Project layout

```
src/
  lib/         types, constants, date helpers, supabase client
  auth/        AuthProvider (session + role)
  data/        React Query hooks (all reads + writes)
  components/  shared UI + TaskBoard
  pages/       Login, Dashboard, Projects, ProjectDetail, ArtistHome, Scheduler, Clients
  App.tsx      providers, routing, role-gated shell
```
