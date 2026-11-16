# Coast to Crusi

Carlo & Kayla · 1 May 2027 · Butterfly Blu, Brenton-on-Sea

## How it fits together

```
Guest fills in RSVP  →  /api/rsvp (Vercel)  →  Google Apps Script  →  Google Sheet
```

- `dist/` – the website (unchanged design; the RSVP form now really sends)
- `api/rsvp.js` – checks each RSVP and forwards it to your Sheet. The guest
  only sees "received" once the Sheet has confirmed the row was saved.
- `google-apps-script/Code.gs` – lives inside your Google Sheet and writes rows
- `vercel.json` – tells Vercel to serve `dist/` with no build step

Each RSVP becomes one row: date, guest name, attending, starter, main, dessert,
dietary/allergies, song request, and a "possible duplicate" flag if the same
name RSVPs twice. A **Summary** tab counts yes/no and every dish (only for
guests who are attending) — that's what you send the caterer.

---

## Step 1 · Google Sheet (≈5 min)

1. Go to sheets.new and name the sheet **Coast to Crusi · RSVPs**.
2. **Extensions → Apps Script**. Delete what's there, paste the whole of
   `google-apps-script/Code.gs`, and click 💾 Save.
3. In the function dropdown at the top pick **setup** and click **▶ Run**.
   Google will ask for permission → choose your account → *Advanced* →
   *Go to project (unsafe)* → *Allow*. (It says "unsafe" only because it's
   your own unverified script.) The RSVPs and Summary tabs appear.
4. **Deploy → New deployment** → gear icon → **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   Click **Deploy** and copy the **Web app URL** (ends in `/exec`).

If you ever edit Code.gs later: Deploy → Manage deployments → ✏️ → Version:
*New version* → Deploy (keeps the same URL).

## Step 2 · Vercel

Vercel needs the files either from GitHub or from its command-line tool.

**Option A – GitHub (all in the browser)**
1. Create a new **private** repository on github.com.
2. "uploading an existing file" → drag in everything inside this folder
   (`api`, `dist`, `google-apps-script`, `vercel.json`, `README.md`) → Commit.
3. vercel.com → Add New → Project → import that repo. Framework preset:
   **Other**. Leave build settings as they are (vercel.json handles it).
4. Before clicking Deploy, open **Environment Variables** and add:
   - `RSVP_SCRIPT_URL` = the `/exec` URL from Step 1
   - `RSVP_SECRET` = the same value as SECRET in the live Apps Script (kept out of this repo)
5. Deploy.

**Option B – command line (no GitHub)** from inside this folder:
```
npx vercel login
npx vercel link
npx vercel env add RSVP_SCRIPT_URL production
npx vercel env add RSVP_SECRET production
npx vercel --prod
```

If you add or change environment variables after deploying, redeploy
(Deployments → ⋯ → Redeploy) so they take effect.

## Step 3 · Test before sending invitations

On the live site send one **accept** and one **decline**. Both should show
up in the Sheet within a few seconds. Delete the test rows, then share the link.

Optional: Vercel → Project → Settings → Domains to add a custom domain
(e.g. coasttocrusi.co.za) instead of the free `.vercel.app` address.
