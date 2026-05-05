/**
 * This route has been replaced by the Supabase Edge Function at:
 *   supabase/functions/send-notifications/index.ts
 *
 * Scheduled via pg_cron — see supabase/migrations/002_pg_cron.sql
 */
export default function handler(_req, res) {
  res.status(410).json({
    error: 'Gone',
    message: 'Push notifications are now handled by the Supabase Edge Function send-notifications.',
  })
}
