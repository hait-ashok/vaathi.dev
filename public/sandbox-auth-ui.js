// Sandbox auth panel: register → confirm → sign-in → TOTP setup / code.
(function () {
  var state = { email: '', session: '', secret: '', mode: 'signin' };

  function $(id) { return document.getElementById(id); }
  function auth() { return window.VaathiAuth; }

  function setMsg(text, isError) {
    var el = $('sandbox-auth-msg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'sandbox-hint' + (isError ? ' sandbox-status--error' : '');
  }

  function showPanel(name) {
    document.querySelectorAll('[data-auth-panel]').forEach(function (p) {
      p.hidden = p.getAttribute('data-auth-panel') !== name;
    });
  }

  function otpauthUrl(email, secret) {
    var label = encodeURIComponent('vaathi.dev:' + (email || 'user'));
    var issuer = encodeURIComponent('vaathi.dev');
    return (
      'otpauth://totp/' + label +
      '?secret=' + encodeURIComponent(secret) +
      '&issuer=' + issuer +
      '&algorithm=SHA1&digits=6&period=30'
    );
  }

  function renderTotpQr(email, secret) {
    var host = $('auth-totp-qr');
    if (!host) return;
    host.replaceChildren();
    if (!secret) return;
    if (typeof qrcode !== 'function') {
      host.textContent = 'QR library missing — use the manual key below.';
      return;
    }
    try {
      if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
        qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
      }
      var qr = qrcode(0, 'M');
      qr.addData(otpauthUrl(email, secret));
      qr.make();
      host.innerHTML = qr.createSvgTag(5, 0);
      var svg = host.querySelector('svg');
      if (svg) {
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', 'Scan to add vaathi.dev to your authenticator');
      }
    } catch (err) {
      host.textContent = 'Could not draw QR — use the manual key below.';
    }
  }

  function refreshSignedIn() {
    var a = auth();
    var signed = a && a.isSignedIn();
    var gate = $('sandbox-auth');
    var run = $('sandbox-run');
    var who = $('sandbox-auth-who');
    var out = $('sandbox-signout');
    if (gate) gate.hidden = !!signed;
    if (run) run.disabled = !signed;
    if (out) out.hidden = !signed;
    if (who) {
      if (signed) {
        var s = a.loadSession();
        who.hidden = false;
        who.textContent = 'Signed in as ' + (s.email || 'user') + ' · Bedrock cap $1/day';
      } else {
        who.hidden = true;
        who.textContent = '';
      }
    }
  }

  async function onRegister(e) {
    e.preventDefault();
    var email = ($('auth-email') || {}).value.trim();
    var password = ($('auth-password') || {}).value;
    try {
      await auth().signUp(email, password);
      state.email = email;
      setMsg('Check your email for a confirmation code.');
      showPanel('confirm');
    } catch (err) {
      setMsg(err.message, true);
    }
  }

  async function onConfirm(e) {
    e.preventDefault();
    var email = state.email || ($('auth-email') || {}).value.trim();
    var code = ($('auth-confirm-code') || {}).value.trim();
    try {
      await auth().confirmSignUp(email, code);
      setMsg('Email confirmed. Sign in.');
      showPanel('signin');
    } catch (err) {
      setMsg(err.message, true);
    }
  }

  async function finishAuth(result, email) {
    auth().storeAuthResult(result, email);
    setMsg('Signed in.');
    refreshSignedIn();
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
      var secretEl = $('auth-totp-secret');
      if (secretEl) secretEl.textContent = state.secret;
      renderTotpQr(email, state.secret);
      setMsg('Scan the QR code (or enter the key), then enter a 6-digit code.');
      showPanel('mfa-setup');
      return;
    }
    throw new Error('Unsupported challenge: ' + (result.ChallengeName || 'unknown'));
  }

  async function onSignIn(e) {
    e.preventDefault();
    var email = ($('auth-email-signin') || {}).value.trim() || ($('auth-email') || {}).value.trim();
    var password = ($('auth-password-signin') || {}).value || ($('auth-password') || {}).value;
    try {
      var result = await auth().initiateAuth(email, password);
      await handleAuthResponse(result, email);
    } catch (err) {
      setMsg(err.message, true);
    }
  }

  async function onMfa(e) {
    e.preventDefault();
    var code = ($('auth-mfa-code') || {}).value.trim();
    try {
      var result = await auth().respondMfa(state.email, state.session, code);
      await handleAuthResponse(result, state.email);
    } catch (err) {
      setMsg(err.message, true);
    }
  }

  async function onMfaSetup(e) {
    e.preventDefault();
    var code = ($('auth-mfa-setup-code') || {}).value.trim();
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
    showPanel('signin');
    refreshSignedIn();
  }

  function start() {
    if (!auth()) return;
    showPanel('signin');
    refreshSignedIn();

    var reg = $('auth-form-register');
    var conf = $('auth-form-confirm');
    var sign = $('auth-form-signin');
    var mfa = $('auth-form-mfa');
    var setup = $('auth-form-mfa-setup');
    if (reg) reg.addEventListener('submit', onRegister);
    if (conf) conf.addEventListener('submit', onConfirm);
    if (sign) sign.addEventListener('submit', onSignIn);
    if (mfa) mfa.addEventListener('submit', onMfa);
    if (setup) setup.addEventListener('submit', onMfaSetup);

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      var go = t.getAttribute('data-auth-goto');
      if (go) {
        e.preventDefault();
        showPanel(go);
        setMsg('');
      }
      if (t.id === 'sandbox-signout') {
        e.preventDefault();
        onSignOut();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
