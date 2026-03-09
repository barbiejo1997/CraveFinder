/*
  ============================================================
  WHAT IS A SERVICE WORKER?
  ============================================================
  A service worker is a background script that runs separately
  from your app. It acts like a proxy between your app and
  the internet — intercepting network requests and deciding
  whether to fetch fresh data or serve a cached version.

  This is what makes PWAs work offline and feel fast.

  KEY CONCEPTS:
  - Cache: a local storage area where we save files
  - install event: runs once when the PWA is first installed
  - fetch event: runs every time the app requests anything
  ============================================================
*/

// Version your cache — when you update the app, change this
// string to force all users to get the fresh version
const CACHE_NAME = 'cravefinder-v2';

const CORE_FILES = [
  '/cravefinder/',
  '/cravefinder/index.html',
  '/cravefinder/manifest.json',
  '/cravefinder/icons/icon-192.png',
  '/cravefinder/icons/icon-512.png'
];

// ---- INSTALL EVENT ----
// Fires once when the service worker is first registered
// We pre-cache the core app files here
self.addEventListener('install', event => {
  console.log('[SW] Installing CraveFinder service worker...');

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching core app files');
      return cache.addAll(CORE_FILES);
    })
  );

  // Take control immediately without waiting for old SW to die
  self.skipWaiting();
});

// ---- ACTIVATE EVENT ----
// Fires after install — clean up any old caches from previous versions
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)  // find old caches
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);          // delete them
          })
      );
    })
  );

  // Take control of all open tabs immediately
  self.clients.claim();
});

// ---- FETCH EVENT ----
// Fires every time the app makes a network request
// Strategy: "Network First, Cache Fallback"
//   1. Try to get fresh data from the network
//   2. If offline/slow, serve the cached version instead
//   3. API calls (to your Render server) always go to network only
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Don't cache API calls — always fetch these live
  // (We want real restaurant data, not stale cached results)
  if (url.hostname.includes('onrender.com') ||
      url.hostname.includes('googleapis.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For everything else: try network first, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Got a fresh response — also save it to cache for next time
        if (response.status === 200) {
          const copy = response.clone(); // can only read a response once
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => {
        // Network failed — serve from cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Nothing in cache either — show a friendly offline message
          return new Response(
            '<h2 style="font-family:sans-serif;text-align:center;padding:2rem">You\'re offline. Please connect to search for restaurants.</h2>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
  );
});
