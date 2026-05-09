# Habit Tracker

A Progressive Web App for tracking daily, weekly, and monthly habits with streaks, dashboards, and push notifications. Installable on Android via Chrome.

**Stack:** React + Vite · Tailwind CSS · Supabase (auth + DB) · Vercel (hosting + cron) · Web Push

---

## Local development

### 1. Clone and install

```bash
git clone <repo-url>
cd habit-tracker
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. In **SQL Editor**, run the migration:
   ```
   supabase/migrations/001_initial.sql
   ```
3. In **Authentication → URL Configuration**, add your local URL as a redirect:
   ```
   http://localhost:5173
   ```
4. Copy your project URL and anon key from **Settings → API**.

### 3. Generate VAPID keys

Web Push requires a VAPID key pair. Generate one:

```bash
npx web-push generate-vapid-keys
```

This prints a public key and private key. Copy both.

### 4. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in all values:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_VAPID_PUBLIC_KEY=BxxxxPublicKey...
VAPID_PRIVATE_KEY=PrivateKey...
VAPID_SUBJECT=mailto:you@example.com
SUPABASE_SERVICE_ROLE_KEY=eyJ...ServiceRole...
CRON_SECRET=any-random-string-you-choose
```

### 5. Generate PNG icons (optional but recommended for Android install)

```bash
npm install -D sharp
node scripts/generate-icons.mjs
```

Or use the zero-dependency placeholder generator:

```bash
node scripts/make-placeholder-icons.mjs
```

### 6. Run the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Sign in with your email — you'll receive a magic link.

---

## Vercel deployment

### 1. Push to GitHub

```bash
git init && git add . && git commit -m "init"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Import in Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo.
2. Framework preset: **Vite**.
3. Add all environment variables from `.env` in **Settings → Environment Variables**.
   - Mark `VAPID_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET` as **Production only** (not exposed to browser).

### 3. Add your Vercel URL to Supabase

In Supabase → **Authentication → URL Configuration**, add your Vercel URL as a redirect:
```
https://your-app.vercel.app
```

### 4. Deploy

```bash
vercel --prod
```

The app is live at `https://your-app.vercel.app`.

---

## Push notifications — Supabase Edge Function

Push notifications are handled by a Supabase Edge Function scheduled via `pg_cron`.
The function checks each user's configured notification time and timezone every hour
and sends a Web Push notification only when they have incomplete habits.

### 1. Deploy the Edge Function

Install the Supabase CLI if you haven't already:

```bash
npm install -g supabase
```

Log in and link your project:

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

Set the required secrets:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set VAPID_PUBLIC_KEY=your-vapid-public-key
supabase secrets set VAPID_PRIVATE_KEY=your-vapid-private-key
supabase secrets set VAPID_SUBJECT=mailto:you@example.com
supabase secrets set CRON_SECRET=your-cron-secret
```

Deploy the function:

```bash
supabase functions deploy send-notifications --no-verify-jwt
```

> `--no-verify-jwt` lets pg_net call the function without a Supabase JWT. The
> `CRON_SECRET` header check inside the function secures it instead.

### 2. Enable pg_cron and pg_net

In the Supabase dashboard → **Database → Extensions**, enable:
- **pg_cron** — runs scheduled SQL jobs
- **pg_net** — lets SQL make HTTP requests

### 3. Set the app settings Supabase needs for the cron call

In **Database → Settings** (or via SQL Editor):

```sql
alter database postgres set "app.settings.project_ref" = '<your-project-ref>';
alter database postgres set "app.settings.cron_secret" = 'your-cron-secret';
```

### 4. Schedule the cron job

Run `supabase/migrations/002_pg_cron.sql` in the SQL Editor. This schedules
the Edge Function to run every hour. The function respects each user's configured
notification time and timezone, so running hourly ensures everyone is notified
at the right local time.

### 5. Test manually

```bash
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/send-notifications \
  -H "Authorization: Bearer your-cron-secret"
```

### Required Edge Function secrets

| Secret | Where to get it |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |
| `VAPID_PUBLIC_KEY` | Output of `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Output of `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | `mailto:you@example.com` |
| `CRON_SECRET` | Any random secret (must match `app.settings.cron_secret`) |

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected automatically by the Supabase runtime.

---

## PWA / Android install

The app is installable on Android via Chrome:

1. Open the app in Chrome on Android.
2. Tap the **⋮** menu → **Add to Home screen**.
3. Or wait for Chrome's automatic install banner.

Requirements met:
- Valid `manifest.webmanifest` with 192px and 512px icons.
- Service worker registered via `vite-plugin-pwa`.
- HTTPS (Vercel provides this automatically).

---

## Project structure

```
├── api/
│   └── send-notifications.js   # Returns 410 — replaced by Edge Function
├── public/icons/                # PWA icons (PNG + SVG)
├── scripts/
│   ├── generate-icons.mjs       # PNG generation (requires sharp)
│   └── make-placeholder-icons.mjs
├── supabase/
│   ├── functions/
│   │   └── send-notifications/
│   │       └── index.ts         # Edge Function (Web Push + VAPID, no npm deps)
│   └── migrations/
│       ├── 001_initial.sql      # Schema + RLS
│       └── 002_pg_cron.sql      # pg_cron schedule for Edge Function
├── src/
│   ├── components/
│   │   ├── BottomNav.jsx
│   │   ├── HabitForm.jsx
│   │   ├── Heatmap.jsx
│   │   ├── BarChart.jsx
│   │   ├── MissDialog.jsx
│   │   └── SettingsModal.jsx
│   ├── contexts/AuthContext.jsx
│   ├── lib/
│   │   ├── supabase.js
│   │   ├── push.js
│   │   └── streaks.js
│   ├── screens/
│   │   ├── Login.jsx
│   │   ├── Today.jsx
│   │   ├── Habits.jsx
│   │   └── Dashboard.jsx
│   ├── App.jsx
│   ├── main.jsx
│   ├── index.css
│   └── sw.js                    # Service worker (Workbox + push handler)
├── supabase/migrations/001_initial.sql
├── .env.example
├── vercel.json
├── vite.config.js
└── package.json
```

---

## Supabase schema summary

| Table | Purpose |
|---|---|
| `profiles` | Per-user notification time, timezone, enabled flag |
| `habits` | Habit definitions (name, frequency, window type, day) |
| `habit_logs` | One row per habit per date — completed bool + missed reason |
| `push_subscriptions` | Web Push endpoint + keys per device |

All tables have Row Level Security — users can only read/write their own rows.
