// Sandbox UI — calls AWS Lambda → Amazon Bedrock (never OpenAI / no BYOK).
(function () {
  var running = false;

  function apiUrl() {
    return (window.VAATHI_SANDBOX_API || '').replace(/\/?$/, '/');
  }

  function $(id) { return document.getElementById(id); }

  function addStep(type, label, content, state) {
    var pipeline = $('sandbox-pipeline');
    if (!pipeline) return null;
    var step = document.createElement('div');
    step.className = 'sb-step sb-step--' + type + (state ? ' sb-step--' + state : '');
    var hdr = document.createElement('div');
    hdr.className = 'sb-step__hdr';
    var icons = { brief: '📝', model: '🤖', tool: '🔧', result: '📋', answer: '✅', error: '⚠️', info: 'ℹ️' };
    hdr.textContent = (icons[type] || '') + ' ' + label;
    var body = document.createElement('div');
    body.className = 'sb-step__body';
    if (content) body.textContent = content;
    step.appendChild(hdr);
    step.appendChild(body);
    pipeline.appendChild(step);
    step.offsetHeight;
    step.classList.add('sb-step--in');
    pipeline.scrollTop = pipeline.scrollHeight;
    return body;
  }

  function clearPipeline() {
    var p = $('sandbox-pipeline');
    if (p) p.replaceChildren();
  }

  function setStatus(msg, cls) {
    var el = $('sandbox-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'sandbox-status' + (cls ? ' sandbox-status--' + cls : '');
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  async function playSteps(steps) {
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      addStep(s.type || 'info', s.label || '', s.content || '', i === steps.length - 1 ? '' : 'active');
      await sleep(280);
    }
  }

  function questionFor(scenario) {
    var id = scenario === 'chat' ? 'sandbox-question-chat'
      : scenario === 'rag' ? 'sandbox-question-rag'
      : 'sandbox-question-agent';
    return ($(id) || {}).value || '';
  }

  async function runScenario(scenario) {
    var url = apiUrl();
    if (!url || url.indexOf('http') !== 0) {
      setStatus('Sandbox API is not configured.', 'error');
      addStep('error', 'Error', 'Missing VAATHI_SANDBOX_API.');
      return;
    }

    clearPipeline();
    running = true;
    var btn = $('sandbox-run');
    if (btn) btn.disabled = true;
    setStatus('Calling Amazon Bedrock via AWS…');

    var payload = { scenario: scenario };
    if (scenario === 'chat') {
      payload.prompt = ($('sandbox-prompt') || {}).value || '';
      payload.question = questionFor('chat');
    } else if (scenario === 'rag') {
      payload.document = ($('sandbox-doc') || {}).value || '';
      payload.question = questionFor('rag');
    } else {
      payload.question = questionFor('agent');
    }

    var token = (window.VaathiAuth && window.VaathiAuth.accessToken && window.VaathiAuth.accessToken()) || '';
    if (!token) {
      setStatus('Sign in with Cognito first (email + authenticator).', 'error');
      addStep('error', 'Sign in required', 'Create an account, confirm email, then complete TOTP MFA.');
      running = false;
      if (btn) btn.disabled = false;
      return;
    }

    try {
      var resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify(payload),
      });
      if (resp.status === 401) {
        if (window.VaathiAuth && window.VaathiAuth.clearSession) window.VaathiAuth.clearSession();
        throw new Error('Session expired — sign in again.');
      }
      var data = await resp.json().catch(function () { return {}; });
      if (!resp.ok) {
        throw new Error(data.error || ('HTTP ' + resp.status));
      }
      if (!data.steps || !data.steps.length) {
        throw new Error('Empty response from sandbox API');
      }
      await playSteps(data.steps);
      setStatus('Done · ' + (data.model || 'Bedrock') + ' · ' + (data.region || ''), 'ok');
    } catch (e) {
      addStep('error', 'Error', e.message || String(e));
      setStatus('Failed', 'error');
    } finally {
      running = false;
      if (btn) btn.disabled = false;
    }
  }

  function loadScenario(name) {
    document.querySelectorAll('[data-scenario-panel]').forEach(function (p) {
      p.hidden = p.getAttribute('data-scenario-panel') !== name;
    });
    document.querySelectorAll('[data-scenario-tab]').forEach(function (t) {
      t.classList.toggle('sb-tab--active', t.getAttribute('data-scenario-tab') === name);
    });
    clearPipeline();
    setStatus('');
  }

  function handleTab(e) {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    var t = e.target, s = t.selectionStart, end = t.selectionEnd;
    t.value = t.value.substring(0, s) + '    ' + t.value.substring(end);
    t.selectionStart = t.selectionEnd = s + 4;
  }

  function start() {
    loadScenario('chat');
    document.addEventListener('click', function (e) {
      var tab = e.target && e.target.closest && e.target.closest('[data-scenario-tab]');
      if (tab && !running) {
        loadScenario(tab.getAttribute('data-scenario-tab'));
        return;
      }
      if (e.target && e.target.id === 'sandbox-run' && !running) {
        var active = document.querySelector('.sb-tab--active');
        if (active) runScenario(active.getAttribute('data-scenario-tab'));
      }
    });
    document.querySelectorAll('textarea').forEach(function (t) {
      t.addEventListener('keydown', handleTab);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
