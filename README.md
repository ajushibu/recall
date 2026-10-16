# Recall

Markdown notes that quiz you the next day. Write or import notes; Claude picks the few ideas worth keeping and turns them into questions; tomorrow they come back as a short review. Installable on phone and laptop, works offline, syncs between devices.

## Stack
- **Next.js 15 on Vercel**, used only for three API routes. The app itself is a plain page in `public/` (no React, no build step for the UI). Same setup as margin.
- **Supabase**: Postgres plus Auth. Shares margin's project and login; Recall's tables (`notes`, `cards`, `user_settings`) don't touch margin's `items`.
- **Claude**: called from `app/api/generate` and `app/api/grade`. The key stays on the server and only `ALLOWED_EMAIL` can use it.
- **Offline**: a service worker caches the app; notes live in local storage and sync when you're back online.

## Project layout
```
app/api/generate/route.js  POST /api/generate: note → review questions (owner only)
app/api/grade/route.js     POST /api/grade: typed answer → verdict + feedback (owner only)
app/api/config/route.js    served as /config.js: hands the browser the public Supabase URL and key
lib/server.js              who is calling, and the call to Claude
public/index.html          markup
public/styles.css          styles (tokens at the top; dark mode redefines them)
public/app.js              all app logic, split into commented sections
public/sw.js               offline cache (bump CACHE to force-refresh every device)
supabase/schema.sql        tables, row-level security
```

## Setup

1. **Supabase** (margin's project): SQL Editor → New query → paste `supabase/schema.sql` → Run.
2. **Local**
   ```bash
   npm install
   cp .env.local.example .env.local   # same four values as margin's .env.local
   npm run dev                        # http://localhost:3000
   ```
3. **Deploy**: Vercel → Add New → Project → import `recall` (framework: Next.js, nothing to change). Add the env vars below, then deploy.
4. **Install**: open the Vercel URL in Chrome → install icon in the address bar (phone: Add to Home Screen). Sign in with your margin account.

## Working on it
- Edit files in `public/`, refresh `localhost:3000`. No build step for the UI.
- Ship it:
  ```bash
  git add -A && git commit -m "what changed" && git push
  ```
  Vercel deploys every push to `main` automatically, usually in under a minute.
- `npm run build` before pushing if you've touched anything in `app/` or `lib/`.
- If a device seems stuck on an old version, bump `CACHE` in `public/sw.js`.

## Environment variables
| Name | What |
|---|---|
| `SUPABASE_URL` | Project URL (same as margin) |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable (or legacy anon) key. Safe to expose; RLS does the locking. |
| `ANTHROPIC_API_KEY` | Claude API key. Server only. |
| `ALLOWED_EMAIL` | The only account allowed to generate and grade questions. |
| `CLAUDE_MODEL` | Optional. Writes questions. Defaults to `claude-sonnet-5-5`. |
| `CLAUDE_GRADE_MODEL` | Optional. Grades typed answers. Defaults to `claude-haiku-5-5`. |
| `CLAUDE_EFFORT` | Optional. `low` (default), `medium`, `high` or `off`. |

## How reviews work
- New questions are due the day after you add a note to review. The Review tab shows today's set, capped by "Questions per day" in Settings.
- Claude reads the whole note and keeps only what matters; it can return nothing. Multiple choice and free recall, with free recall graded by Claude.
- During review, **Too trivial** mutes a question and steers future ones away from that kind; **Key idea** does the opposite. Settings has a box for telling it what you care about.
- Scheduling: pass → 3 days → 7 days → growing. Miss → back to 1 day, and asked again at the end of the session.
