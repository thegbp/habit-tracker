import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { BackgroundSyncPlugin } from 'workbox-background-sync'
import { ExpirationPlugin } from 'workbox-expiration'

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()

// Precache all Vite-built assets
precacheAndRoute(self.__WB_MANIFEST)

// Cache Supabase read requests (network-first, fallback to cache)
registerRoute(
  ({ url, request }) =>
    url.hostname.includes('supabase.co') && request.method === 'GET',
  new NetworkFirst({
    cacheName: 'supabase-reads',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 })
    ]
  })
)

// Background sync queue for offline habit log writes.
// No cacheName here — write responses are not useful to cache; the plugin
// handles retry of the request itself, not the response.
const bgSync = new BackgroundSyncPlugin('habit-log-queue', {
  maxRetentionTime: 24 * 60
})

registerRoute(
  ({ url, request }) =>
    url.hostname.includes('supabase.co') &&
    (request.method === 'POST' || request.method === 'PATCH'),
  new NetworkFirst({
    plugins: [bgSync]
  }),
  'POST'
)

// Cache static assets aggressively
registerRoute(
  ({ request }) =>
    request.destination === 'image' ||
    request.destination === 'font',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 })]
  })
)

// Push notification received
self.addEventListener('push', (event) => {
  if (!event.data) return
  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: 'Habit Tracker', body: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Habit Tracker', {
      body: data.body || 'Time to check in on your habits!',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'habit-checkin',
      renotify: true,
      requireInteraction: false,
      data: { url: data.url || '/' }
    })
  )
})

// Notification click — focus existing window or open new one
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/'
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ('focus' in client) return client.focus()
        }
        return clients.openWindow(target)
      })
  )
})
