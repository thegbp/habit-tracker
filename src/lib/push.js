import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported in this browser.')
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('VITE_VAPID_PUBLIC_KEY is not set.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission denied.')
  }

  const registration = await navigator.serviceWorker.ready

  // Unsubscribe any stale subscription first
  const existing = await registration.pushManager.getSubscription()
  if (existing) await existing.unsubscribe()

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  })

  const { endpoint, keys } = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    { endpoint, keys },
    { onConflict: 'user_id,endpoint' }
  )
  if (error) throw error

  return subscription
}

export async function unsubscribeFromPush() {
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
    await subscription.unsubscribe()
  }
}

export async function getPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}
