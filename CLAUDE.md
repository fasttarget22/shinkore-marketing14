# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite, localhost:5173)
npm run build      # Production build → dist/
npm run preview    # Preview the production build locally
./deploy.sh "msg"  # Build + git commit + push in one step (Termux/Linux)
```

There are no tests or linting configured.

## Architecture

This is a **single-file React SPA** — almost all application logic lives in `src/App.jsx` (~4700 lines). `src/main.jsx` is just the React root mount. `src/styles.js` exports one large CSS string that is injected via a `<style>` tag inside the app.

### Data layer

All state is kept in a single `data` object that is:
1. Persisted to `localStorage` under the key `shinkore_v2`
2. Synced to **Supabase** on every write — tables are prefixed `sm_` (e.g. `sm_users`, `sm_stalls`, `sm_allocations`, `sm_attendance`, etc.)
3. Pulled from Supabase on startup and every 30 seconds (polling in `App` root)

The `save(data)` helper (line ~86) writes localStorage and fires all Supabase upserts in parallel. `loadFromSB()` fetches all tables at once. `deleteFromSB(table, id)` handles individual deletes.

**Tables not synced to Supabase** (local-only): `activities`, `clients`, `daily_plans`, `activity_photos`, `stock_items`, `remarks`, `targets`, `teams`.

### Auth / roles

Login checks phone + PIN/password against `data.users`. Three roles:
- `admin` — password is the hardcoded `ADMIN_PASSWORD` constant (`"Khalid"`)
- `supervisor` / `ba` — PIN stored on the user object
- `client` — separate `data.clients` array, own PIN field

Session is stored in `localStorage` under `shinkore_session`.

### Component structure

All components are plain functions defined in `App.jsx` and rendered by the root `App` component via a `page` string state (a simple string-based router — no React Router). The root `render()` function is a large switch/if on `page` + `user.role`.

Key page components (all in `App.jsx`):
- `AdminDash` — attendance alerts (polling every 5 min), AI daily briefing via Groq
- `StaffPage` — staff CRUD, bulk import, AI performance review
- `StallsPage` — permission stall management
- `AllocPage` — assigns staff to stalls with duty times; triggers WhatsApp notifications via CallMeBot
- `ClockPage` — GPS-based clock in/out (haversine distance vs 200 m radius)
- `AttendancePage` — admin attendance view
- `CashPage` — handovers, client payments, expenses
- `SalaryPage` / `MySalaryPage` — salary calculation from attendance × daily rate, PDF slip generation
- `ActivityPage` — BA activity reports, supervisor approval workflow
- `ClientDashPage` — client-facing view with Leaflet store map
- `DocumentsPage` / `LettersPage` — document archive; admin sees all, staff see own
- `AskAIPage` — free-form chat with Groq LLM

### External services

| Service | Usage |
|---|---|
| Supabase | Cloud database (URL + anon key hardcoded at top of `App.jsx`) |
| Groq (`llama-3.3-70b-versatile`) | AI briefings, alerts, performance reviews — key from `VITE_GROQ_KEY` env var |
| ImgBB | Photo uploads for activity reports — key hardcoded (`IMGBB_KEY`) |
| CallMeBot | Automated WhatsApp messages (no user interaction needed) — per-user API key |
| `wa.me` deep links | One-tap WhatsApp messages that open the user's WhatsApp |
| Leaflet (CDN) | Store map in client dashboard |

`VITE_GROQ_KEY` must be set in `.env` or Cloudflare Pages environment variables for AI features to work.

### Deployment

The app is deployed to **Cloudflare Pages** at `https://shinkore-marketing14.pages.dev`. `public/_redirects` handles SPA routing. It is also installable as a PWA (`/manifest.json`).
