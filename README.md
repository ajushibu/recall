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
app/api/rewrite/route.js   POST /api/rewrite: a question you keep missing → clearer replacements (owner only)
app/api/connect/route.js   POST /api/connect: questions that compare ideas across notes in a folder (owner only)
app/api/config/route.js    served as /config.js: hands the browser the public Supabase URL and key
lib/server.js              who is calling, and the call to Claude
public/index.html          markup
public/styles.css          styles (tokens at the top; dark mode redefines them)
public/app.js              all app logic, split into commented sections
public/sw.js               offline cache (bump CACHE to force-refresh every device)
supabase/schema.sql        tables, row-level security
```

## Setup

1. **Supabase** (margin's project): SQL Editor → New query → paste `supabase/schema.sql` → Run. (Safe to run again after updates.)
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

## Library (folders)
Same as margin's Library:
- Folders inside folders to any depth, with notes inside. Tap a folder to open or close it; tap a note to open it.
- Each row's **⋯** button (or right-click) has the actions: for folders *New note here, New folder here, Rename, Move to…, Delete folder*; for notes *Open, Move to…, Delete note*.
- The buttons under the tree are New note, New folder, Import, Sort (name or recent) and Collapse all. New notes, folders and imports go into the folder you last tapped; tap empty space to go back to the top level.
- Drag rows to move them on a laptop or iPad. On phones use **Move to…**. A folder can't go inside itself.
- Deleting a folder never deletes notes: its contents move up one level.
- The folder chip at the top of a note (next to the date on phones) shows where it lives; tap it to move the note.
- On a laptop the panel can be hidden with the button next to "Library".
- Folders are stored in `user_settings.folders` and each note's `folder_id` (the last two lines of `supabase/schema.sql`). Until those lines have been run, folders work on the device and sync once they exist.

## How reviews work
- New questions are due the day after you add a note to review. The Review tab shows today's set, capped by "Questions per day" in Settings.
- **Study now**: once a note has questions, a *Study now* button appears on it. That first pass counts. A miss marks the question shaky (importance up, asked first tomorrow, and again at the end of the session). A pass keeps it due tomorrow, because remembering something minutes after reading it proves little. *Too trivial* removes a question for good, even before you answer it. First passes don't use up the daily cap.
- Claude reads the whole note and keeps only what matters; it can return nothing. Multiple choice and free recall, with free recall graded by Claude.
- During review, **Too trivial** mutes a question and steers future ones away from that kind; **Key idea** does the opposite. Settings has a box for telling it what you care about.
- **Half-right answers**: when you type an answer, Claude lists the parts you left out as short cues (it never gives the content away). A half-right answer is not a pass: the card comes back tomorrow however far out it had got, shows *Last time you left out…* as a cue, and the grader only counts it correct once those parts are in your answer. After that it takes a short 2-day step before growing again. Needs the `cards.gaps` line at the end of `supabase/schema.sql`; until it is run, the cues live on this device only.
- **Stubborn questions**: a question missed three or more times is listed on the Review screen and at the end of a session. *Rewrite* has Claude work out why it keeps failing (several parts in one answer, ambiguity, a bare fact, or an unclear note) and replace it with 1–3 narrower questions with a memory hook; they come back tomorrow. *Keep* resets the count.
- **Connect your notes**: when a folder has two or more notes you've already reviewed, the Review screen offers a few questions that compare ideas across them (at most once a week per folder, on this device). It's a button, not automatic, so nothing is generated or billed unless you tap it. These questions are due today.
- Scheduling: pass → 3 days → 7 days → growing. Miss → back to 1 day, and asked again at the end of the session.
