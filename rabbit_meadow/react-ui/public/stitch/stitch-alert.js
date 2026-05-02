(function () {
  if (window.__stitchAlertReady) return;
  window.__stitchAlertReady = true;

  var styleId = 'stitch-alert-style';
  var containerId = 'stitch-alert-root';
  var nativeAlert = typeof window.alert === 'function' ? window.alert.bind(window) : null;

  function ensureStyle() {
    if (document.getElementById(styleId)) return;

    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = [
      '#' + containerId + ' {',
      '  position: fixed;',
      '  top: 20px;',
      '  left: 0;',
      '  right: 0;',
      '  display: flex;',
      '  flex-direction: column;',
      '  align-items: center;',
      '  gap: 10px;',
      '  z-index: 9999;',
      '  pointer-events: none;',
      '}',
      '.stitch-alert {',
      '  min-width: 260px;',
      '  max-width: min(92vw, 460px);',
      '  background: linear-gradient(145deg, #00a7ee, #0096d6);',
      '  color: #ffffff;',
      '  border: 1px solid rgba(255, 255, 255, 0.32);',
      '  border-radius: 16px;',
      '  box-shadow: 0 14px 34px rgba(0, 121, 173, 0.3);',
      '  padding: 12px 14px;',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 10px;',
      '  font-family: "Tajawal", "Almarai", sans-serif;',
      '  font-size: 15px;',
      '  font-weight: 700;',
      '  pointer-events: auto;',
      '  transform: translateY(-8px);',
      '  opacity: 0;',
      '  transition: opacity 160ms ease, transform 160ms ease;',
      '}',
      '.stitch-alert.is-visible {',
      '  opacity: 1;',
      '  transform: translateY(0);',
      '}',
      '.stitch-alert-icon {',
      '  width: 26px;',
      '  height: 26px;',
      '  border-radius: 999px;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  background: rgba(255, 255, 255, 0.18);',
      '  font-size: 16px;',
      '  font-weight: 900;',
      '}',
      '.stitch-alert-text {',
      '  line-height: 1.45;',
      '}',
    ].join('\n');

    document.head.appendChild(style);
  }

  function ensureContainer() {
    var root = document.getElementById(containerId);
    if (root) return root;

    root = document.createElement('div');
    root.id = containerId;
    document.body.appendChild(root);
    return root;
  }

  function showAlert(message) {
    if (!document.body || !document.head) {
      if (nativeAlert) nativeAlert(String(message));
      return;
    }

    ensureStyle();
    var root = ensureContainer();
    var notice = document.createElement('div');
    notice.className = 'stitch-alert';
    notice.innerHTML =
      '<span class="stitch-alert-icon">!</span><span class="stitch-alert-text"></span>';
    notice.querySelector('.stitch-alert-text').textContent = String(message || '');
    root.appendChild(notice);

    requestAnimationFrame(function () {
      notice.classList.add('is-visible');
    });

    setTimeout(function () {
      notice.classList.remove('is-visible');
      setTimeout(function () {
        if (notice.parentNode) notice.parentNode.removeChild(notice);
      }, 180);
    }, 2800);
  }

  window.showStitchAlert = showAlert;
  window.alert = function (message) {
    showAlert(message);
  };
})();
