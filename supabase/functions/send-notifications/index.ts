/**
 * Supabase Edge Function: send-notifications
 *
 * Checks all users with incomplete habits and sends Web Push notifications
 * to those whose configured local notification time matches the current hour.
 *
 * Scheduled by pg_cron via pg_net — see supabase/migrations/002_pg_cron.sql
 *
 * Required secrets (set with: supabase secrets set KEY=value):
 *   SUPABASE_SERVICE_ROLE_KEY
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT          (e.g. mailto:you@example.com)
 *   CRON_SECRET            (must match the value in pg_net call)
 *
 * SUPABASE_URL is injected automatically by the Supabase runtime.
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Base64url helpers ────────────────────────────────────────────────────────

const enc = new TextEncoder()

function toB64u(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  bytes.forEach(b => (s += String.fromCharCode(b)))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function fromB64u(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return Uint8Array.from(atob(s), c => c.charCodeAt(0))
}

function strToB64u(s: string): string {
  return toB64u(enc.encode(s))
}

// ─── HKDF (SHA-256) ──────────────────────────────────────────────────────────

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8,
  )
  return new Uint8Array(bits)
}

// ─── VAPID JWT signing (RFC 8292, ECDSA P-256) ───────────────────────────────

async function importVapidKey(privB64u: string, pubB64u: string): Promise<CryptoKey> {
  const pub = fromB64u(pubB64u) // 65-byte uncompressed EC point: 0x04 || x || y
  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      d: privB64u,
      x: toB64u(pub.slice(1, 33)),
      y: toB64u(pub.slice(33, 65)),
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
}

async function makeVapidJwt(
  endpoint: string,
  subject: string,
  pubB64u: string,
  privB64u: string,
): Promise<string> {
  const aud = new URL(endpoint).origin
  const now = Math.floor(Date.now() / 1000)
  const h = strToB64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  const p = strToB64u(JSON.stringify({ aud, exp: now + 43200, sub: subject }))
  const sigInput = `${h}.${p}`
  const key = await importVapidKey(privB64u, pubB64u)
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(sigInput))
  return `${sigInput}.${toB64u(sig)}`
}

// ─── Web Push payload encryption (aesgcm / draft-ietf-webpush-encryption) ────
//
// Implements the same wire format as the `web-push` npm package so existing
// service worker push handlers work without changes.

function buildInfo(type: string, clientPub: Uint8Array, serverPub: Uint8Array): Uint8Array {
  const prefix = enc.encode(`Content-Encoding: ${type}\0P-256\0`)
  const out = new Uint8Array(prefix.length + 2 + clientPub.length + 2 + serverPub.length)
  const dv = new DataView(out.buffer)
  let o = 0
  out.set(prefix, o); o += prefix.length
  dv.setUint16(o, clientPub.length, false); o += 2
  out.set(clientPub, o); o += clientPub.length
  dv.setUint16(o, serverPub.length, false); o += 2
  out.set(serverPub, o)
  return out
}

async function encryptPayload(
  plaintext: string,
  p256dhB64u: string,
  authB64u: string,
): Promise<{ body: Uint8Array; salt: string; serverPubKey: string }> {
  const clientPubBytes = fromB64u(p256dhB64u)
  const authSecret = fromB64u(authB64u)

  // Ephemeral ECDH key pair (server side)
  const serverKP = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )
  const serverPubBytes = new Uint8Array(await crypto.subtle.exportKey('raw', serverKP.publicKey))

  // Client public key
  const clientPubKey = await crypto.subtle.importKey(
    'raw', clientPubBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  )

  // ECDH shared secret
  const dh = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPubKey }, serverKP.privateKey!, 256),
  )

  const salt = crypto.getRandomValues(new Uint8Array(16))

  // PRK = HKDF(authSecret, dh, "Content-Encoding: auth\0", 32)
  const prk = await hkdf(authSecret, dh, enc.encode('Content-Encoding: auth\0'), 32)

  // CEK = HKDF(salt, prk, context("aesgcm"), 16)
  const cek = await hkdf(salt, prk, buildInfo('aesgcm', clientPubBytes, serverPubBytes), 16)

  // Nonce = HKDF(salt, prk, context("nonce"), 12)
  const nonce = await hkdf(salt, prk, buildInfo('nonce', clientPubBytes, serverPubBytes), 12)

  // Encrypt: AES-GCM(cek, nonce, 0x00 0x00 || plaintext)
  const padded = new Uint8Array(2 + enc.encode(plaintext).length)
  padded.set(enc.encode(plaintext), 2)
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded)

  return { body: new Uint8Array(encrypted), salt: toB64u(salt), serverPubKey: toB64u(serverPubBytes) }
}

// ─── Send one push notification ──────────────────────────────────────────────

async function sendPush(
  endpoint: string,
  keys: { p256dh: string; auth: string },
  payload: string,
  vapidPub: string,
  vapidPriv: string,
  vapidSubject: string,
): Promise<{ ok: boolean; status: number }> {
  const { body, salt, serverPubKey } = await encryptPayload(payload, keys.p256dh, keys.auth)
  const jwt = await makeVapidJwt(endpoint, vapidSubject, vapidPub, vapidPriv)

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt},k=${vapidPub}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aesgcm',
      Encryption: `salt=${salt}`,
      'Crypto-Key': `dh=${serverPubKey}`,
      TTL: '86400',
    },
    body,
  })

  return { ok: res.ok, status: res.status }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

/** Returns current HH (zero-padded) in the given IANA timezone. */
function localHour(timezone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false,
    }).formatToParts(new Date())
    return parts.find(p => p.type === 'hour')?.value?.padStart(2, '0') ?? null
  } catch {
    return null
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  // Verify cron secret so the endpoint isn't publicly callable.
  // Also reject if CRON_SECRET is missing/empty — fail closed rather than open.
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || req.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const vapidPub = Deno.env.get('VAPID_PUBLIC_KEY')!
  const vapidPriv = Deno.env.get('VAPID_PRIVATE_KEY')!
  const vapidSubject = Deno.env.get('VAPID_SUBJECT')!

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const todayUTC = toDateStr(new Date())
  const results: unknown[] = []

  // Load all profiles with notifications enabled
  const { data: profiles, error: profErr } = await db
    .from('profiles')
    .select('id, notification_time, notification_timezone, last_notification_sent, notification_enabled')
    .eq('notification_enabled', true)

  if (profErr) return new Response(JSON.stringify({ error: profErr.message }), { status: 500 })

  for (const profile of profiles ?? []) {
    // Skip if already notified today
    if (profile.last_notification_sent === todayUTC) continue

    // Check whether it's this user's notification hour right now
    const tz = profile.notification_timezone ?? 'UTC'
    const notifHour = (profile.notification_time as string | null)?.slice(0, 2) ?? '21'
    if (localHour(tz) !== notifHour) continue

    // Check for incomplete habits today
    const { data: habits } = await db
      .from('habits')
      .select('id')
      .eq('user_id', profile.id)
      .eq('active', true)

    if (!habits?.length) continue

    const { data: completedToday } = await db
      .from('habit_logs')
      .select('habit_id')
      .eq('user_id', profile.id)
      .eq('date', todayUTC)
      .eq('completed', true)

    const completedIds = new Set((completedToday ?? []).map((l: { habit_id: string }) => l.habit_id))
    const incomplete = habits.filter((h: { id: string }) => !completedIds.has(h.id))
    if (!incomplete.length) continue

    // Load push subscriptions
    const { data: subs } = await db
      .from('push_subscriptions')
      .select('endpoint, keys')
      .eq('user_id', profile.id)

    if (!subs?.length) continue

    const body = JSON.stringify({
      title: 'Habit check-in',
      body: `You have ${incomplete.length} habit${incomplete.length !== 1 ? 's' : ''} left to check in today.`,
      url: '/',
    })

    let sent = false
    for (const sub of subs) {
      try {
        const { ok, status } = await sendPush(
          sub.endpoint, sub.keys, body, vapidPub, vapidPriv, vapidSubject,
        )
        if (ok) {
          sent = true
        } else if (status === 410) {
          // Subscription expired — clean it up
          await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
        results.push({ user: profile.id, endpoint: sub.endpoint.slice(0, 40), ok, status })
      } catch (err) {
        results.push({ user: profile.id, error: String(err) })
      }
    }

    if (sent) {
      await db.from('profiles').update({ last_notification_sent: todayUTC }).eq('id', profile.id)
    }
  }

  // Return counts only — not endpoint fragments or user IDs in the response body.
  const sent = results.filter((r: Record<string, unknown>) => r.ok).length
  return new Response(JSON.stringify({ ok: true, checked: (profiles ?? []).length, sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
