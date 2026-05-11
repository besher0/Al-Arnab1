(function () {
  if (window.AlArnabNotifications) return;

  var TOKEN_STORAGE_KEY = 'al-arnab-token';
  var API_BASE_STORAGE_KEY = 'al-arnab-api-base';
  var FIREBASE_CONFIG_STORAGE_KEY = 'al-arnab-firebase-config';
  var SDK_VERSION = '10.13.2';

  var sdkLoadingPromise = null;
  var pushSyncPromise = null;
  var foregroundBound = false;
  var unreadPollingTimer = null;
  var unreadFetchInFlight = false;
  var mountedButtons = [];
  var notificationAudioContext = null;
  var notificationAudioUnlocked = false;
  var audioUnlockBound = false;

  function getApiBase() {
    return (
      window.__AL_ARNAB_API_BASE__ ||
      (function () {
        try {
          return window.localStorage.getItem(API_BASE_STORAGE_KEY) || '';
        } catch (_error) {
          return '';
        }
      })() ||
      window.location.origin + '/api'
    );
  }

  function getToken() {
    try {
      return window.localStorage.getItem(TOKEN_STORAGE_KEY) || '';
    } catch (_error) {
      return '';
    }
  }

  function readFirebaseConfig() {
    try {
      var raw = window.localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY) || '';
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (_error) {
      return null;
    }
  }

  function send(type, payload) {
    window.parent.postMessage(
      Object.assign({ source: 'stitch-frame', type: type }, payload || {}),
      window.location.origin,
    );
  }

  function openNotificationCenter() {
    send('navigate', { to: '/notifications' });
  }

  function setUnreadBadge(button, unreadCount) {
    if (!button) return;

    var count = Math.max(0, Number(unreadCount) || 0);
    var badge = button.querySelector('[data-notification-unread]');

    if (!badge) {
      badge = document.createElement('span');
      badge.setAttribute('data-notification-unread', 'true');
      badge.style.position = 'absolute';
      badge.style.top = '-4px';
      badge.style.left = '-4px';
      badge.style.minWidth = '17px';
      badge.style.height = '17px';
      badge.style.padding = '0 4px';
      badge.style.borderRadius = '999px';
      badge.style.background = '#ef4444';
      badge.style.color = '#fff';
      badge.style.fontSize = '10px';
      badge.style.fontWeight = '800';
      badge.style.lineHeight = '17px';
      badge.style.textAlign = 'center';
      badge.style.display = 'none';
      badge.style.pointerEvents = 'none';
      button.appendChild(badge);
    }

    if (getComputedStyle(button).position === 'static') {
      button.style.position = 'relative';
    }

    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }

  function emitNotificationReceived(payload) {
    try {
      if (typeof window.CustomEvent === 'function') {
        window.dispatchEvent(
          new CustomEvent('al-arnab-notification-received', {
            detail: payload || null,
          }),
        );
      }
    } catch (_error) {
      // ignore event dispatch errors
    }
  }

  function getAudioContext() {
    if (notificationAudioContext) return notificationAudioContext;
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      notificationAudioContext = new AudioCtx();
      return notificationAudioContext;
    } catch (_error) {
      return null;
    }
  }

  function unlockNotificationAudio() {
    var context = getAudioContext();
    if (!context) return;

    if (context.state === 'suspended') {
      context.resume().catch(function () {
        // ignore unlock failure
      });
    }
    notificationAudioUnlocked = true;
  }

  function bindAudioUnlock() {
    if (audioUnlockBound) return;
    audioUnlockBound = true;

    var unlockOnce = function () {
      unlockNotificationAudio();
      window.removeEventListener('pointerdown', unlockOnce, true);
      window.removeEventListener('touchstart', unlockOnce, true);
      window.removeEventListener('keydown', unlockOnce, true);
    };

    window.addEventListener('pointerdown', unlockOnce, true);
    window.addEventListener('touchstart', unlockOnce, true);
    window.addEventListener('keydown', unlockOnce, true);
  }

  function playTone(context, frequency, startTime, duration, gainValue) {
    var oscillator = context.createOscillator();
    var gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
  }

  function playNotificationSound() {
    var context = getAudioContext();
    if (!context) return;

    if (context.state === 'suspended' && !notificationAudioUnlocked) {
      return;
    }

    if (context.state === 'suspended') {
      context.resume().catch(function () {
        // ignore play failure
      });
    }

    var now = context.currentTime + 0.01;
    playTone(context, 880, now, 0.12, 0.12);
    playTone(context, 1175, now + 0.16, 0.16, 0.12);
  }

  async function request(path, options) {
    var token = getToken();
    if (!token) throw new Error('missing-token');

    var response = await fetch(getApiBase() + path, {
      method: (options && options.method) || 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: options && options.body ? JSON.stringify(options.body) : undefined,
    });

    var data = null;
    try {
      data = await response.json();
    } catch (_error) {
      data = null;
    }

    if (!response.ok) {
      var message = (data && data.message) || 'request-failed';
      if (Array.isArray(message)) message = message[0] || 'request-failed';
      throw new Error(String(message));
    }

    return data;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-sdk-src="' + src + '"]');
      if (existing) {
        if (existing.getAttribute('data-loaded') === '1') {
          resolve();
          return;
        }
        existing.addEventListener('load', function () {
          resolve();
        });
        existing.addEventListener('error', function () {
          reject(new Error('sdk-load-failed'));
        });
        return;
      }

      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.setAttribute('data-sdk-src', src);
      script.onload = function () {
        script.setAttribute('data-loaded', '1');
        resolve();
      };
      script.onerror = function () {
        reject(new Error('sdk-load-failed'));
      };
      document.head.appendChild(script);
    });
  }

  async function ensureFirebaseCompat() {
    if (window.firebase && window.firebase.messaging) {
      return window.firebase;
    }

    if (!sdkLoadingPromise) {
      sdkLoadingPromise = Promise.all([
        loadScript('https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/firebase-app-compat.js'),
        loadScript(
          'https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/firebase-messaging-compat.js',
        ),
      ]).then(function () {
        if (!window.firebase || !window.firebase.messaging) {
          throw new Error('firebase-sdk-unavailable');
        }
        return window.firebase;
      });
    }

    return sdkLoadingPromise;
  }

  async function registerPushNotifications() {
    if (!window.isSecureContext) {
      return { success: false, reason: 'insecure-context' };
    }

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return { success: false, reason: 'unsupported' };
    }

    var config = readFirebaseConfig();
    if (!config || !config.apiKey || !config.projectId || !config.messagingSenderId || !config.appId) {
      return { success: false, reason: 'missing-config' };
    }

    if (!config.vapidKey) {
      return { success: false, reason: 'missing-vapid-key' };
    }

    var permission = Notification.permission;
    if (permission !== 'granted') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      return { success: false, reason: 'permission-denied' };
    }

    var firebase = await ensureFirebaseCompat();
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
        measurementId: config.measurementId,
      });
    }

    var swParams = [
      ['apiKey', config.apiKey],
      ['authDomain', config.authDomain],
      ['projectId', config.projectId],
      ['storageBucket', config.storageBucket],
      ['messagingSenderId', config.messagingSenderId],
      ['appId', config.appId],
      ['measurementId', config.measurementId],
    ]
      .filter(function (entry) {
        return Boolean(entry[1]);
      })
      .map(function (entry) {
        return encodeURIComponent(entry[0]) + '=' + encodeURIComponent(String(entry[1]));
      })
      .join('&');

    var swUrl = '/firebase-messaging-sw.js' + (swParams ? '?' + swParams : '');
    var registration = await navigator.serviceWorker.register(swUrl);
    var messaging = firebase.messaging();
    var token = await messaging.getToken({
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return { success: false, reason: 'token-empty' };
    }

    await request('/notifications/device-token', {
      method: 'POST',
      body: {
        token: token,
        platform: 'WEB',
        deviceName: navigator.userAgent || 'Web Browser',
      },
    });

    bindForegroundMessages(messaging);
    return { success: true, token: token };
  }

  async function syncPushTokenIfGranted() {
    if (pushSyncPromise) return pushSyncPromise;
    if (!window.isSecureContext) return { success: false, reason: 'insecure-context' };
    if (!('Notification' in window)) return { success: false, reason: 'unsupported' };
    if (Notification.permission !== 'granted') return { success: false, reason: 'permission-not-granted' };

    pushSyncPromise = registerPushNotifications()
      .catch(function (_error) {
        return { success: false, reason: 'sync-failed' };
      })
      .finally(function () {
        pushSyncPromise = null;
      });

    return pushSyncPromise;
  }

  function bindForegroundMessages(messaging) {
    if (!messaging || foregroundBound) return;
    foregroundBound = true;

    messaging.onMessage(function (payload) {
      emitNotificationReceived(payload);
      void refreshUnreadBadges();
      playNotificationSound();
      var title = (payload && payload.notification && payload.notification.title) || 'إشعار جديد';
      var body = (payload && payload.notification && payload.notification.body) || '';
      if (typeof window.showStitchAlert === 'function') {
        window.showStitchAlert(title + (body ? ': ' + body : ''));
      }
    });
  }

  async function tryBindForegroundMessages() {
    var config = readFirebaseConfig();
    if (!config || !config.apiKey || !config.projectId || !config.messagingSenderId || !config.appId) {
      return false;
    }

    try {
      var firebase = await ensureFirebaseCompat();
      if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp({
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          projectId: config.projectId,
          storageBucket: config.storageBucket,
          messagingSenderId: config.messagingSenderId,
          appId: config.appId,
          measurementId: config.measurementId,
        });
      }
      bindForegroundMessages(firebase.messaging());
      return true;
    } catch (_error) {
      return false;
    }
  }

  async function fetchMyNotifications(limit, unreadOnly) {
    var query = [];
    if (Number(limit) > 0) query.push('limit=' + encodeURIComponent(String(Math.floor(limit))));
    if (unreadOnly) query.push('unreadOnly=true');
    var suffix = query.length ? '?' + query.join('&') : '';
    return request('/notifications' + suffix);
  }

  async function fetchUnreadCount() {
    return request('/notifications/unread-count');
  }

  async function refreshUnreadBadges() {
    if (unreadFetchInFlight || !mountedButtons.length) return;
    unreadFetchInFlight = true;

    try {
      var payload = await fetchUnreadCount();
      var unreadCount = payload && payload.unreadCount ? payload.unreadCount : 0;
      mountedButtons.forEach(function (button) {
        setUnreadBadge(button, unreadCount);
      });
    } catch (_error) {
      // ignore temporary badge refresh failures
    } finally {
      unreadFetchInFlight = false;
    }
  }

  function startUnreadPolling() {
    if (unreadPollingTimer) return;
    unreadPollingTimer = window.setInterval(function () {
      void refreshUnreadBadges();
    }, 5000);
  }

  async function markNotificationAsRead(notificationId) {
    return request('/notifications/' + encodeURIComponent(String(notificationId || '')) + '/read', {
      method: 'PATCH',
    });
  }

  async function markAllAsRead() {
    return request('/notifications/read-all', { method: 'PATCH' });
  }

  function mountHeaderButton(selectorOrNode) {
    var button =
      typeof selectorOrNode === 'string'
        ? document.querySelector(selectorOrNode)
        : selectorOrNode || null;
    if (!button) return;

    if (button.__notificationBound) return;
    button.__notificationBound = true;
    mountedButtons.push(button);
    button.setAttribute('type', 'button');
    button.setAttribute('aria-label', 'الإشعارات');
    button.addEventListener('click', function (event) {
      event.preventDefault();
      openNotificationCenter();
    });

    fetchUnreadCount()
      .then(function (payload) {
        setUnreadBadge(button, payload && payload.unreadCount ? payload.unreadCount : 0);
      })
      .catch(function () {
        setUnreadBadge(button, 0);
      });
    startUnreadPolling();
    bindAudioUnlock();
    void tryBindForegroundMessages();
    void syncPushTokenIfGranted();
  }

  window.AlArnabNotifications = {
    getApiBase: getApiBase,
    getToken: getToken,
    openNotificationCenter: openNotificationCenter,
    mountHeaderButton: mountHeaderButton,
    registerPushNotifications: registerPushNotifications,
    tryBindForegroundMessages: tryBindForegroundMessages,
    syncPushTokenIfGranted: syncPushTokenIfGranted,
    fetchMyNotifications: fetchMyNotifications,
    fetchUnreadCount: fetchUnreadCount,
    markNotificationAsRead: markNotificationAsRead,
    markAllAsRead: markAllAsRead,
  };
})();


