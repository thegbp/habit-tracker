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

## Push notification cron job

`vercel.json` configures a cron that calls `/api/send-notifications` every hour:

```json
{
  "crons": [{ "path": "/api/send-notifications", "schedule": "0 * * * *" }]
}
```

The endpoint:
- Reads all user profiles with notifications enabled.
- Converts each user's configured notification time from their stored timezone to local hour.
- If the current hour matches and the user has incomplete habits, sends a Web Push notification.
- Marks `last_notification_sent` so the user isn't notified twice in one day.
- Cleans up expired push subscriptions (HTTP 410).

**The cron secret:** Vercel automatically adds `Authorization: Bearer <CRON_SECRET>` to cron requests. Set `CRON_SECRET` to any random string in both your `.env` and the Vercel environment variables dashboard.

To test the endpoint manually:

```bash
curl -X POST https://your-app.vercel.app/api/send-notifications \
  -H "Authorization: Bearer your-cron-secret"
```

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
│   └── send-notifications.js   # Vercel serverless cron handler
├── public/icons/                # PWA icons (PNG + SVG)
├── scripts/
│   ├── generate-icons.mjs       # PNG generation (requires sharp)
│   └── make-placeholder-icons.mjs
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
