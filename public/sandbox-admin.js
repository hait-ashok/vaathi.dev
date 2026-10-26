// Sandbox admin: Cognito MFA + list/approve/deny access requests.
(function () {
  var state = { email: '', session: '', secret: '' };

  function $(id) { return document.getElementById(id); }
  function auth() { return window.VaathiAuth; }

  function apiUrl() {
    return (window.VAATHI_SANDBOX_API || '').replace(/\/?$/, '/');
  }

  function setMsg(text, isError) {
    var el = $('admin-auth-msg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'sandbox-hint' + (isError ? ' sandbox-status--error' : '');
  }

  function setListMsg(text, isError) {
    var el = $('admin-list-msg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'sandbox-hint' + (isError ? ' sandbox-status--error' : '');
  }

  function showPanel(name) {
    document.querySelectorAll('[data-admin-panel]').forEach(function (p) {
      p.hidden = p.getAttribute('data-admin-panel') !== name;
    });
  }

  function otpauthUrl(email, secret) {
    var label = encodeURIComponent('vaathi.dev-admin:' + (email || 'admin'));
    var issuer = encodeURIComponent('vaathi.dev');
    return (
      'otpauth://totp/' + label +
      '?secret=' + encodeURIComponent(secret) +
      '&issuer=' + issuer +
      '&algorithm=SHA1&digits=6&period=30'
    );
  }

  function renderTotpQr(email, secret) {
    var host = $('admin-totp-qr');
    if (!host) return;
    host.replaceChildren();
    if (!secret) return;
    var make = typeof qrcode === 'function' ? qrcode : (window && window.qrcode);
    if (typeof make !== 'function') {
      host.textContent = 'QR library missing — use the manual key.';
      return;
    }
    try {
      if (make.stringToBytesFuncs && make.stringToBytesFuncs['UTF-8']) {
        make.stringToBytes = make.stringToBytesFuncs['UTF-8'];
      }
      var qr = make(0, 'M');
      qr.addData(otpauthUrl(email, secret));
      qr.make();
      var dataUrl = typeof qr.createDataURL === 'function' ? qr.createDataURL(6, 8) : '';
      if (dataUrl) {
        var img = document.createElement('img');
        img.src = dataUrl;
        img.width = 220;
        img.height = 220;
        img.alt = 'Scan to add vaathi.dev admin to your authenticator';
        host.appendChild(img);
        return;
      }
      host.innerHTML = qr.createSvgTag(6, 2);
    } catch (err) {
      host.textContent = 'Could not draw QR — use the manual key.';
    }
  }

  function refreshChrome(isAdmin) {
    var a = auth();
    var signed = a && a.isSignedIn();
    var gate = $('admin-auth');
    var panel = $('admin-panel');
    var who = $('admin-who');
    var out = $('admin-signout');
    if (out) out.hidden = !signed;
    if (who) {
      if (signed) {
        var s = a.loadSession();
        who.hidden = false;
        who.textContent = isAdmin
          ? ('Admin: ' + (s.email || 'user'))
          : ('Signed in as ' + (s.email || 'user') + ' — not an admin');
      } else {
        who.hidden = true;
        who.textContent = '';
      }
    }
    if (gate) gate.hidden = !!(signed && isAdmin);
    if (panel) panel.hidden = !(signed && isAdmin);
  }

  async function api(path, opts) {
    var url = apiUrl();
    if (!url || url.indexOf('http') !== 0) throw new Error('Sandbox API is not configured.');
    var headers = Object.assign({ 'Content-Type': 'application/json' }, (opts && opts.headers) || {});
    var token = auth() && auth().accessToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    var resp = await fetch(url.replace(/\/?$/, '/') + path.replace(/^\//, ''), {
      method: (opts && opts.method) || 'GET',
      headers: headers,
      body: opts && opts.body ? JSON.stringify(opts.body) : undefined,
    });
    var data = await resp.json().catch(function () { return {}; });
    if (!resp.ok) throw new Error(data.error || ('HTTP ' + resp.status));
    return data;
  }

  function fmtTime(ts) {
    if (!ts) return '';
    try {
      return new Date(Number(ts) * 1000).toLocaleString();
    } catch (e) {
      return String(ts);
    }
  }

  function rowPending(item) {
    var row = document.createElement('div');
    row.className = 'sb-admin__row';
    var meta = document.createElement('div');
    meta.className = 'sb-admin__meta';
    var email = document.createElement('strong');
    email.textContent = item.email || '';
    var when = document.createElement('span');
    when.className = 'sandbox-hint';
    when.textContent = 'Requested ' + fmtTime(item.requestedAt);
    meta.appendChild(email);
    meta.appendChild(when);
    var actions = document.createElement('div');
    actions.className = 'sb-admin__actions';
    var approve = document.createElement('button');
    approve.type = 'button';
    approve.className = 'site-cta';
    approve.textContent = 'Approve';
    approve.setAttribute('data-decide', 'approve');
    approve.setAttribute('data-email', item.email || '');
    var deny = document.createElement('button');
    deny.type = 'button';
    deny.className = 'site-cta site-cta--ghost';
    deny.textContent = 'Deny';
    deny.setAttribute('data-decide', 'deny');
    deny.setAttribute('data-email', item.email || '');
    actions.appendChild(approve);
    actions.appendChild(deny);
    row.appendChild(meta);
    row.appendChild(actions);
    return row;
  }

  function rowRecent(item) {
    var row = document.createElement('div');
    row.className = 'sb-admin__row sb-admin__row--quiet';
    var meta = document.createElement('div');
    meta.className = 'sb-admin__meta';
    var email = document.createElement('strong');
    email.textContent = item.email || '';
    var when = document.createElement('span');
    when.className = 'sandbox-hint';
    when.textContent =
      (item.status || '') +
      ' · ' +
      fmtTime(item.decidedAt) +
      (item.decidedBy ? ' by ' + item.decidedBy : '');
    meta.appendChild(email);
    meta.appendChild(when);
    row.appendChild(meta);
    return row;
  }

  async function loadRequests() {
    var pendingHost = $('admin-pending');
    var recentHost = $('admin-recent');
    if (pendingHost) pendingHost.replaceChildren();
    if (recentHost) recentHost.replaceChildren();
    setListMsg('Loading…');
    try {
      var data = await api('access-requests');
      setListMsg('');
      refreshChrome(true);
      var pending = data.pending || [];
      var recent = data.recent || [];
      if (pendingHost) {
        if (!pending.length) {
          pendingHost.textContent = 'No pending requests.';
        } else {
          pending.forEach(function (item) {
            pendingHost.appendChild(rowPending(item));
          });
        }
      }
      if (recentHost) {
        if (!recent.length) {
          recentHost.textContent = 'None yet.';
        } else {
          recent.forEach(function (item) {
            recentHost.appendChild(rowRecent(item));
          });
        }
      }
    } catch (err) {
      var msg = err.message || 'Failed to load';
      if (/Admin access required/i.test(msg) || /403/.test(msg)) {
        refreshChrome(false);
        setListMsg('Signed in, but this account is not in the sandbox-admin group.', true);
        setMsg('Not an admin for this pool.', true);
      } else if (/401|Sign in|Session/i.test(msg)) {
        refreshChrome(false);
        showPanel('signin');
        setMsg(msg, true);
      } else {
        setListMsg(msg, true);
      }
    }
  }

  async function finishAuth(result, email) {
    auth().storeAuthResult(result, email);
    setMsg('Signed in.');
    showPanel('signin');
    await loadRequests();
  }

  async function handleAuthResponse(result, email) {
    if (result.AuthenticationResult) {
      await finishAuth(result, email);
      return;
    }
    state.email = email;
    state.session = result.Session || '';
    if (result.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
      setMsg('Enter the 6-digit code from your authenticator app.');
      showPanel('mfa');
      return;
    }
    if (result.ChallengeName === 'MFA_SETUP') {
      var assoc = await auth().associateSoftwareToken(state.session);
      state.session = assoc.Session || state.session;
      state.secret = assoc.SecretCode || '';
      var secretEl = $('admin-totp-secret');
      if (secretEl) secretEl.textContent = state.secret;
      renderTotpQr(email, state.secret);
      setMsg('Scan the QR code, then enter a 6-digit code.');
      showPanel('mfa-setup');
      return;
    }
    throw new Error('Unsupported challenge: ' + (result.ChallengeName || 'unknown'));
  }

  async function onSignIn(e) {
    e.preventDefault();
    var email = (($('admin-email') || {}).value || '').trim();
    var password = ($('admin-password') || {}).value;
    try {
      var result = await auth().initiateAuth(email, password);
      await handleAuthResponse(result, email);
    } catch (err) {
      setMsg(err.message, true);
    }
  }

  async function onMfa(e) {
    e.preventDefault();
    var code = (($('admin-mfa-code') || {}).value || '').trim();
    try {
      var result = await auth().respondMfa(state.email, state.session, code);
      await handleAuthResponse(result, state.email);
    } catch (err) {
      setMsg(err.message, true);
    }
  }

  async function onMfaSetup(e) {
    e.preventDefault();
    var code = (($('admin-mfa-setup-code') || {}).value || '').trim();
    try {
      var verified = await auth().verifySoftwareToken(state.session, code);
      state.session = verified.Session || state.session;
      var result = await auth().respondMfaSetup(state.email, state.session);
      await handleAuthResponse(result, state.email);
    } catch (err) {
      setMsg(err.message, true);
    }
  }

  function onSignOut() {
    auth().clearSession();
    setMsg('Signed out.');
    setListMsg('');
    showPanel('signin');
    refreshChrome(false);
  }

  async function onDecide(email, decision) {
    setListMsg((decision === 'approve' ? 'Approving ' : 'Denying ') + email + '…');
    try {
      await api('access-decide', { method: 'POST', body: { email: email, decision: decision } });
      await loadRequests();
    } catch (err) {
      setListMsg(err.message, true);
    }
  }

  function start() {
    if (!auth()) {
      setMsg('Auth library missing.', true);
      return;
    }
    showPanel('signin');

    var sign = $('admin-form-signin');
    var mfa = $('admin-form-mfa');
    var setup = $('admin-form-mfa-setup');
    var refresh = $('admin-refresh');
    if (sign) sign.addEventListener('submit', onSignIn);
    if (mfa) mfa.addEventListener('submit', onMfa);
    if (setup) setup.addEventListener('submit', onMfaSetup);
    if (refresh) refresh.addEventListener('click', function () { loadRequests(); });

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      if (t.id === 'admin-signout') {
        e.preventDefault();
        onSignOut();
        return;
      }
      var decision = t.getAttribute('data-decide');
      var email = t.getAttribute('data-email');
      if (decision && email) {
        e.preventDefault();
        onDecide(email, decision);
      }
    });

    if (auth().isSignedIn()) {
      loadRequests();
    } else {
      refreshChrome(false);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
