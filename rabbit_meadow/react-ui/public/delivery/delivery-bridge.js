(function () {
  var USER_TOKEN_KEY = 'al-arnab-token';
  var API_BASE_URL =
    window.__AL_ARNAB_API_BASE__ ||
    (function () {
      try {
        return window.localStorage.getItem('al-arnab-api-base') || '';
      } catch (_error) {
        return '';
      }
    })() ||
    window.location.origin + '/api';

  function send(type, payload) {
    window.parent.postMessage(
      Object.assign({ source: 'stitch-frame', type: type }, payload || {}),
      window.location.origin,
    );
  }

  function getToken() {
    try {
      return window.localStorage.getItem(USER_TOKEN_KEY) || '';
    } catch (_error) {
      return '';
    }
  }

  async function apiRequest(path, options) {
    var token = getToken();
    if (!token) {
      throw new Error('missing-token');
    }

    var response = await fetch(API_BASE_URL + path, {
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
      throw new Error((data && data.message) || 'request-failed');
    }

    return data;
  }

  function handleRouteClick(event) {
    var target = event.currentTarget;
    var to = target.getAttribute('data-route');
    if (!to) return;

    event.preventDefault();
    send('navigate', { to: to });
  }

  function bindRoutes(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('[data-route]');

    nodes.forEach(function (node) {
      if (node.__deliveryRouteBound) return;
      node.__deliveryRouteBound = true;
      node.style.cursor = 'pointer';
      node.addEventListener('click', handleRouteClick);
    });
  }

  function bindActions(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('[data-delivery-action]');

    nodes.forEach(function (node) {
      if (node.__deliveryActionBound) return;
      node.__deliveryActionBound = true;

      node.addEventListener('click', function (event) {
        event.preventDefault();
        var action = node.getAttribute('data-delivery-action');
        if (action === 'logout') {
          send('logout');
        }
      });
    });
  }

  function init() {
    bindRoutes(document);
    bindActions(document);
  }

  window.DeliveryBridge = {
    init: init,
    send: send,
    apiRequest: apiRequest,
    bindRoutes: bindRoutes,
    bindActions: bindActions,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
