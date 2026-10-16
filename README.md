# Recall

Markdown notes that quiz you the next day. Installable Chrome PWA, synced via Supabase, questions written by Claude.

## Setup (about 10 minutes)

1. **Supabase**: create a free project at supabase.com. Open *SQL Editor*, paste `schema.sql`, run it.
   In *Authentication → Providers → Email*, turn off "Confirm email" if you don't want to confirm by mail.
   In *Project Settings → API*, copy the **Project URL** and the **anon public** key.
2. **Host it**: this repo is ready for GitHub Pages — *Settings → Pages → Build and deployment → Deploy from a branch → `main` / root*. Your app is then at `https://<user>.github.io/<repo>/`. (Or drag the folder onto app.netlify.com/drop.)
3. **Open the URL in Chrome**, go to *Settings* in the app, paste the Supabase URL + anon key, press *Save connection*, then *Sign in / create account*.
4. Still in *Settings*, paste a Claude API key (console.anthropic.com) and save. Do this on each device; the key is never synced.
5. Install: Chrome menu → *Install Recall* (or the button in Settings).

## How it works

- **Add notes**: write in the editor, or use the import button next to *New note* (.md/.txt files, pasted text, or drag files onto the window). Uploads generate questions immediately. For notes you write by hand, press *Add to review* when you're done.
- **Questions**: Claude reads the whole note and decides what is worth retaining. It skips trivia and can return nothing. Mix of multiple choice and free recall (graded by Claude, with candid feedback).
- **Next day**: new questions become due the day after you add them. The Review tab shows today's set, capped by your daily limit (Settings).
- **Teaching it what you want**: during review tap *Too trivial* (mutes the card and is used as a "don't ask this kind" example next time), *Too easy*, or *Key idea*. Settings also has a free-text box for telling the model what you care about, and a density setting.
- **Scheduling**: simple SM-2 style. Pass → 3 days → 7 days → growing by ease. Miss → back to 1 day, and asked again at the end of the same session.
- **Study ahead** lets you pull future cards forward (useful for trying it out on day 1).

## Design

Apple-style UI: SF Pro on Apple devices (Inter, bundled, everywhere else), system blue, grouped lists, sheets, and a bottom tab bar on phones. Follows your system's light/dark setting, or pick one in Settings → Appearance. The editor styles Markdown as you type (markers fade, bold and headings show bold); switch to Read for the fully rendered note. Cmd/Ctrl+K jumps to search.

## Notes and limits

- Data lives in the browser's localStorage and syncs to Supabase (last write wins per note/card). About 5 MB of local storage is plenty for text notes.
- The Claude API key sits in this browser and calls go straight to Anthropic. Use a dedicated key with a spend limit.
- Wikilinks `[[Note title]]` work in preview and create the note if it doesn't exist. Backlinks appear under each note. No graph view.
- Don't open the app from `file://`; the service worker and install need https (or localhost).
