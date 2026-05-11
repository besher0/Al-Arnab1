(function () {
  var SHOP_STATE_KEY = 'al-arnab-admin-shop-state';
  var USER_TOKEN_KEY = 'al-arnab-token';
  var API_BASE_URL =
    window.__AL_ARNAB_API_BASE__ ||
    (function () {
      try {
        return window.localStorage.getItem('al-arnab-api-base') || '';
      } catch (error) {
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

  function fallbackHashNavigate(to) {
    if (!to || typeof to !== 'string') return;

    try {
      if (!window.parent || window.parent === window) return;
      if (!window.parent.location || window.parent.location.origin !== window.location.origin) return;

      var normalized = to.charAt(0) === '#' ? to : '#' + to;
      if (window.parent.location.hash !== normalized) {
        window.parent.location.hash = normalized;
      }
    } catch (error) {
      // Ignore fallback failures and keep postMessage navigation.
    }
  }

  function getToken() {
    try {
      return window.localStorage.getItem(USER_TOKEN_KEY) || '';
    } catch (error) {
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
    } catch (error) {
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
    fallbackHashNavigate(to);
    send('navigate', { to: to });
  }

  function bindRoutes(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('[data-route]');

    nodes.forEach(function (node) {
      if (node.__adminBound) return;
      node.__adminBound = true;
      node.style.cursor = 'pointer';
      node.addEventListener('click', handleRouteClick);
    });
  }

  function bindToggleGroups(root) {
    var scope = root || document;
    var groups = scope.querySelectorAll('[data-toggle-group]');

    groups.forEach(function (group) {
      var items = group.querySelectorAll('[data-toggle-item]');
      items.forEach(function (item) {
        if (item.__toggleBound) return;
        item.__toggleBound = true;
        item.addEventListener('click', function () {
          items.forEach(function (n) {
            n.classList.remove('active');
          });
          item.classList.add('active');
        });
      });
    });
  }

  function bindAdminActions(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('[data-admin-action]');

    nodes.forEach(function (node) {
      if (node.__adminActionBound) return;
      node.__adminActionBound = true;

      node.addEventListener('click', function (event) {
        var action = node.getAttribute('data-admin-action');
        if (!action) return;

        event.preventDefault();
        if (action === 'logout') {
          send('logout');
        }
      });
    });
  }

  function getShopState() {
    try {
      var saved = window.localStorage.getItem(SHOP_STATE_KEY);
      if (saved === 'open' || saved === 'closed') {
        return saved;
      }
    } catch (error) {
      return 'open';
    }

    return 'open';
  }

  function saveShopState(state) {
    try {
      window.localStorage.setItem(SHOP_STATE_KEY, state);
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function applyShopState(state, root) {
    var scope = root || document;
    var nextState = state === 'closed' ? 'closed' : 'open';
    var isOpen = nextState === 'open';

    var buttons = scope.querySelectorAll('[data-shop-toggle]');
    buttons.forEach(function (button) {
      var matches = button.getAttribute('data-shop-toggle') === nextState;
      button.classList.toggle('active', matches);
      button.setAttribute('aria-pressed', matches ? 'true' : 'false');
    });

    var labels = scope.querySelectorAll('[data-shop-state-label]');
    labels.forEach(function (label) {
      label.textContent = isOpen ? 'المحل مفتوح' : 'المحل مغلق';
    });

    var wrappers = scope.querySelectorAll('[data-shop-state-wrap]');
    wrappers.forEach(function (wrap) {
      wrap.classList.toggle('is-open', isOpen);
      wrap.classList.toggle('is-closed', !isOpen);
    });

    saveShopState(nextState);
  }

  async function syncStoreStateFromBackend() {
    try {
      var settings = await apiRequest('/admin/settings/store');
      var state = settings && settings.isOpen ? 'open' : 'closed';
      applyShopState(state);
      return state;
    } catch (error) {
      return getShopState();
    }
  }

  async function syncStoreStateToBackend(state) {
    try {
      await apiRequest('/admin/settings/store', {
        method: 'PATCH',
        body: {
          isOpen: state === 'open',
        },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async function setShopState(state, options) {
    var nextState = state === 'closed' ? 'closed' : 'open';
    applyShopState(nextState);

    if (!options || !options.persistBackend) {
      return;
    }

    var saved = await syncStoreStateToBackend(nextState);
    if (!saved) {
      // Fallback to local-only state if backend request fails.
      saveShopState(nextState);
    }
  }

  function bindShopSwitch(root) {
    var scope = root || document;
    var buttons = scope.querySelectorAll('[data-shop-toggle]');

    buttons.forEach(function (button) {
      if (button.__shopBound) return;
      button.__shopBound = true;

      button.addEventListener('click', function () {
        var state = button.getAttribute('data-shop-toggle');
        setShopState(state, { persistBackend: true });
      });
    });

    applyShopState(getShopState(), scope);

    // Try syncing from backend after local render, so UI doesn't wait.
    syncStoreStateFromBackend();
  }

  function getAdminPageKey() {
    var file = (window.location.pathname.split('/').pop() || '').toLowerCase();

    if (file === 'dashboard.html') return 'dashboard';
    if (file === 'sales-report.html') return 'reports';
    if (file === 'add-category.html') return 'categories';
    if (file === 'notifications.html') return 'notifications';

    if (
      file === 'current-orders.html' ||
      file === 'completed-orders.html' ||
      file === 'order-detail.html'
    ) {
      return 'orders';
    }

    if (
      file === 'add-product.html' ||
      file === 'new-discount.html' ||
      file === 'products-list.html' ||
      file === 'discounts-list.html'
    ) {
      return 'stock';
    }

    return 'dashboard';
  }

  function ensureUnifiedFooter(root) {
    var scope = root || document;
    var shell = scope.querySelector('.admin-shell');
    if (!shell) return;

    var nav = shell.querySelector('.bottom-nav');
    if (!nav) {
      nav = document.createElement('nav');
      shell.appendChild(nav);
    }

    nav.className = 'bottom-nav admin-unified-footer seven';
    nav.removeAttribute('style');
    nav.innerHTML = [
      '<button class="nav-item" data-footer-key="dashboard" data-route="/admin/dashboard">',
      '<span class="material-symbols-outlined nav-icon">home</span>الرئيسية',
      '</button>',
      '<button class="nav-item" data-footer-key="orders" data-route="/admin/orders/current">',
      '<span class="material-symbols-outlined nav-icon">shopping_bag</span>الطلبات',
      '</button>',
      '<button class="nav-item" data-footer-key="notifications" data-route="/admin/notifications">',
      '<span class="material-symbols-outlined nav-icon">notifications</span>الإشعارات',
      '</button>',
      '<button class="nav-item" data-footer-key="categories" data-route="/admin/categories/new">',
      '<span class="material-symbols-outlined nav-icon">category</span>التصنيفات',
      '</button>',
      '<button class="nav-item" data-footer-key="stock" data-route="/admin/products">',
      '<span class="material-symbols-outlined nav-icon">inventory_2</span>المخزون',
      '</button>',
      '<button class="nav-item" data-footer-key="reports" data-route="/admin/reports/sales">',
      '<span class="material-symbols-outlined nav-icon">query_stats</span>التقارير',
      '</button>',
      '<button class="nav-item" data-admin-action="logout">',
      '<span class="material-symbols-outlined nav-icon">logout</span>خروج',
      '</button>',
    ].join('');

    var activeKey = getAdminPageKey();
    var items = nav.querySelectorAll('[data-footer-key]');
    items.forEach(function (item) {
      var isActive = item.getAttribute('data-footer-key') === activeKey;
      item.classList.toggle('active', isActive);
    });

    bindRoutes(nav);
    bindAdminActions(nav);
  }

  function init() {
    ensureUnifiedFooter(document);
    bindRoutes(document);
    bindToggleGroups(document);
    bindShopSwitch(document);
    bindAdminActions(document);
  }

  window.AdminBridge = {
    init: init,
    go: function (to) {
      fallbackHashNavigate(to);
      send('navigate', { to: to });
    },
    send: send,
    bindRoutes: bindRoutes,
    bindToggleGroups: bindToggleGroups,
    bindShopSwitch: bindShopSwitch,
    bindAdminActions: bindAdminActions,
    setShopState: setShopState,
    getShopState: getShopState,
    apiRequest: apiRequest,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
