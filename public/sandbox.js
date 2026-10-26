// Sandbox agent runner. Calls OpenAI directly from the browser.
// Loaded from /sandbox.js so script-src 'self' allows it.
// Production CSP needs: connect-src 'self' https://api.openai.com
(function () {
  var API = 'https://api.openai.com/v1/chat/completions';
  var KEY_STORE = 'vaathi.sandbox.key';
  var running = false;

  var FACTS = {
    llm: 'A Large Language Model predicts the next token in a sequence, trained on large text corpora.',
    transformer: 'Transformers use self-attention so every token can attend to every other token in the input.',
    agent: 'An agent is a goal-driven loop: plan, act (call tools), observe, repeat or stop.',
    embedding: 'An embedding turns text into a numeric vector so similar meanings sit close together.',
    rag: 'Retrieval-Augmented Generation retrieves relevant documents and feeds them to the model.',
    mcp: 'Model Context Protocol is a standard for connecting AI models to external tools and data sources.',
    ai: 'Artificial intelligence is the simulation of human intelligence by machines.',
    prompt: 'A prompt is the text you send to a model. Clarity beats cleverness.',
  };

  function $(id) { return document.getElementById(id); }
  function loadKey() { try { return localStorage.getItem(KEY_STORE) || ''; } catch(e) { return ''; } }
  function saveKey(v) { try { localStorage.setItem(KEY_STORE, v); } catch(e) {} }

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

  function finishStep(node, extra) {
    if (!node) return;
    var step = node.closest('.sb-step');
    if (step) { step.classList.remove('sb-step--active'); step.classList.add('sb-step--done'); }
    if (extra) node.textContent += extra;
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

  function handleTab(e) {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    var t = e.target, s = t.selectionStart, end = t.selectionEnd;
    t.value = t.value.substring(0, s) + '    ' + t.value.substring(end);
    t.selectionStart = t.selectionEnd = s + 4;
  }

  async function streamChat(key, messages, tools, onDelta, onToolCall) {
    var body = { model: 'gpt-4o-mini', messages: messages, stream: true, max_tokens: 600 };
    if (tools && tools.length) body.tools = tools;
    var resp = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      var err = await resp.text();
      throw new Error('OpenAI ' + resp.status + ': ' + err.slice(0, 300));
    }
    var reader = resp.body.getReader();
    var decoder = new TextDecoder();
    var buf = '';
    var text = '';
    var toolCalls = {};
    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buf += decoder.decode(chunk.value, { stream: true });
      var lines = buf.split('\n');
      buf = lines.pop();
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].replace(/^data: /, '').trim();
        if (!line || line === '[DONE]') continue;
        try {
          var parsed = JSON.parse(line);
          var delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
          if (!delta) continue;
          if (delta.content) { text += delta.content; if (onDelta) onDelta(delta.content, text); }
          if (delta.tool_calls) {
            for (var j = 0; j < delta.tool_calls.length; j++) {
              var tc = delta.tool_calls[j];
              var idx = tc.index || 0;
              if (!toolCalls[idx]) toolCalls[idx] = { id: '', name: '', args: '' };
              if (tc.id) toolCalls[idx].id = tc.id;
              if (tc.function && tc.function.name) toolCalls[idx].name = tc.function.name;
              if (tc.function && tc.function.arguments) toolCalls[idx].args += tc.function.arguments;
            }
          }
        } catch (e) {}
      }
    }
    var calls = Object.values(toolCalls);
    return { text: text, toolCalls: calls.length ? calls : null };
  }

  function executeTool(name, argsJson) {
    try { var args = JSON.parse(argsJson); } catch(e) { return 'Error parsing arguments.'; }
    if (name === 'lookup_fact') {
      var topic = (args.topic || '').toLowerCase();
      for (var key in FACTS) { if (topic.indexOf(key) !== -1) return FACTS[key]; }
      return 'No fact found for "' + args.topic + '". Available: ' + Object.keys(FACTS).join(', ');
    }
    return 'Unknown tool: ' + name;
  }

  var TOOL_SCHEMA = [{
    type: 'function',
    function: {
      name: 'lookup_fact',
      description: 'Look up a fact about an AI concept. Input: a short topic name.',
      parameters: { type: 'object', properties: { topic: { type: 'string', description: 'The AI topic' } }, required: ['topic'] }
    }
  }];

  async function runScenario(scenario) {
    var key = ($('sandbox-key') || {}).value || '';
    if (!key.trim()) { setStatus('Paste your OpenAI API key above.', 'error'); return; }
    saveKey(key);
    clearPipeline();
    running = true;
    var btn = $('sandbox-run');
    if (btn) btn.disabled = true;
    setStatus('Running…');

    try {
      if (scenario === 'chat') await runChat(key);
      else if (scenario === 'rag') await runRAG(key);
      else if (scenario === 'agent') await runAgent(key);
      setStatus('Done', 'ok');
    } catch (e) {
      addStep('error', 'Error', e.message);
      setStatus('Failed', 'error');
    } finally {
      running = false;
      if (btn) btn.disabled = false;
    }
  }

  function questionFor(scenario) {
    var id = scenario === 'chat' ? 'sandbox-question-chat'
      : scenario === 'rag' ? 'sandbox-question-rag'
      : 'sandbox-question-agent';
    return ($(id) || {}).value || '';
  }

  async function runChat(key) {
    var prompt = ($('sandbox-prompt') || {}).value || 'You are a helpful assistant that explains AI concepts in one short paragraph.';
    var question = questionFor('chat') || 'What is a large language model?';
    addStep('info', 'Simple chat', 'One model call. No tools, no loop.');
    addStep('brief', 'Your prompt', prompt + '\n\nQuestion: ' + question);
    var bodyNode = addStep('model', 'Model response', '', 'active');
    await streamChat(key,
      [{ role: 'system', content: prompt }, { role: 'user', content: question }],
      null,
      function (delta) { if (bodyNode) bodyNode.textContent += delta; }
    );
    finishStep(bodyNode);
    addStep('answer', 'Done', 'The model returned one completion. No loop, no tool.');
  }

  async function runRAG(key) {
    var doc = ($('sandbox-doc') || {}).value || '';
    var question = questionFor('rag') || 'What is the role of the model inside an agent?';
    addStep('info', 'Document Q&A (RAG pattern)', 'The document is sent as context so the model answers from it.');
    addStep('brief', 'Document', doc.length > 300 ? doc.slice(0, 300) + '…' : doc);
    addStep('brief', 'Question', question);
    var system = 'Answer the question using ONLY the document below. If the answer is not in the document, say so.\n\n<document>\n' + doc + '\n</document>';
    var bodyNode = addStep('model', 'Model response', '', 'active');
    await streamChat(key,
      [{ role: 'system', content: system }, { role: 'user', content: question }],
      null,
      function (delta) { if (bodyNode) bodyNode.textContent += delta; }
    );
    finishStep(bodyNode);
    addStep('answer', 'Done', 'The model answered from the document context. In a production RAG system, you would split the document into chunks, embed them, and retrieve only the relevant parts.');
  }

  async function runAgent(key) {
    var question = questionFor('agent') || 'What is an agent and how does it relate to an LLM?';
    var maxSteps = 5;
    addStep('info', 'Agent with tools', 'The model can call lookup_fact in a loop. Max ' + maxSteps + ' steps.');
    addStep('brief', 'Question', question);
    var messages = [
      { role: 'system', content: 'You are a helpful assistant. Use the lookup_fact tool to find facts about AI concepts before answering. Look up each concept separately.' },
      { role: 'user', content: question }
    ];
    for (var step = 0; step < maxSteps; step++) {
      var bodyNode = addStep('model', 'Step ' + (step + 1) + ' — Model thinking', '', 'active');
      var result = await streamChat(key, messages, TOOL_SCHEMA,
        function (delta) { if (bodyNode) bodyNode.textContent += delta; }
      );
      if (!result.toolCalls) {
        if (!result.text && bodyNode) bodyNode.textContent = '(model finished with tool results)';
        finishStep(bodyNode);
        if (result.text) addStep('answer', 'Final answer', result.text);
        else addStep('answer', 'Done', 'The model used the tool results to answer.');
        return;
      }
      finishStep(bodyNode, result.text ? '' : ' → calling tools');
      messages.push({ role: 'assistant', content: result.text || null, tool_calls: result.toolCalls.map(function(tc) { return { id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.args } }; }) });
      for (var j = 0; j < result.toolCalls.length; j++) {
        var tc = result.toolCalls[j];
        var argsDisplay = tc.args;
        try { argsDisplay = JSON.stringify(JSON.parse(tc.args)); } catch(e){}
        addStep('tool', 'Tool call: ' + tc.name, argsDisplay);
        var toolResult = executeTool(tc.name, tc.args);
        addStep('result', 'Tool result', toolResult);
        messages.push({ role: 'tool', content: toolResult, tool_call_id: tc.id });
      }
    }
    addStep('answer', 'Stopped', 'Step limit (' + maxSteps + ') reached.');
  }

  function loadScenario(name) {
    var panels = document.querySelectorAll('[data-scenario-panel]');
    panels.forEach(function (p) { p.hidden = p.getAttribute('data-scenario-panel') !== name; });
    document.querySelectorAll('[data-scenario-tab]').forEach(function (t) {
      t.classList.toggle('sb-tab--active', t.getAttribute('data-scenario-tab') === name);
    });
    clearPipeline();
    setStatus('');
  }

  function start() {
    var keyInput = $('sandbox-key');
    if (keyInput) keyInput.value = loadKey();
    loadScenario('chat');

    document.addEventListener('click', function (e) {
      var tab = e.target && e.target.closest && e.target.closest('[data-scenario-tab]');
      if (tab && !running) { loadScenario(tab.getAttribute('data-scenario-tab')); return; }
      if (e.target && e.target.id === 'sandbox-run' && !running) {
        var active = document.querySelector('.sb-tab--active');
        if (active) runScenario(active.getAttribute('data-scenario-tab'));
      }
    });

    var ta = document.querySelectorAll('textarea');
    ta.forEach(function (t) { t.addEventListener('keydown', handleTab); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
