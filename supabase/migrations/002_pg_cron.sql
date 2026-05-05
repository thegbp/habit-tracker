-- Run in Supabase SQL Editor after deploying the Edge Function.
-- Requires pg_cron and pg_net to be enabled:
--   Dashboard → Database → Extensions → search "pg_cron" and "pg_net" → Enable both.

-- Schedule the send-notifications Edge Function to run every hour.
-- The function itself checks each user's configured notification time + timezone,
-- so running hourly ensures everyone gets notified at their preferred local time.
select cron.schedule(
  'send-habit-notifications',          -- job name (must be unique)
  '0 * * * *',                         -- every hour on the hour
  $$
    select net.http_post(
      url     := (select 'https://' || current_setting('app.settings.project_ref') || '.supabase.co/functions/v1/send-notifications'),
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
      ),
      body    := '{}'::jsonb
    )
  $$
);

-- Verify it was created:
-- select * from cron.job;

-- To unschedule later:
-- select cron.unschedule('send-habit-notifications');
