/* global importScripts, firebase, self */

var SHELL_CACHE_NAME = 'al-arnab-shell-v2';
var SHELL_ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png'];
var FIREBASE_SDK_READY = false;

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(SHELL_CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(SHELL_ASSETS);
      })
      .catch(function () {
        return undefined;
      }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            if (key !== SHELL_CACHE_NAME) {
              return caches.delete(key);
            }
            return Promise.resolve(false);
          }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

self.addEventListener('fetch', function (event) {
  if (!event.request || event.request.method !== 'GET') {
    return;
  }

  var requestUrl;
  try {
    requestUrl = new URL(event.request.url);
  } catch (_error) {
    return;
  }

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(function () {
        return caches.match('/index.html');
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then(function (networkResponse) {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            var clonedResponse = networkResponse.clone();
            caches
              .open(SHELL_CACHE_NAME)
              .then(function (cache) {
                cache.put(event.request, clonedResponse);
              })
              .catch(function () {
                return undefined;
              });
          }

          return networkResponse;
        })
        .catch(function () {
          return caches.match('/index.html');
        });
    }),
  );
});

try {
  importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');
  FIREBASE_SDK_READY = Boolean(self.firebase && self.firebase.messaging);
} catch (_error) {
  FIREBASE_SDK_READY = false;
}

var configFromEnv = self.FIREBASE_WEB_CONFIG || null;

if (!configFromEnv || !configFromEnv.apiKey) {
  try {
    var url = new URL(self.location.href);
    var params = url.searchParams;
    if (params.get('apiKey')) {
      configFromEnv = {
        apiKey: params.get('apiKey') || '',
        authDomain: params.get('authDomain') || undefined,
        projectId: params.get('projectId') || '',
        storageBucket: params.get('storageBucket') || undefined,
        messagingSenderId: params.get('messagingSenderId') || '',
        appId: params.get('appId') || '',
        measurementId: params.get('measurementId') || undefined,
      };
    }
  } catch (_error) {
    configFromEnv = null;
  }
}

if (FIREBASE_SDK_READY && configFromEnv && configFromEnv.apiKey) {
  firebase.initializeApp(configFromEnv);
}

if (FIREBASE_SDK_READY && firebase.apps && firebase.apps.length) {
  var messaging = firebase.messaging();
  messaging.onBackgroundMessage(function (payload) {
    var title =
      (payload && payload.notification && payload.notification.title) ||
      'إشعار جديد';
    var body = (payload && payload.notification && payload.notification.body) || '';
    var icon =
      (payload && payload.notification && payload.notification.icon) ||
      '/icons/icon-192.png';

    self.registration.showNotification(title, {
      body: body,
      icon: icon,
      data: payload && payload.data ? payload.data : {},
    });
  });
}

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
      for (var i = 0; i < clients.length; i += 1) {
        var client = clients[i];
        if (client && 'focus' in client) {
          client.postMessage({ source: 'service-worker', type: 'notification-clicked' });
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow('/#/notifications');
      }

      return undefined;
    }),
  );
});
