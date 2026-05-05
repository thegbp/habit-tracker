/**
 * Vercel Serverless Function: POST /api/send-notifications
 * Called hourly by Vercel Cron (vercel.json). Sends Web Push to users
 * whose local notification time matches the current UTC hour, if they
 * have incomplete habits for today.
 *
 * Environment variables required (Vercel dashboard → Settings → Env):
 *   SUPABASE_SERVICE_ROLE_KEY
 *   VITE_SUPABASE_URL
 *   VAPID_PRIVATE_KEY
 *   VITE_VAPID_PUBLIC_KEY
 *   VAPID_SUBJECT
 *   CRON_SECRET
 */

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

function toDateStr(date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Current local time string HH:MM in the given IANA timezone */
function localHHMM(timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date())
    const h = parts.find((p) => p.type === 'hour')?.value ?? '00'
    const m = parts.find((p) => p.type === 'minute')?.value ?? '00'
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  // Verify Vercel cron secret
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const nowUTC = new Date()
  const nowHHMM = `${String(nowUTC.getUTCHours()).padStart(2, '0')}:${String(nowUTC.getUTCMinutes()).padStart(2, '0')}`
  const todayUTC = toDateStr(nowUTC)

  // Load all profiles with notifications enabled and at least one push subscription
  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('id, notification_time, notification_timezone, last_notification_sent, notification_enabled')
    .eq('notification_enabled', true)

  if (profileErr) return res.status(500).json({ error: profileErr.message })

  const results = []

  for (const profile of profiles ?? []) {
    // Skip if already notified today
    if (profile.last_notification_sent === todayUTC) continue

    // Check if current local time matches notification time (within the current hour)
    const tz = profile.notification_timezone ?? 'UTC'
    const localTime = localHHMM(tz)
    const notifHour = profile.notification_time?.slice(0, 2) ?? '21'
    const currentLocalHour = localTime?.slice(0, 2)

    if (currentLocalHour !== notifHour) continue

    // Check for incomplete habits today
    const { data: habits } = await supabase
      .from('habits')
      .select('id')
      .eq('user_id', profile.id)
      .eq('active', true)

    if (!habits || habits.length === 0) continue

    const { data: completedToday } = await supabase
      .from('habit_logs')
      .select('habit_id')
      .eq('user_id', profile.id)
      .eq('date', todayUTC)
      .eq('completed', true)

    const completedIds = new Set((completedToday ?? []).map((l) => l.habit_id))
    const incomplete = habits.filter((h) => !completedIds.has(h.id))

    if (incomplete.length === 0) continue

    // Load push subscriptions for this user
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, keys')
      .eq('user_id', profile.id)

    if (!subs || subs.length === 0) continue

    const payload = JSON.stringify({
      title: 'Habit check-in',
      body: `You have ${incomplete.length} habit${incomplete.length !== 1 ? 's' : ''} left to check in today.`,
      url: '/'
    })

    let sent = false
    for (const sub of subs) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload)
        sent = true
      } catch (err) {
        // 410 = subscription expired — clean it up
        if (err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
        results.push({ user: profile.id, error: err.message })
      }
    }

    if (sent) {
      await supabase
        .from('profiles')
        .update({ last_notification_sent: todayUTC })
        .eq('id', profile.id)
      results.push({ user: profile.id, sent: true, incomplete: incomplete.length })
    }
  }

  return res.status(200).json({ ok: true, processed: results.length, results })
}
