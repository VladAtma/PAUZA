/* Service Worker «Пауза».
   Стратегии:
   - HTML: network-first, при офлайне — кэш/index.html;
   - остальное: cache-first с фоновым обновлением кэша. */

const CACHE_NAME = 'pauza-v14'

const ASSETS = ['./', './index.html', './icon.svg', './manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const isHtml =
    request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')

  if (isHtml) {
    // Сеть в приоритете: пользователь получает свежую версию, офлайн — кэш
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy)).catch(() => {})
          return response
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match('./index.html'))
            .then((cached) => cached || new Response('Офлайн', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })),
        ),
    )
  } else {
    // Сначала кэш, затем фоновое обновление
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {})
            }
            return response
          })
          .catch(() => cached)
        return cached || network
      }),
    )
  }
})
