/* global importScripts, firebase, self */

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

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

if (configFromEnv && configFromEnv.apiKey) {
  firebase.initializeApp(configFromEnv);
}

if (firebase.apps && firebase.apps.length) {
  var messaging = firebase.messaging();
  messaging.onBackgroundMessage(function (payload) {
    var title = (payload && payload.notification && payload.notification.title) || 'إشعار جديد';
    var body = (payload && payload.notification && payload.notification.body) || '';
    var icon =
      (payload &&
        payload.notification &&
        payload.notification.icon) ||
      '/favicon.svg';

    self.registration.showNotification(title, {
      body: body,
      icon: icon,
      data: payload && payload.data ? payload.data : {},
    });
  });
}
